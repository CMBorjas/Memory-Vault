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


@app.get("/api/progress")
async def get_progress():
    p = DATA_PATH / "progress.json"
    if p.exists():
        try:
            with open(p) as f:
                return json.load(f)
        except Exception:
            pass
    return {"status": "idle"}


@app.get("/api/health")
async def health():
    return {"status": "alive", "version": "0.1.0", "books_loaded": list(engine.config.get("books", {}).keys())}


@app.get("/api/books")
async def list_books():
    books = engine.config.get("books", {})
    return {name: {k: v for k, v in p.items() if k != "visual_keywords"} for name, p in books.items()}


@app.put("/api/books/{book_name}")
async def update_book_profile(book_name: str, profile: dict):
    """Update a book's mnemonic profile and save to book_config.yml."""
    if book_name not in engine.config.get("books", {}):
        raise HTTPException(status_code=404, detail=f"Unknown book '{book_name}'")

    current_profile = engine.config["books"][book_name]
    
    # Update allowed fields
    allowed_fields = ["kingdom", "aesthetic", "scent_primary", "scent_secondary", "mc_profile", "plot", "color_palette"]
    for k in allowed_fields:
        if k in profile:
            current_profile[k] = profile[k]

    # Save to yaml file
    config_path = BASE_DIR / "book_config.yml"
    
    # Preserve the nice header comment
    header = \"\"\"# ╔══════════════════════════════════════════════════════════════╗
# ║  Anti-Gravity Knowledge Engine — Book Configuration        ║
# ║  Each book/module is assigned a biological kingdom and     ║
# ║  sensory profile to prevent "memory bleeding" between      ║
# ║  subjects. Mnemonics are generated using these anchors.    ║
# ╚══════════════════════════════════════════════════════════════╝

\"\"\"
    try:
        with open(config_path, "w") as f:
            f.write(header)
            yaml.dump(engine.config, f, sort_keys=False, default_flow_style=False)
    except Exception as e:
        logger.error(f"Failed to save book_config.yml: {e}")
        raise HTTPException(status_code=500, detail="Failed to save configuration")

    return {"message": "Profile updated successfully", "profile": current_profile}


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
        for i, section in enumerate(sections):
            try:
                with open(DATA_PATH / "progress.json", "w") as f:
                    json.dump({
                        "status": "generating",
                        "filename": file.filename,
                        "current_section": i + 1,
                        "total_sections": len(sections),
                        "message": f"Generating mnemonics: section {i + 1} of {len(sections)}"
                    }, f)
            except Exception:
                pass
            section["mnemonics"] = engine.generate(section, book)
            
        try:
            with open(DATA_PATH / "progress.json", "w") as f:
                json.dump({"status": "idle"}, f)
        except Exception:
            pass

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
    for p in sorted(PROCESSED_DIR.glob("*.json"), reverse=False):
        with open(p) as f:
            d = json.load(f)
        entry = {k: d[k] for k in ["id", "filename", "book", "uploaded_at", "section_count"] if k in d}
        # Include canonical naming fields when present
        for field in ("title", "chapter_number", "chapter_title", "source_pdf"):
            if field in d:
                entry[field] = d[field]
        docs.append(entry)
    # Sort by chapter_number if present, then by upload date
    docs.sort(key=lambda x: (x.get("chapter_number", 9999), x.get("uploaded_at", "")))
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


@app.put("/api/documents/{doc_id}/title")
async def update_title(doc_id: str, payload: dict):
    """Update the title of a document."""
    new_title = payload.get("title")
    if not new_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    
    old_title = doc.get("filename", "")
    doc["filename"] = new_title
    doc["title"] = new_title
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Changed title from '{old_title}' to '{new_title}'"
    })
    with open(p, "w") as f_out:
        json.dump(doc, f_out, indent=2)
    return {"message": "Title updated.", "title": new_title}


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


# === Chapter Canonical Name Map ===

CHAPTER_MAP = {
    1:  "Introduction to Networks",
    2:  "The Open Systems Interconnection Specifications",
    3:  "Networking Connectors and Wiring Standards",
    4:  "The Current Ethernet Specifications",
    5:  "Networking Devices",
    6:  "Introduction to the Internet Protocol",
    7:  "IP Addressing",
    8:  "IP Subnetting, Troubleshooting IP, and Introduction to NAT",
    9:  "Introduction to IP Routing",
    10: "Routing Protocols",
    11: "Switching and Virtual LANs",
    12: "Wireless Networking",
    13: "Authentication and Access Control",
    14: "Network Threats and Mitigation",
    15: "Physical and Logical Security",
    16: "Wide Area Networks",
    17: "Troubleshooting Tools",
    18: "Software Tools and Network Troubleshooting",
    19: "Network Management",
    20: "Cloud Computing and Remote Access",
    21: "Virtualisation and Storage Area Networks",
    22: "Incident Response, Policies, and Business Continuity",
    23: "Network Segmentation, VLANs, and VPNs",
    24: "High Availability and Disaster Recovery",
    25: "Network Hardening",
}

