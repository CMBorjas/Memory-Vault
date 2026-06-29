import os
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("anti-gravity")

# Paths
BASE_DIR = Path(__file__).parent.parent
DATA_PATH = Path(os.getenv("DATA_PATH", "./data"))
VAULT_PATH = Path(os.getenv("VAULT_PATH", "./vault"))
UPLOAD_DIR = DATA_PATH / "uploads"
PROCESSED_DIR = DATA_PATH / "processed"

# Ensure directories exist
for d in [UPLOAD_DIR, PROCESSED_DIR, VAULT_PATH]:
    d.mkdir(parents=True, exist_ok=True)

CONFIG_PATH = BASE_DIR / "book_config.yml"
STATIC_DIR = BASE_DIR / "static"

# Singletons
from core.engine import MnemonicEngine
from services.exporter import ObsidianExporter
from core.database import init_db

init_db()

engine = MnemonicEngine(CONFIG_PATH)
exporter = ObsidianExporter(VAULT_PATH)

