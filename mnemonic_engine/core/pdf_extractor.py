import json
import re
import logging
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF
from core.config import DATA_PATH

logger = logging.getLogger("anti-gravity.pdf")

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
