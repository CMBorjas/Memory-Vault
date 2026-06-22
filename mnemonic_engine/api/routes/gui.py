from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse
from core.config import STATIC_DIR

router = APIRouter(tags=["gui"])

@router.get("/")
async def serve_gui():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        return JSONResponse({"status": "engine running", "gui": "not found"})
    return FileResponse(str(index_path))
