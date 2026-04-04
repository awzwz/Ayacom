"""
Generates mock tasks CSV and compatibility JSON from real DB data.

Run once to produce:
  data/tasks.csv
  data/compatibility.json

Usage:
  python -m app.data.mock_generator
"""

import csv
import json
import os
import random
from datetime import datetime, timedelta

from app.data.db import DBConn

SEED = 42
random.seed(SEED)

TASKS_CSV = os.path.join(os.path.dirname(__file__), "../../data/tasks.csv")
COMPATIBILITY_JSON = os.path.join(os.path.dirname(__file__), "../../data/compatibility.json")
NUM_TASKS = 70


def fetch_valid_uwis() -> list[str]:
    """Fetch wells with valid (non-null) coordinates."""
    with DBConn() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT uwi FROM "references".wells '
            "WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
        )
        return [r[0] for r in cur.fetchall()]


def fetch_work_types() -> list[dict]:
    """Fetch work type codes and names from dct."""
    with DBConn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT e.code, e.short_name
            FROM dct.elements e
            JOIN dct.dictionaries d ON e.dictionary_id = d.id
            WHERE d.code = 'TRS_WTYPE' AND e.active = TRUE AND e.code IS NOT NULL
            LIMIT 30
            """
        )
        return [{"code": r[0], "name": r[1]} for r in cur.fetchall()]


def fetch_vehicle_types() -> list[dict]:
    """Fetch vehicle type codes and names from dct."""
    with DBConn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT e.code, e.short_name
            FROM dct.elements e
            JOIN dct.dictionaries d ON e.dictionary_id = d.id
            WHERE d.code = 'TRS_VEHKIND' AND e.active = TRUE AND e.code IS NOT NULL
            LIMIT 30
            """
        )
        return [{"code": r[0], "name": r[1]} for r in cur.fetchall()]


def generate_compatibility(
    vehicle_types: list[dict], work_types: list[dict]
) -> dict[str, list[str]]:
    """
    Generate a compatibility dict: vehicle_type_code → list of compatible work_type_codes.
    Each vehicle type gets a random subset of 30–70% of work types.
    """
    work_codes = [wt["code"] for wt in work_types]
    compat = {}
    for vt in vehicle_types:
        k = max(1, int(len(work_codes) * random.uniform(0.3, 0.7)))
        compat[vt["code"]] = random.sample(work_codes, k)
    return compat


def generate_tasks(valid_uwis: list[str], work_types: list[dict]) -> list[dict]:
    """Generate NUM_TASKS mock task records."""
    work_codes = [wt["code"] for wt in work_types]
    base_date = datetime(2025, 2, 20, 8, 0)

    priority_choices = (
        ["high"] * 2 + ["medium"] * 3 + ["low"] * 1
    )
    shift_choices = ["day", "day", "night"]

    tasks = []
    for i in range(NUM_TASKS):
        shift = random.choice(shift_choices)
        priority = random.choice(priority_choices)
        start_offset_h = random.randint(0, 24)
        planned_start = base_date + timedelta(hours=start_offset_h)
        # Align start to shift
        if shift == "day":
            planned_start = planned_start.replace(hour=8, minute=0, second=0)
        else:
            planned_start = planned_start.replace(hour=20, minute=0, second=0)

        duration = round(random.uniform(1.0, 8.0), 1)

        tasks.append({
            "task_id": f"T-2025-{i:04d}",
            "priority": priority,
            "planned_start": planned_start.strftime("%Y-%m-%dT%H:%M:%S"),
            "planned_duration_hours": duration,
            "destination_uwi": random.choice(valid_uwis),
            "task_type": random.choice(work_codes),
            "shift": shift,
            "start_day": planned_start.strftime("%Y-%m-%d"),
        })
    return tasks


def save_tasks_csv(tasks: list[dict], path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fieldnames = [
        "task_id", "priority", "planned_start", "planned_duration_hours",
        "destination_uwi", "task_type", "shift", "start_day",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(tasks)
    print(f"Saved {len(tasks)} tasks to {path}")


def save_compatibility_json(compat: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(compat, f, ensure_ascii=False, indent=2)
    print(f"Saved compatibility dict ({len(compat)} vehicle types) to {path}")


if __name__ == "__main__":
    print("Fetching reference data from DB...")
    valid_uwis = fetch_valid_uwis()
    work_types = fetch_work_types()
    vehicle_types = fetch_vehicle_types()
    print(f"  Wells with coords: {len(valid_uwis)}")
    print(f"  Work types: {len(work_types)}")
    print(f"  Vehicle types: {len(vehicle_types)}")

    compat = generate_compatibility(vehicle_types, work_types)
    tasks = generate_tasks(valid_uwis, work_types)

    save_tasks_csv(tasks, TASKS_CSV)
    save_compatibility_json(compat, COMPATIBILITY_JSON)
    print("Done.")
