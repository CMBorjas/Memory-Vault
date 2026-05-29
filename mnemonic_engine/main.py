"""
Anti-Gravity Mnemonic Engine — FastAPI Application
"""
import os
import uuid
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from collections import Counter
import re

import fitz  # PyMuPDF
import yaml
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from engine import MnemonicEngine
from exporter import ObsidianExporter

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("anti-gravity")

DATA_PATH = Path(os.getenv("DATA_PATH", "./data"))
VAULT_PATH = Path(os.getenv("VAULT_PATH", "./vault"))
UPLOAD_DIR = DATA_PATH / "uploads"
PROCESSED_DIR = DATA_PATH / "processed"
for d in [UPLOAD_DIR, PROCESSED_DIR, VAULT_PATH]:
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Anti-Gravity Mnemonic Engine", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CONFIG_PATH = Path(__file__).parent / "book_config.yml"
engine = MnemonicEngine(CONFIG_PATH)
exporter = ObsidianExporter(VAULT_PATH)

STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_gui():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return JSONResponse({"status": "engine running", "gui": "not found"})
    return FileResponse(str(index_path))


@app.get("/api/health")
async def health():
    return {"status": "alive", "version": "0.1.0", "books_loaded": list(engine.config.get("books", {}).keys())}


@app.get("/api/books")
async def list_books():
    books = engine.config.get("books", {})
    return {name: {k: v for k, v in p.items() if k != "visual_keywords"} for name, p in books.items()}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), book: str = "Networking"):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    if book not in engine.config.get("books", {}):
        raise HTTPException(status_code=400, detail=f"Unknown book '{book}'. Available: {list(engine.config['books'].keys())}")

    doc_id = str(uuid.uuid4())[:8]
    upload_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"
    with open(upload_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    logger.info(f"Uploaded: {file.filename} -> {upload_path.name} (book: {book})")

    try:
        sections = extract_pdf_sections(upload_path)
        for section in sections:
            section["mnemonics"] = engine.generate(section, book)

        now = datetime.now().isoformat()
        document = {
            "id": doc_id, "filename": file.filename, "book": book,
            "uploaded_at": now, "updated_at": now,
            "created_by": "Local User",
            "section_count": len(sections), "sections": sections,
            "favourite": False,
            "revision": 1,
            "revisions": [{"revision": 1, "timestamp": now, "summary": "Initial import via PDF ingestion"}],
        }
        with open(PROCESSED_DIR / f"{doc_id}.json", "w") as f:
            json.dump(document, f, indent=2)

        return {"id": doc_id, "filename": file.filename, "book": book, "section_count": len(sections)}
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def list_documents():
    docs = []
    for p in sorted(PROCESSED_DIR.glob("*.json"), reverse=True):
        with open(p) as f:
            d = json.load(f)
        docs.append({k: d[k] for k in ["id", "filename", "book", "uploaded_at", "section_count"]})
    return docs


@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        return json.load(f)


@app.put("/api/documents/{doc_id}/sections/{section_idx}/mnemonics")
async def update_mnemonics(doc_id: str, section_idx: int, mnemonics: dict):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    if section_idx < 0 or section_idx >= len(doc["sections"]):
        raise HTTPException(status_code=400, detail="Invalid section index.")
    doc["sections"][section_idx]["mnemonics"] = mnemonics
    doc["sections"][section_idx]["user_edited"] = True
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Edited mnemonics for section {section_idx}"
    })
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Updated.", "section_idx": section_idx}


@app.post("/api/documents/{doc_id}/regenerate/{section_idx}")
async def regenerate_mnemonics(doc_id: str, section_idx: int):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    if section_idx < 0 or section_idx >= len(doc["sections"]):
        raise HTTPException(status_code=400, detail="Invalid section index.")
    section = doc["sections"][section_idx]
    section["mnemonics"] = engine.generate(section, doc["book"])
    section.pop("user_edited", None)
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Regenerated.", "mnemonics": section["mnemonics"]}


