"""
LLM-based reason generation using OpenAI.
Generates a short Russian-language explanation for a vehicle assignment recommendation.
Falls back to a template-based reason if API key not set or call fails.
"""

import logging
from app.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)


def _template_reason(
    vehicle_name: str,
    distance_km: float,
    eta_minutes: float,
    is_free: bool,
    priority: str,
    score: float,
    compatible: bool,
) -> str:
    """Rule-based fallback reason in Russian."""
    status = "свободна" if is_free else f"освободится через {eta_minutes:.0f} мин"
    compat_str = "" if compatible else " (частичная совместимость по типу работ)"
    prio_map = {"high": "высокий", "medium": "средний", "low": "низкий"}
    prio_str = prio_map.get(priority, priority)
    return (
        f"{vehicle_name}: {status}, расстояние {distance_km:.1f} км, "
        f"ETA {eta_minutes:.0f} мин, приоритет {prio_str}{compat_str}."
    )


def generate_reason(
    vehicle_name: str,
    distance_km: float,
    eta_minutes: float,
    is_free: bool,
    priority: str,
    score: float,
    compatible: bool,
) -> str:
    """
    Generate a one-sentence Russian explanation for the vehicle assignment.
    Uses OpenAI GPT if OPENAI_API_KEY is set, otherwise falls back to template.
    """
    if not OPENAI_API_KEY:
        return _template_reason(vehicle_name, distance_km, eta_minutes, is_free, priority, score, compatible)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        status_str = "свободна" if is_free else "занята (скоро освободится)"
        compat_str = "совместима" if compatible else "частично совместима"
        prio_map = {"high": "высокий", "medium": "средний", "low": "низкий"}

        prompt = (
            f"Обоснуй выбор машины одним коротким предложением на русском языке.\n"
            f"Машина: {vehicle_name}\n"
            f"Статус: {status_str}\n"
            f"Расстояние: {distance_km:.1f} км\n"
            f"ETA: {eta_minutes:.0f} мин\n"
            f"Приоритет заявки: {prio_map.get(priority, priority)}\n"
            f"Совместимость: {compat_str}\n"
            f"Score: {score:.2f}\n"
            f"Напиши только само предложение, без кавычек."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.warning("OpenAI reason generation failed: %s", e)
        return _template_reason(vehicle_name, distance_km, eta_minutes, is_free, priority, score, compatible)
