import yaml
from fastapi import APIRouter, HTTPException
from core.config import CONFIG_PATH, engine, logger

router = APIRouter(prefix="/api/books", tags=["books"])

@router.get("")
async def list_books():
    books = engine.config.get("books", {})
    return {name: {k: v for k, v in p.items() if k != "visual_keywords"} for name, p in books.items()}

@router.put("/{book_name}")
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

    # Preserve the nice header comment
    header = """# ╔══════════════════════════════════════════════════════════════╗
# ║  Anti-Gravity Knowledge Engine — Book Configuration        ║
# ║  Each book/module is assigned a biological kingdom and     ║
# ║  sensory profile to prevent "memory bleeding" between      ║
# ║  subjects. Mnemonics are generated using these anchors.    ║
# ╚══════════════════════════════════════════════════════════════╝

"""
    try:
        with open(CONFIG_PATH, "w") as f:
            f.write(header)
            yaml.dump(engine.config, f, sort_keys=False, default_flow_style=False)
    except Exception as e:
        logger.error(f"Failed to save book_config.yml: {e}")
        raise HTTPException(status_code=500, detail="Failed to save configuration")

    return {"message": "Profile updated successfully", "profile": current_profile}