# Sybex textbook metadata — used to group chapters into a single book
SYBEX_TEXTBOOK_ID    = "sybex-n10-008"
SYBEX_TEXTBOOK_TITLE = "CompTIA Network+ Study Guide (Exam N10-008)"
SYBEX_TEXTBOOK_SHORT = "Sybex Network+ N10-008"
SYBEX_PUBLISHER      = "Sybex / Todd Lammle"

# Path to the pre-split chapter PDFs (mounted from host at runtime)
SYBEX_CHAPTERS_BASE = DATA_PATH / "uploads" / "Sybex_comptia-network-study-guide-exam-n10-008" / "Contents" / "004_Chapters"

@app.get("/api/textbooks")
async def list_textbooks():
    """
    Return all ingested documents grouped by textbook_id.
    Documents without a textbook_id are returned as individual loose entries.
    """
    grouped: dict = {}   # textbook_id -> {meta, chapters[]}
    loose: list = []

    for p in sorted(PROCESSED_DIR.glob("*.json")):
        with open(p) as f:
            d = json.load(f)

        tbid = d.get("textbook_id")
        if tbid:
            if tbid not in grouped:
                grouped[tbid] = {
                    "textbook_id":    tbid,
                    "textbook":       d.get("textbook", tbid),
                    "textbook_short": d.get("textbook_short", tbid),
                    "book":           d.get("book", ""),
                    "chapter_count":  0,
                    "total_sections": 0,
                    "chapters": [],
                }
            grouped[tbid]["chapter_count"]  += 1
            grouped[tbid]["total_sections"] += d.get("section_count", 0)
            grouped[tbid]["chapters"].append({
                "id":            d["id"],
                "chapter_number": d.get("chapter_number"),
                "chapter_title":  d.get("chapter_title", d.get("filename", "")),
                "section_count":  d.get("section_count", 0),
            })
        else:
            loose.append({
                "id":           d["id"],
                "filename":     d.get("filename", ""),
                "book":         d.get("book", ""),
                "section_count": d.get("section_count", 0),
                "uploaded_at":  d.get("uploaded_at", ""),
            })

    # Sort chapters within each textbook
    for tb in grouped.values():
        tb["chapters"].sort(key=lambda c: c.get("chapter_number") or 0)

    return {
        "textbooks": list(grouped.values()),
        "loose": loose,
    }



