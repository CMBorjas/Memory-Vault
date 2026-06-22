import json
import uuid
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.config import PROCESSED_DIR, UPLOAD_DIR, engine, exporter, logger

router = APIRouter(prefix="/api", tags=["documents"])

@router.get("/documents")
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

@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        return json.load(f)

@router.put("/documents/{doc_id}/sections/{section_idx}/mnemonics")
async def update_mnemonics(doc_id: str, section_idx: int, mnemonics: dict):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
        
    if section_idx == -1:
        doc["mnemonics"] = mnemonics
        summary = "Edited chapter-level mnemonics"
    elif section_idx >= 0 and section_idx < len(doc["sections"]):
        doc["sections"][section_idx]["mnemonics"] = mnemonics
        doc["sections"][section_idx]["user_edited"] = True
        summary = f"Edited mnemonics for section {section_idx}"
    else:
        raise HTTPException(status_code=400, detail="Invalid section index.")
        
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": summary
    })
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Updated.", "section_idx": section_idx}

class SectionContentUpdate(BaseModel):
    title: str
    content: str

class NewSectionRequest(BaseModel):
    insert_after_idx: int = -1

@router.put("/documents/{doc_id}/sections/{section_idx}/content")
async def update_section_content(doc_id: str, section_idx: int, update: SectionContentUpdate):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    if section_idx < 0 or section_idx >= len(doc["sections"]):
        raise HTTPException(status_code=400, detail="Invalid section index.")
    
    doc["sections"][section_idx]["title"] = update.title
    doc["sections"][section_idx]["content"] = update.content
    
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Edited source content for section {section_idx}"
    })
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Section content updated.", "section_idx": section_idx}

@router.delete("/documents/{doc_id}/sections/{section_idx}")
async def delete_section(doc_id: str, section_idx: int):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    if section_idx < 0 or section_idx >= len(doc["sections"]):
        raise HTTPException(status_code=400, detail="Invalid section index.")
    
    deleted_section_title = doc["sections"][section_idx]["title"]
    del doc["sections"][section_idx]
    
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Deleted section {section_idx} ({deleted_section_title})"
    })
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Section deleted successfully."}

@router.post("/documents/{doc_id}/sections")
async def create_section(doc_id: str, req: NewSectionRequest):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
        
    new_section = {
        "title": "New Section",
        "content": "",
        "mnemonics": {
            "acronym": "",
            "visual": "",
            "scent": "",
            "logic": ""
        }
    }
    
    idx = req.insert_after_idx
    if idx >= 0 and idx < len(doc.get("sections", [])):
        doc.setdefault("sections", []).insert(idx + 1, new_section)
    else:
        doc.setdefault("sections", []).append(new_section)
        
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": "Added a new section"
    })
    
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": "Section added successfully."}

@router.post("/documents/{doc_id}/sections/{section_idx}/split")
async def split_section(doc_id: str, section_idx: int):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
        
    if section_idx < 0 or section_idx >= len(doc.get("sections", [])):
        raise HTTPException(status_code=400, detail="Invalid section index.")
        
    section = doc["sections"][section_idx]
    content = section.get("content", "")
    
    lines = content.split('\n')
    new_sections = []
    retained_lines = []
    
    bullet_pattern = re.compile(r'^[\u25a0\-\*\u2022]\s*(.+)')
    
    for line in lines:
        clean_line = line.strip()
        match = bullet_pattern.match(clean_line)
        if match:
            bullet_text = match.group(1).strip()
            if bullet_text:
                new_sec = {
                    "title": f"{section.get('title', 'Section')} - {bullet_text[:40]}",
                    "content": bullet_text,
                    "page": section.get("page", 1)
                }
                
                terms = re.findall(r'([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)', bullet_text)
                acronyms = re.findall(r'\b[A-Z]{2,}\b', bullet_text)
                new_sec["key_terms"] = list(set(terms + acronyms))
                
                new_sec["mnemonics"] = engine.generate(new_sec, doc.get("book"))
                new_sections.append(new_sec)
        else:
            retained_lines.append(line)
            
    if not new_sections:
        raise HTTPException(status_code=400, detail="No bullet points found to split. Lines must start with ■, -, *, or •")
        
    doc["sections"][section_idx]["content"] = '\n'.join(retained_lines).strip()
    
    for i, ns in enumerate(new_sections):
        doc["sections"].insert(section_idx + 1 + i, ns)
        
    now = datetime.now().isoformat()
    doc["updated_at"] = now
    doc["revision"] = doc.get("revision", 1) + 1
    doc.setdefault("revisions", []).append({
        "revision": doc["revision"], "timestamp": now,
        "summary": f"Split section into {len(new_sections)} subsections"
    })
    
    with open(p, "w") as f:
        json.dump(doc, f, indent=2)
    return {"message": f"Successfully split into {len(new_sections)} new sections."}

@router.post("/documents/{doc_id}/regenerate/{section_idx}")
async def regenerate_mnemonics(doc_id: str, section_idx: int, field: str = None):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
        
    if section_idx == -1:
        new_mnemonics = engine.generate_chapter(doc.get("chapter_title", doc.get("title", doc["filename"])), doc["book"])
        if field == "visual":
            doc["mnemonics"]["visual_anchor"] = new_mnemonics["visual_anchor"]
        else:
            doc["mnemonics"] = new_mnemonics
        with open(p, "w") as f:
            json.dump(doc, f, indent=2)
        return {"message": "Regenerated.", "mnemonics": doc["mnemonics"]}
    elif section_idx >= 0 and section_idx < len(doc["sections"]):
        section = doc["sections"][section_idx]
        new_mnemonics = engine.generate(section, doc["book"])
        if field == "visual":
            section["mnemonics"]["visual_anchor"] = new_mnemonics["visual_anchor"]
        else:
            section["mnemonics"] = new_mnemonics
            section.pop("user_edited", None)
        with open(p, "w") as f:
            json.dump(doc, f, indent=2)
        return {"message": "Regenerated.", "mnemonics": section["mnemonics"]}
    else:
        raise HTTPException(status_code=400, detail="Invalid section index.")

@router.post("/documents/{doc_id}/export")
async def export_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    files = exporter.export(doc)
    return {"message": f"Exported {len(files)} files.", "files": files}

@router.post("/documents/{doc_id}/copy")
async def copy_document(doc_id: str):
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

@router.put("/documents/{doc_id}/move")
async def move_document(doc_id: str, book: str = "Networking"):
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

@router.put("/documents/{doc_id}/title")
async def update_title(doc_id: str, payload: dict):
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

@router.put("/documents/{doc_id}/favourite")
async def toggle_favourite(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    with open(p) as f:
        doc = json.load(f)
    doc["favourite"] = not doc.get("favourite", False)
    with open(p, "w") as f_out:
        json.dump(doc, f_out, indent=2)
    return {"message": "Toggled.", "favourite": doc["favourite"]}

@router.get("/documents/{doc_id}/revisions")
async def get_revisions(doc_id: str):
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

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    p = PROCESSED_DIR / f"{doc_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    p.unlink()
    for f in UPLOAD_DIR.glob(f"{doc_id}_*"):
        f.unlink()
    return {"message": "Deleted.", "id": doc_id}

@router.get("/textbooks")
async def list_textbooks():
    grouped: dict = {}
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

    for tb in grouped.values():
        tb["chapters"].sort(key=lambda c: c.get("chapter_number") or 0)

    return {
        "textbooks": list(grouped.values()),
        "loose": loose,
    }