@app.post("/api/documents/{doc_id}/export")
async def export_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    files = exporter.export(doc)
    return {"message": f"Exported {len(files)} files.", "files": files}


@app.post("/api/documents/{doc_id}/copy")
async def copy_document(doc_id: str):
    """Create a deep copy of a document with a new ID."""
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    new_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    doc["id"] = new_id
    doc["filename"] = f"(Copy) {doc['filename']}"
    doc["uploaded_at"] = now
    doc["updated_at"] = now
    doc["revision"] = 1
    doc["revisions"] = [{"revision": 1, "timestamp": now, "summary": f"Copied from document {doc_id}"}]
    with open(PROCESSED_DIR / f"{new_id}.json", "w") as f_out:
        json.dump(doc, f_out, indent=2)
    logger.info(f"Copied document {doc_id} -> {new_id}")
    return {"message": "Document copied.", "new_id": new_id, "filename": doc["filename"]}


@app.put("/api/documents/{doc_id}/move")
async def move_document(doc_id: str, book: str = "Networking"):
    """Move a document to a different book/kingdom."""
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    if book not in engine.config.get("books", {}):
        raise HTTPException(status_code=400, detail=f"Unknown book '{book}'. Available: {list(engine.config['books'].keys())}")
    with open(p) as f:
        doc = json.load(f)
    old_book = doc["book"]
    doc["book"] = book
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Moved from {old_book} to {book}"
    })
    with open(p, "w") as f_out:
        json.dump(doc, f_out, indent=2)
    logger.info(f"Moved document {doc_id} from {old_book} to {book}")
    return {"message": f"Moved to {book}.", "old_book": old_book, "new_book": book}


@app.put("/api/documents/{doc_id}/favourite")
async def toggle_favourite(doc_id: str):
    """Toggle the favourite status of a document."""
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    doc["favourite"] = not doc.get("favourite", False)
    with open(p, "w") as f_out:
        json.dump(doc, f_out, indent=2)
    return {"message": "Toggled.", "favourite": doc["favourite"]}


@app.get("/api/documents/{doc_id}/revisions")
async def get_revisions(doc_id: str):
    """Get the revision history for a document."""
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    return {
        "id": doc_id,
        "current_revision": doc.get("revision", 1),
        "revisions": doc.get("revisions", [])
    }


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    p.unlink()
    for f in UPLOAD_DIR.glob(f"{doc_id}_*"):
        f.unlink()
    return {"message": "Deleted.", "id": doc_id}


# === PDF Extraction ===

def extract_pdf_sections(pdf_path: Path) -> list:
    doc = fitz.open(str(pdf_path))
    sections, current = [], None

    all_sizes = []
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        all_sizes.append(span["size"])

    if not all_sizes:
        doc.close()
        return []

    body_size = Counter(all_sizes).most_common(1)[0][0]
    heading_thresh = body_size * 1.15

    for page_num, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            parts, is_heading = [], False
            for line in block.get("lines", []):
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    if span["size"] >= heading_thresh or (span["size"] > body_size and span["flags"] & 16):
                        is_heading = True
                    parts.append(text)

            block_text = " ".join(parts).strip()
            if not block_text:
                continue

            if is_heading:
                if current and current["content"].strip():
                    sections.append(current)
                current = {"title": block_text, "content": "", "page": page_num + 1, "key_terms": []}
            elif current:
                current["content"] += block_text + "\n"
            else:
                current = {"title": "Introduction", "content": block_text + "\n", "page": 1, "key_terms": []}

    if current and current["content"].strip():
        sections.append(current)
    doc.close()

    for s in sections:
        s["key_terms"] = _extract_key_terms(s["content"])
    return sections


def _extract_key_terms(text: str, max_terms: int = 8) -> list:
    terms = set()
    terms.update(re.findall(r'\b[A-Z]{2,}\b', text)[:4])
    terms.update(re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', text)[:4])
    return list(terms)[:max_terms]