@app.post("/api/ingest-local")
async def ingest_local_chapters(book: str = "Networking", start: int = 1, end: int = 25):
    """
    Batch-ingest pre-split Sybex chapter PDFs from the mounted uploads directory.
    Assigns canonical chapter names (Chapter 01 — Introduction to Networks, etc.)
    so document titles in the GUI are rigid and match the textbook structure.
    """
    if book not in engine.config.get("books", {}):
        raise HTTPException(status_code=400, detail=f"Unknown book '{book}'.")

    if not SYBEX_CHAPTERS_BASE.exists():
        raise HTTPException(status_code=404, detail=f"Chapter directory not found: {SYBEX_CHAPTERS_BASE}")

    chapters_to_ingest = [(num, CHAPTER_MAP[num]) for num in range(start, end + 1) if num in CHAPTER_MAP]
    if not chapters_to_ingest:
        raise HTTPException(status_code=400, detail="No valid chapter numbers in range.")

    results = []
    skipped = []

    for file_idx, (chapter_num, chapter_title) in enumerate(chapters_to_ingest):
        canonical_name = f"Chapter {chapter_num:02d} \u2014 {chapter_title}"
        pdf_filename = f"{chapter_num:03d}_Sybex_comptia-network-study-guide-exam-n10-008.pdf"
        chapter_dir = SYBEX_CHAPTERS_BASE / f"Chapter_{chapter_num:03d}"
        pdf_path = chapter_dir / pdf_filename

        # Update batch progress
        try:
            with open(DATA_PATH / "progress.json", "w") as f:
                json.dump({
                    "status": "batch",
                    "current_file": file_idx + 1,
                    "total_files": len(chapters_to_ingest),
                    "message": f"Ingesting {canonical_name} ({file_idx + 1}/{len(chapters_to_ingest)})"
                }, f)
        except Exception:
            pass

        if not pdf_path.exists():
            logger.warning(f"Chapter PDF not found: {pdf_path}")
            skipped.append(canonical_name)
            continue

        # Check if already ingested (match by canonical chapter_title field)
        already_exists = False
        for p in PROCESSED_DIR.glob("*.json"):
            try:
                with open(p) as f:
                    existing = json.load(f)
                if existing.get("chapter_number") == chapter_num:
                    already_exists = True
                    break
            except Exception:
                pass

        if already_exists:
            logger.info(f"Skipping already-ingested chapter {chapter_num}: {canonical_name}")
            skipped.append(f"{canonical_name} (already ingested)")
            continue

        logger.info(f"Ingesting chapter {chapter_num}: {canonical_name}")
        try:
            sections = extract_pdf_sections(pdf_path)
            for i, section in enumerate(sections):
                try:
                    with open(DATA_PATH / "progress.json", "w") as f:
                        json.dump({
                            "status": "generating",
                            "filename": canonical_name,
                            "current_section": i + 1,
                            "total_sections": len(sections),
                            "message": f"{canonical_name}: generating mnemonic {i + 1}/{len(sections)}"
                        }, f)
                except Exception:
                    pass
                section["mnemonics"] = engine.generate(section, book)

            doc_id = str(uuid.uuid4())[:8]
            now = datetime.now().isoformat()
            document = {
                "id": doc_id,
                # Raw filename for legacy compatibility
                "filename": canonical_name,
                # Canonical display fields — used by the GUI for rigid naming
                "title": canonical_name,
                "chapter_number": chapter_num,
                "chapter_title": chapter_title,
                "book": book,
                "source_pdf": pdf_filename,
                # Textbook grouping fields
                "textbook":       SYBEX_TEXTBOOK_TITLE,
                "textbook_id":    SYBEX_TEXTBOOK_ID,
                "textbook_short": SYBEX_TEXTBOOK_SHORT,
                "uploaded_at": now,
                "updated_at": now,
                "created_by": "Local Batch Ingest",
                "section_count": len(sections),
                "sections": sections,
                "favourite": False,
                "revision": 1,
                "revisions": [{"revision": 1, "timestamp": now, "summary": "Ingested from local chapter PDF"}],
            }
            with open(PROCESSED_DIR / f"{doc_id}.json", "w") as f:
                json.dump(document, f, indent=2)

            results.append({"chapter": chapter_num, "title": canonical_name, "id": doc_id, "sections": len(sections)})
            logger.info(f"Ingested chapter {chapter_num} as {doc_id} ({len(sections)} sections)")

        except Exception as e:
            logger.error(f"Failed to ingest chapter {chapter_num}: {e}")
            skipped.append(f"{canonical_name} (error: {str(e)[:80]})")

    # Reset progress
    try:
        with open(DATA_PATH / "progress.json", "w") as f:
            json.dump({"status": "idle"}, f)
    except Exception:
        pass

    return {
        "message": f"Batch ingest complete. {len(results)} ingested, {len(skipped)} skipped.",
        "ingested": results,
        "skipped": skipped,
    }


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
    heading_thresh = body_size * 1.1

    total_pages = len(doc)
    for page_num, page in enumerate(doc):
        try:
            with open(DATA_PATH / "progress.json", "w") as f:
                json.dump({
                    "status": "extracting",
                    "filename": pdf_path.name,
                    "current_page": page_num + 1,
                    "total_pages": total_pages,
                    "message": f"Extracting text: page {page_num + 1} of {total_pages}"
                }, f)
        except Exception:
            pass

        blocks = page.get_text("dict")["blocks"]
        
        # OCR Fallback for scanned pages
        text_length = len(page.get_text("text").strip())
        if text_length < 100 and len(page.get_images()) > 0:
            logger.info(f"Page {page_num+1} appears to be a scanned image. Attempting OCR...")
            try:
                page_ocr = page.get_textpage_ocr(flags=fitz.TEXT_PRESERVE_IMAGES, language="eng", dpi=300)
                blocks = page_ocr.extractDICT()["blocks"]
            except Exception as e:
                logger.warning(f"OCR failed on page {page_num+1}: {e}")

        for block in blocks:
            heading_parts = []
            content_parts = []
            for line in block.get("lines", []):
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    if span["size"] >= heading_thresh or (span["size"] >= body_size and span["flags"] & 16):
                        heading_parts.append(text)
                    else:
                        content_parts.append(text)

            heading_text = " ".join(heading_parts).strip()
            content_text = " ".join(content_parts).strip()
            
            if not heading_text and not content_text:
                continue

            if heading_text:
                if current and current["content"].strip():
                    sections.append(current)
                current = {"title": heading_text, "content": content_text + "\n" if content_text else "", "page": page_num + 1, "key_terms": []}
            elif current:
                current["content"] += content_text + "\n"
            else:
                current = {"title": "Introduction", "content": content_text + "\n", "page": 1, "key_terms": []}

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
