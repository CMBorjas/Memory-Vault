import uuid
import json
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from core.config import UPLOAD_DIR, PROCESSED_DIR, DATA_PATH, engine, logger
from core.pdf_extractor import extract_pdf_sections

router = APIRouter(prefix="/api", tags=["ingest"])

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

SYBEX_TEXTBOOK_ID    = "sybex-n10-008"
SYBEX_TEXTBOOK_TITLE = "CompTIA Network+ Study Guide (Exam N10-008)"
SYBEX_TEXTBOOK_SHORT = "Sybex Network+ N10-008"
SYBEX_PUBLISHER      = "Sybex / Todd Lammle"
SYBEX_CHAPTERS_BASE = DATA_PATH / "uploads" / "Sybex_comptia-network-study-guide-exam-n10-008" / "Contents" / "004_Chapters"


@router.post("/upload")
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
            "mnemonics": engine.generate_chapter(file.filename, book),
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


@router.post("/ingest-local")
async def ingest_local_chapters(book: str = "Networking", start: int = 1, end: int = 25):
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
                # Canonical display fields
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
                "mnemonics": engine.generate_chapter(chapter_title or canonical_name, book),
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
