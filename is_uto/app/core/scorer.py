"""
Module 7.5 — Candidate scoring formula.

Formula (from IS UTO spec, slide 06):
  score(v_k, j_l) = 1 - [ω_d·(D_kl/D_max) + ω_t·(ETA_kl/ETA_max)
                         + ω_w·(wait_k/wait_max) + ω_p·penalty_SLA(k,l)]

Where:
  ETA_kl    = D_kl / avg_speed_k + wait_k
  wait_k    = max(0, tw_start_l - free_at_k - travel_time_kl)
  penalty_SLA = max(0, ETA_kl - deadline_l) / deadline_l
  deadline_l  = tw_start_l + priority_deadline_minutes[priority]

Weights: ω_d=0.30, ω_t=0.30, ω_w=0.15, ω_p=0.25
"""

from app.config import (
    OMEGA_D, OMEGA_T, OMEGA_W, OMEGA_P,
    PRIORITY_DEADLINE_HOURS,
)


def compute_score(
    distance_m: float,
    travel_time_min: float,
    free_at_min: float,
    tw_start_min: float,
    priority: str,
    d_max: float,
    eta_max: float,
    wait_max: float,
) -> tuple:
    """
    Compute score and intermediate metrics for one vehicle-task candidate.

    Args:
        distance_m:       graph distance vehicle→task destination (metres)
        travel_time_min:  travel time in minutes (distance / avg_speed)
        free_at_min:      minutes until vehicle is free from planning horizon start
        tw_start_min:     time window start for the task (minutes from horizon)
        priority:         'low' / 'medium' / 'high'
        d_max:            normalisation denominator for distance
        eta_max:          normalisation denominator for ETA
        wait_max:         normalisation denominator for wait time

    Returns:
        (score, eta_minutes, wait_minutes, penalty_sla)
    """
    # Time vehicle arrives at destination after it becomes free
    arrival_min = free_at_min + travel_time_min

    # Wait = time the vehicle has to wait before tw_start (idle at destination)
    wait_min = max(0.0, tw_start_min - arrival_min)

    # ETA = total time from now until work starts
    eta_min = arrival_min + wait_min

    # SLA deadline: tw_start + deadline offset
    deadline_min = tw_start_min + PRIORITY_DEADLINE_HOURS[priority] * 60

    if deadline_min > 0:
        penalty_sla = max(0.0, eta_min - deadline_min) / deadline_min
    else:
        penalty_sla = 0.0

    # Normalise each component (clamp to [0,1])
    norm_d = min(1.0, distance_m / d_max) if d_max > 0 else 0.0
    norm_t = min(1.0, eta_min / eta_max) if eta_max > 0 else 0.0
    norm_w = min(1.0, wait_min / wait_max) if wait_max > 0 else 0.0

    raw = OMEGA_D * norm_d + OMEGA_T * norm_t + OMEGA_W * norm_w + OMEGA_P * penalty_sla
    score = max(0.0, 1.0 - raw)

    return round(score, 4), round(eta_min, 2), round(wait_min, 2), round(penalty_sla, 4)


def score_candidates(
    candidates: list,  # list of dicts with keys: vehicle, distance_m, travel_time_min
    tw_start_min: float,
    priority: str,
) -> list:
    """
    Score all candidates and return sorted list (best first).

    Each candidate dict must have:
      - vehicle: VehicleState
      - distance_m: float
      - travel_time_min: float

    Returns list of candidate dicts enriched with:
      - score, eta_minutes, wait_minutes, penalty_sla
    """
    if not candidates:
        return []

    # Compute normalisation denominators across all candidates
    distances = [c["distance_m"] for c in candidates if c["distance_m"] != float("inf")]
    d_max = max(distances) if distances else 1.0

    etas = []
    for c in candidates:
        arr = c["vehicle"].free_at_minutes + c["travel_time_min"]
        wait = max(0.0, tw_start_min - arr)
        etas.append(arr + wait)
    eta_max = max(etas) if etas else 1.0

    waits = []
    for c in candidates:
        arr = c["vehicle"].free_at_minutes + c["travel_time_min"]
        waits.append(max(0.0, tw_start_min - arr))
    wait_max = max(waits) if waits else 1.0

    results = []
    for c in candidates:
        if c["distance_m"] == float("inf"):
            continue
        v = c["vehicle"]
        score, eta_min, wait_min, penalty = compute_score(
            distance_m=c["distance_m"],
            travel_time_min=c["travel_time_min"],
            free_at_min=v.free_at_minutes,
            tw_start_min=tw_start_min,
            priority=priority,
            d_max=d_max,
            eta_max=eta_max,
            wait_max=wait_max,
        )
        results.append({
            **c,
            "score": score,
            "eta_minutes": eta_min,
            "wait_minutes": wait_min,
            "penalty_sla": penalty,
            "is_free": v.free_at_minutes <= 0,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
