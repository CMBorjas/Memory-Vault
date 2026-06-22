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
        Creates one .md file per section under {book_name}/{filename}/.
        """
        book = document.get("book", "Uncategorized")
        filename_stem = Path(document.get("filename", "unknown")).stem
        
        # Determine folder name: default to filename, but override if a Chapter heading exists
        folder_name = re.sub(r'[^\w\s-]', '', filename_stem).strip()
        for sec in document.get("sections", []):
            title = sec.get("title", "")
            if re.match(r"(?i)^Chapter\s+\d+", title):
                folder_name = _normalize_title(title)
                break

        export_dir = self.vault_path / book / folder_name
        export_dir.mkdir(parents=True, exist_ok=True)

        exported = []

        for i, section in enumerate(document.get("sections", [])):
            title = _normalize_title(section.get("title", f"Section {i+1}"))
            safe_title = re.sub(r'[^\w\s-]', '', title).strip()[:60]
            
            file_name = f"{i+1:02d} - {safe_title}.md"
            file_path = export_dir / file_name

            content = self._render_section(section, document, i)

            with open(file_path, "w") as f:
                f.write(content)

            relative = str(file_path.relative_to(self.vault_path))
            exported.append(relative)
            logger.info(f"Exported: {relative}")

        # Create an index file for the document
        index_path = export_dir / f"_index.md"
        index_content = self._render_index(document, exported)
        with open(index_path, "w") as f:
            f.write(index_content)
        exported.append(str(index_path.relative_to(self.vault_path)))

        return exported

    def _render_section(self, section: dict, document: dict, index: int) -> str:
        """Render a single section as an Obsidian markdown note."""
        title = _normalize_title(section.get("title", "Untitled"))
        content = section.get("content", "")
        mnemonics = section.get("mnemonics", {})
        page = section.get("page", "?")
        key_terms = section.get("key_terms", [])
        book = document.get("book", "Uncategorized")
        doc_filename_stem = Path(document.get("filename", "unknown")).stem
        
        sections = document.get("sections", [])
        
        # Navigation
        prev_link = ""
        if index > 0:
            prev_title = _normalize_title(sections[index - 1].get("title", f"Section {index}"))
            prev_safe = re.sub(r'[^\w\s-]', '', prev_title).strip()[:60]
            prev_link = f"[[{index:02d} - {prev_safe}|← Previous]]"
            
        next_link = ""
        if index < len(sections) - 1:
            next_title = _normalize_title(sections[index + 1].get("title", f"Section {index + 2}"))
            next_safe = re.sub(r'[^\w\s-]', '', next_title).strip()[:60]
            next_link = f"[[{index+2:02d} - {next_safe}|Next →]]"
            
        nav_elements = [link for link in [prev_link, next_link] if link]
        nav_bar = " | ".join(nav_elements)

        tags = [book.lower().replace(" ", "_"), "study", "mnemonic"]
        if section.get("user_edited"):
            tags.append("user-edited")

        lines = [
            "---",
            f"tags: [{', '.join(tags)}]",
            "status: learning",
            "mnemonic_type: grotesque",
            f"source_page: {page}",
            f"created_at: {document.get('uploaded_at', 'unknown')}",
            "---",
            "",
            f"> [!info] 📚 **Book:** [[_index|{doc_filename_stem}]]",
            f"> **Chapter:** {title} | **Page:** {page}",
            "",
            f"# {title}",
            "",
        ]

        # Add content
        for line in content.strip().split("\n"):
            line = line.strip()
            if line:
                lines.append(f"> {line}")

        # Add key terms if present
        if key_terms:
            lines.append(">")
            lines.append(f"> **Key Terms:** {', '.join(key_terms)}")

        lines.append("")
        lines.append("---")
        lines.append("")

        # Memory Anchor callout
        acronym = mnemonics.get("acronym", title)
        visual = mnemonics.get("visual_anchor", "")
        scent = mnemonics.get("scent_anchor", "")
        logic = mnemonics.get("logic_link", "")
        kingdom = mnemonics.get("kingdom", "")

        lines.extend([
            f"> [!abstract]- 🧠 Memory Anchor: {acronym}",
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
            "",
            f"*{nav_bar}*",
        ])

        return "\n".join(lines) + "\n"

    def _render_index(self, document: dict, exported_files: list) -> str:
        """Render an index file linking all sections."""
        title = Path(document.get("filename", "unknown")).stem
        book = document.get("book", "Uncategorized")

        lines = [
            "---",
            f"tags: [{book.lower().replace(' ', '_')}, index]",
            "---",
            "",
            f"# {title}",
            "",
            f"**Book:** {book}",
            f"**Sections:** {document.get('section_count', 0)}",
            f"**Imported:** {document.get('uploaded_at', 'unknown')}",
            "",
            "## Sections",
            "",
        ]

        for i, section in enumerate(document.get("sections", [])):
            safe = re.sub(r'[^\w\s-]', '', _normalize_title(section["title"])).strip()[:60]
            lines.append(f"- [[{i+1:02d} - {safe}]]")

        return "\n".join(lines) + "\n"
