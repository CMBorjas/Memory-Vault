import json
import os
import sys
import re
sys.path.append("/home/hyro_antares/Documents/Repositories/Projects/Memory Vault")
from mnemonic_engine.services.exporter import ObsidianExporter, _normalize_title
from pathlib import Path

exporter = ObsidianExporter(Path("vault"))
processed = Path("data/processed")
vault_networking = Path("vault/Networking")

def get_existing_dir(chapter_num):
    prefix = f"Chapter {chapter_num:02d} -"
    for d in vault_networking.iterdir():
        if d.is_dir() and d.name.startswith(prefix):
            return d
    return None

class SafeExporter(ObsidianExporter):
    def export_chapter(self, document: dict, target_dir: Path) -> list:
        exported = []
        for i, section in enumerate(document.get("sections", [])):
            title = _normalize_title(section.get("title", f"Section {i+1}"))
            safe_title = re.sub(r'[^\w\s-]', '', title).strip()[:60]
            
            file_name = f"{i+1:02d} - {safe_title}.md"
            file_path = target_dir / file_name

            if not file_path.exists():
                content = self._render_section(section, document, i)
                with open(file_path, "w") as f:
                    f.write(content)
                relative = str(file_path.relative_to(self.vault_path))
                exported.append(relative)
                print(f"Exported: {relative}")
            else:
                pass # print(f"Skipped existing: {file_path.name}")

        index_path = target_dir / "_index.md"
        overwrite_index = False
        if index_path.exists():
            with open(index_path, "r") as f:
                if "under-construction" in f.read():
                    overwrite_index = True
        else:
            overwrite_index = True
            
        if overwrite_index:
            index_content = self._render_index(document, exported)
            with open(index_path, "w") as f:
                f.write(index_content)
            print(f"Updated index: {index_path}")
        else:
            print(f"Skipped existing index: {index_path}")
        return exported

safe_exp = SafeExporter(Path("vault"))

for chapter in [1, 2, 3, 4, 5]:
    target_dir = get_existing_dir(chapter)
    if not target_dir:
        print(f"Could not find target dir for chapter {chapter}")
        continue
    
    for f in processed.glob("*.json"):
        with open(f, "r") as json_file:
            data = json.load(json_file)
        if data.get("book") == "Networking" and data.get("chapter_number") == chapter:
            print(f"\nProcessing Chapter {chapter}...")
            safe_exp.export_chapter(data, target_dir)
