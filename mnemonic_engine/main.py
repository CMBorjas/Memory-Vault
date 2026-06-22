"""
Anti-Gravity Mnemonic Engine — FastAPI Application
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import logging

from core.config import STATIC_DIR
from api.routes import gui, system, books, ingest, documents

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("anti-gravity")

app = FastAPI(title="Anti-Gravity Mnemonic Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(gui.router)
app.include_router(system.router)
app.include_router(books.router)
app.include_router(ingest.router)
app.include_router(documents.router)
