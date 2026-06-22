import json
from fastapi import APIRouter
from core.config import DATA_PATH, engine

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/progress")
async def get_progress():
    p = DATA_PATH / "progress.json"
    if p.exists():
        try:
            with open(p) as f:
                return json.load(f)
        except Exception:
            pass
    return {"status": "idle"}

@router.get("/health")
async def health():
    return {"status": "alive", "version": "0.1.0", "books_loaded": list(engine.config.get("books", {}).keys())}
