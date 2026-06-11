import os
import uuid
import json
import logging
from pathlib import Path
from datetime import datetime
import sys

# Since the script is in /app/data, the project root is /app
sys.path.append("/app")

from main import extract_pdf_sections
from engine import MnemonicEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("book_ingestion")

def ingest_directory(directory_path: str, book_name: str, output_filename: str):
    base_dir = Path(directory_path)
    if not base_dir.exists():
        logger.error(f"Directory {base_dir} does not exist.")
        return

    pdf_files = list(base_dir.rglob("*.pdf"))
    pdf_files.sort()  # Sort alphabetically to maintain order

    logger.info(f"Found {len(pdf_files)} PDF files in {base_dir}")

    config_path = Path("/app/book_config.yml")
    engine = MnemonicEngine(config_path)

    all_sections = []
    
    # Process each PDF
    for i, pdf_path in enumerate(pdf_files):
        logger.info(f"Processing ({i+1}/{len(pdf_files)}): {pdf_path.name}")
        try:
            with open("/app/data/progress.json", "w") as f:
                json.dump({
                    "status": "batch",
                    "current_file": i + 1,
                    "total_files": len(pdf_files),
                    "message": f"Batch processing: {pdf_path.name} ({i+1}/{len(pdf_files)})"
                }, f)
        except Exception:
            pass
        try:
            sections = extract_pdf_sections(pdf_path)
            for section in sections:
                # Add source file reference and generate mnemonics
                section["source_file"] = pdf_path.name
                section["mnemonics"] = engine.generate(section, book_name)
            all_sections.extend(sections)
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {e}")

    logger.info(f"Total sections extracted: {len(all_sections)}")

    # Create the document
    doc_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    
    document = {
        "id": doc_id,
        "filename": output_filename,
        "book": book_name,
        "uploaded_at": now,
        "updated_at": now,
        "created_by": "Batch Ingestion Script",
        "section_count": len(all_sections),
        "sections": all_sections,
        "favourite": False,
        "revision": 1,
        "revisions": [{"revision": 1, "timestamp": now, "summary": "Batch import from entire book directory"}],
    }

    processed_dir = Path("/app/data/processed")
    processed_dir.mkdir(parents=True, exist_ok=True)

    output_path = processed_dir / f"{doc_id}.json"
    with open(output_path, "w") as f:
        json.dump(document, f, indent=2)

    try:
        with open("/app/data/progress.json", "w") as f:
            json.dump({"status": "idle"}, f)
    except Exception:
        pass

    logger.info(f"Successfully saved combined document to {output_path} with ID {doc_id}")

if __name__ == "__main__":
    target_dir = "/app/data/uploads/Sybex_comptia-network-study-guide-exam-n10-008"
    ingest_directory(target_dir, book_name="Networking", output_filename="CompTIA Network+ Study Guide (N10-008)")
