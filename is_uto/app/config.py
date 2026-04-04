import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "95.47.96.41")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "mock_uto")
DB_USER = os.getenv("DB_USER", "readonly_user")
DB_PASS = os.getenv("DB_PASS", "Eh092P72se.)")

# Average vehicle speed (km/h) used for ETA calculation
AVG_SPEED_KMH = float(os.getenv("AVG_SPEED_KMH", 40.0))
AVG_SPEED_MS = AVG_SPEED_KMH * 1000 / 3600  # m/s

# Scoring formula weights (must sum to 1.0)
OMEGA_D = 0.30  # distance weight
OMEGA_T = 0.30  # ETA weight
OMEGA_W = 0.15  # idle wait weight
OMEGA_P = 0.25  # SLA penalty weight

# Priority config
PRIORITY_WEIGHTS = {"high": 0.55, "medium": 0.35, "low": 0.10}
PRIORITY_DEADLINE_HOURS = {"high": 2, "medium": 5, "low": 12}

# Shift time rules
SHIFT_RULES = {
    "day":   {"start": 8,  "end": 20},  # 08:00–20:00
    "night": {"start": 20, "end": 32},  # 20:00–08:00 next day (as 32h)
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Tasks CSV path
TASKS_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "tasks.csv")
COMPATIBILITY_JSON = os.path.join(os.path.dirname(__file__), "..", "data", "compatibility.json")

# Planning horizon start (fixed reference point for all time calculations)
# All times (free_at, tw_start, etc.) are in minutes offset from this datetime.
from datetime import datetime as _dt
PLANNING_HORIZON_START = _dt(2025, 2, 20, 8, 0, 0)
PLANNING_HORIZON_START_MIN = PLANNING_HORIZON_START.timestamp() / 60.0
