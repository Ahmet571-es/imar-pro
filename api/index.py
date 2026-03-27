"""
Vercel serverless entry point — FastAPI app'i import eder.
"""
import sys
from pathlib import Path

# Backend dizinini Python path'e ekle
backend_dir = str(Path(__file__).parent.parent / "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app  # noqa: E402

# Vercel bu değişkeni kullanır
handler = app
