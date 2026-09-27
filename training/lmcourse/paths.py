from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
"""Repository root."""

TRAINING = ROOT / "training"
DATA = TRAINING / "data"
FIXTURES = TRAINING / "fixtures"
COURSE_STATIC_DATA = ROOT / "course" / "static" / "data"
