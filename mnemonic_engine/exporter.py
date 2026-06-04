"""
Anti-Gravity Mnemonic Engine — Obsidian Markdown Exporter

Exports processed documents with mnemonics to Obsidian-compatible
markdown files, matching the format of existing vault notes.
"""
import re
import logging
from pathlib import Path

logger = logging.getLogger("anti-gravity.exporter")


def _normalize_title(title: str) -> str:
    """Normalize whitespace in titles — replaces non-breaking spaces and
    other Unicode whitespace with regular ASCII spaces, then collapses runs."""
    return re.sub(r'\s+', ' ', title).strip()


class ObsidianExporter:
    """Exports processed documents to Obsidian-compatible markdown files."""

    def __init__(self, vault_path: Path):
        self.vault_path = vault_path

    def export(self, document: dict) -> list:
        """
        Export a processed document to the Obsidian vault.
        Creates ONE .md file per document under {book_name}/.
        """
        book = document.get("book", "Uncategorized")
        filename_stem = Path(document.get("filename", "unknown")).stem
        safe_name = re.sub(r'[^\w\s-]', '', filename_stem).strip()

        book_dir = self.vault_path / book
        book_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = book_dir / f"{safe_name}.md"
        
        content = self._render_document(document, filename_stem)
        
        with open(file_path, "w") as f:
            f.write(content)

        relative = str(file_path.relative_to(self.vault_path))
        logger.info(f"Exported: {relative}")

        return [relative]

    def _render_document(self, document: dict, title: str) -> str:
        """Render the entire document and its sections into a single markdown string."""
        book = document.get("book", "Uncategorized")
        sections = document.get("sections", [])
        
        tags = [book.lower().replace(" ", "_"), "study", "mnemonic"]
        
        lines = [
            "---",
            f"tags: [{', '.join(tags)}]",
            "status: learning",
            "mnemonic_type: grotesque",
            f"created_at: {document.get('uploaded_at', 'unknown')}",
            "---",
            "",
            f"# {title}",
            "",
            f"> [!info] 📚 **Book:** {book} | **Sections:** {len(sections)}",
            "",
            "---",
            ""
        ]
        
        for index, section in enumerate(sections):
            sec_title = _normalize_title(section.get("title", f"Section {index+1}"))
            sec_content = section.get("content", "")
            mnemonics = section.get("mnemonics", {})
            page = section.get("page", "?")
            key_terms = section.get("key_terms", [])
            
            lines.append(f"## {sec_title}")
            lines.append(f"> *(Page: {page})*")
            
            # Content lines
            for line in sec_content.strip().split("\n"):
                line = line.strip()
                if line:
                    lines.append(f"> {line}")
                    
            if key_terms:
                lines.append(">")
                lines.append(f"> **Key Terms:** {', '.join(key_terms)}")
                
            lines.append("")
            
            # Memory Anchor
            acronym = mnemonics.get("acronym", sec_title)
            visual = mnemonics.get("visual_anchor", "")
            scent = mnemonics.get("scent_anchor", "")
            logic = mnemonics.get("logic_link", "")
            kingdom = mnemonics.get("kingdom", "")
            
            lines.extend([
                f"> [!abstract] 🧠 Memory Anchor: {acronym}",
                f"> **Kingdom:** {kingdom}",
                "> ",
                "> **The Imagery:**",
                f"> {visual}",
                "> ",
                "> **The Scent Anchor:**",
                f"> {scent}",
                "> ",
                "> **The Logic:**",
                f"> {logic}",
                "",
                "---",
                ""
            ])
            
        return "\n".join(lines) + "\n"
