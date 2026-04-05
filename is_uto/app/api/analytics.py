"""
GET /api/analytics/business-case — compute baseline vs optimized routing metrics
and generate an investor-ready AI narrative for the pitch.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import (
    AVG_SPEED_KMH,
    FUEL_RATE_L_PER_100KM,
    DIESEL_PRICE_KZT,
    CO2_KG_PER_LITER,
    DRIVER_COST_KZT_PER_HOUR,
    OPENAI_API_KEY,
)
from app.core.fleet_state import VehicleState
from app.core.shortest_path import build_cost_matrix, distance_m, time_minutes
from app.data.loaders import TaskRecord

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Baseline: naive greedy (closest free vehicle, no grouping, each task = separate trip)
# ---------------------------------------------------------------------------

def compute_baseline(
    tasks: list[TaskRecord],
    fleet: dict[int, VehicleState],
) -> dict:
    if not tasks or not fleet:
        return {"distance_km": 0, "time_hours": 0, "trips": 0, "fuel_liters": 0, "cost_kzt": 0}

    vehicles = list(fleet.values())
    sorted_tasks = sorted(tasks, key=lambda t: t.planned_start)

    valid_tasks = [t for t in sorted_tasks if t.dest_node and t.dest_node != 0]
    if not valid_tasks:
        return {"distance_km": 0, "time_hours": 0, "trips": 0, "fuel_liters": 0, "cost_kzt": 0}

    source_nodes = list({v.start_node for v in vehicles})
    dest_nodes = list({t.dest_node for t in valid_tasks})
    all_nodes = list(set(source_nodes + dest_nodes))
    matrix = build_cost_matrix(all_nodes, all_nodes)

    total_distance_m = 0.0
    total_time_min = 0.0
    trips = 0

    for task in valid_tasks:
        best_dist = float("inf")
        best_time = float("inf")
        for v in vehicles:
            d = distance_m(v.start_node, task.dest_node, matrix)
            if d < best_dist:
                best_dist = d
                best_time = time_minutes(v.start_node, task.dest_node, matrix)
        if best_dist < float("inf"):
            total_distance_m += best_dist
            total_time_min += best_time
            trips += 1

    dist_km = total_distance_m / 1000
    time_h = total_time_min / 60
    fuel = dist_km * FUEL_RATE_L_PER_100KM / 100
    cost = fuel * DIESEL_PRICE_KZT + time_h * DRIVER_COST_KZT_PER_HOUR

    return {
        "distance_km": round(dist_km, 2),
        "time_hours": round(time_h, 2),
        "trips": trips,
        "fuel_liters": round(fuel, 2),
        "cost_kzt": round(cost, 0),
    }


# ---------------------------------------------------------------------------
# Optimized: OR-Tools batch + Clarke-Wright grouping
# ---------------------------------------------------------------------------

def compute_optimized(tasks: list[TaskRecord]) -> dict:
    from app.core.optimizer import evaluate_grouping

    valid_tasks = [t for t in tasks if t.dest_node and t.dest_node != 0]
    if not valid_tasks:
        return {
            "distance_km": 0, "time_hours": 0, "trips": 0,
            "groups": 0, "fuel_liters": 0, "cost_kzt": 0,
        }

    # OR-Tools batch may fail on edge-case time windows — fall back to grouping only
    batch_result = None
    try:
        from app.core.optimizer import optimize_batch
        batch_result = optimize_batch(valid_tasks, time_limit_seconds=15)
    except Exception as e:
        logger.warning("optimize_batch failed, using grouping only: %s", e)

    grouping_result = evaluate_grouping(valid_tasks)

    if batch_result and batch_result.get("assignments"):
        opt_dist_km = batch_result.get("total_distance_km", 0.0)
        assignments = batch_result.get("assignments", [])
        opt_time_h = opt_dist_km / AVG_SPEED_KMH
        trips = len(assignments)
    else:
        opt_dist_km = grouping_result.total_distance_km
        opt_time_h = opt_dist_km / AVG_SPEED_KMH
        trips = sum(len(g) for g in grouping_result.groups)

    fuel = opt_dist_km * FUEL_RATE_L_PER_100KM / 100
    cost = fuel * DIESEL_PRICE_KZT + opt_time_h * DRIVER_COST_KZT_PER_HOUR

    return {
        "distance_km": round(opt_dist_km, 2),
        "time_hours": round(opt_time_h, 2),
        "trips": trips,
        "groups": len(grouping_result.groups),
        "fuel_liters": round(fuel, 2),
        "cost_kzt": round(cost, 0),
    }


# ---------------------------------------------------------------------------
# Savings delta + annual projections
# ---------------------------------------------------------------------------

def compute_savings(baseline: dict, optimized: dict) -> dict:
    km_saved = baseline["distance_km"] - optimized["distance_km"]
    hours_saved = baseline["time_hours"] - optimized["time_hours"]

    km_saved = max(km_saved, 0)
    hours_saved = max(hours_saved, 0)

    fuel_saved = km_saved * FUEL_RATE_L_PER_100KM / 100
    cost_saved = fuel_saved * DIESEL_PRICE_KZT + hours_saved * DRIVER_COST_KZT_PER_HOUR
    co2_saved = fuel_saved * CO2_KG_PER_LITER

    base_km = baseline["distance_km"]
    pct = (km_saved / base_km * 100) if base_km > 0 else 0

    return {
        "distance_km": round(km_saved, 2),
        "distance_pct": round(pct, 1),
        "time_hours": round(hours_saved, 2),
        "fuel_liters": round(fuel_saved, 2),
        "cost_kzt": round(cost_saved, 0),
        "co2_kg": round(co2_saved, 2),
        "annual_cost_kzt": round(cost_saved * 365, 0),
        "annual_co2_tons": round(co2_saved * 365 / 1000, 2),
    }


# ---------------------------------------------------------------------------
# AI narrative for investor pitch
# ---------------------------------------------------------------------------

def _template_narrative(savings: dict, meta: dict) -> str:
    return (
        f"Система IS УТО на месторождении {meta['field_name']} обеспечивает сокращение пробега "
        f"спецтехники на {savings['distance_pct']:.0f}%, что эквивалентно "
        f"{savings['fuel_liters']:.0f} литрам дизельного топлива в день. "
        f"Годовая экономия составляет {savings['annual_cost_kzt']:,.0f} ₸, "
        f"а выбросы CO₂ снижаются на {savings['annual_co2_tons']:.1f} тонн в год. "
        f"При масштабировании на другие месторождения эффект увеличивается кратно числу "
        f"обслуживаемых объектов."
    )


def generate_pitch_narrative(savings: dict, meta: dict) -> str:
    if not OPENAI_API_KEY:
        return _template_narrative(savings, meta)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        prompt = (
            "Ты — аналитик нефтегазовой отрасли. Напиши 4-5 предложений для инвестиционного питча "
            "на русском языке. Текст должен быть уверенным, с конкретными цифрами, "
            "в стиле PetroCouncil Startup Challenge 2026.\n\n"
            "Контекст:\n"
            f"- Месторождение: {meta['field_name']}\n"
            f"- Количество задач в день: {meta['tasks_count']}\n"
            f"- Единиц техники: {meta['vehicles_count']}\n"
            f"- Сокращение пробега: {savings['distance_pct']:.1f}% ({savings['distance_km']:.1f} км/день)\n"
            f"- Экономия топлива: {savings['fuel_liters']:.1f} л/день\n"
            f"- Экономия затрат: {savings['cost_kzt']:,.0f} ₸/день\n"
            f"- Снижение CO₂: {savings['co2_kg']:.1f} кг/день\n"
            f"- Годовая экономия: {savings['annual_cost_kzt']:,.0f} ₸\n"
            f"- Годовое снижение CO₂: {savings['annual_co2_tons']:.1f} тонн\n\n"
            "Требования:\n"
            "1. Начни с конкретного результата (цифра экономии)\n"
            "2. Упомяни три аспекта: операционная эффективность, снижение затрат, ESG/экология\n"
            "3. Закончи аргументом масштабируемости: эффект на одном месторождении → "
            "на N месторождениях компании\n"
            "4. Не используй слова 'наш', 'мы', используй 'система IS УТО'\n"
            "5. Напиши только сам текст, без заголовков и кавычек"
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=350,
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.warning("OpenAI narrative generation failed: %s", e)
        return _template_narrative(savings, meta)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/analytics/business-case")
def business_case(request: Request):
    app = request.app
    if not getattr(app.state, "ready", False):
        raise HTTPException(503, "System is still loading data")

    tasks: list[TaskRecord] = getattr(app.state, "tasks", [])
    fleet: dict[int, VehicleState] = getattr(app.state, "fleet", {})

    if not tasks:
        raise HTTPException(404, "No tasks loaded")

    baseline = compute_baseline(tasks, fleet)
    optimized = compute_optimized(tasks)
    savings = compute_savings(baseline, optimized)

    meta = {
        "tasks_count": len(tasks),
        "vehicles_count": len(fleet),
        "field_name": "Жетыбай",
        "calculation_date": datetime.now().isoformat(timespec="seconds"),
    }

    narrative = generate_pitch_narrative(savings, meta)

    return {
        "baseline": baseline,
        "optimized": optimized,
        "savings": savings,
        "meta": meta,
        "narrative": narrative,
    }


# ---------------------------------------------------------------------------
# Chat assistant
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict | None = None


def _build_system_prompt(ctx: dict) -> str:
    b = ctx.get("baseline", {})
    o = ctx.get("optimized", {})
    s = ctx.get("savings", {})
    m = ctx.get("meta", {})
    return (
        "Ты — AI-аналитик системы IS УТО (интеллектуальная маршрутизация спецтехники). "
        "Отвечай на русском языке, кратко и по существу. Используй конкретные числа из данных.\n\n"
        "МЕТОДОЛОГИЯ:\n"
        "- Baseline: наивное назначение ближайшей свободной машины без группировки задач. "
        "Для каждой заявки выбирается ближайшее ТС по дорожному графу (Dijkstra). "
        "Каждая задача — отдельный рейс.\n"
        "- Оптимизированный: OR-Tools VRPTW (Vehicle Routing Problem with Time Windows) "
        "для пакетного назначения + алгоритм Clarke-Wright savings для группировки задач "
        "в мультистоповые маршруты.\n"
        "- Дорожный граф: 4624 узла, 19031 ребро, реальная дорожная сеть месторождения.\n\n"
        "КОНСТАНТЫ (отраслевые средние, Казахстан):\n"
        f"- Расход топлива: {FUEL_RATE_L_PER_100KM} л/100км (тяжёлая спецтехника)\n"
        f"- Цена дизеля: {DIESEL_PRICE_KZT} ₸/литр (Q1 2026)\n"
        f"- Коэффициент CO₂: {CO2_KG_PER_LITER} кг на литр дизеля\n"
        f"- Стоимость водителя: {DRIVER_COST_KZT_PER_HOUR} ₸/час\n\n"
        "ДАННЫЕ БИЗНЕС-КЕЙСА:\n"
        f"- Месторождение: {m.get('field_name', 'Жетыбай')}\n"
        f"- Машин: {m.get('vehicles_count', '?')}, Задач: {m.get('tasks_count', '?')}\n"
        f"- Baseline: {b.get('distance_km', '?')} км, {b.get('time_hours', '?')} ч, "
        f"{b.get('fuel_liters', '?')} л, {b.get('cost_kzt', '?')} ₸\n"
        f"- Оптимизированный: {o.get('distance_km', '?')} км, {o.get('time_hours', '?')} ч, "
        f"{o.get('fuel_liters', '?')} л, {o.get('cost_kzt', '?')} ₸, "
        f"{o.get('groups', '?')} групп маршрутов\n"
        f"- Экономия: {s.get('distance_km', '?')} км ({s.get('distance_pct', '?')}%), "
        f"{s.get('fuel_liters', '?')} л, {s.get('cost_kzt', '?')} ₸/день, "
        f"{s.get('co2_kg', '?')} кг CO₂/день\n"
        f"- Годовая экономия: {s.get('annual_cost_kzt', '?')} ₸\n"
        f"- Годовое снижение CO₂: {s.get('annual_co2_tons', '?')} тонн\n\n"
        "ФОРМУЛЫ:\n"
        "- Экономия топлива = (baseline_km - opt_km) × расход / 100\n"
        "- Экономия стоимости = топливо_сэкономлено × цена_дизеля + часы_сэкономлены × ставка_водителя\n"
        "- CO₂ = топливо_сэкономлено × коэффициент_CO₂\n"
        "- Годовая проекция = дневная_экономия × 365\n"
    )


@router.post("/analytics/chat")
def analytics_chat(req: ChatRequest):
    if not OPENAI_API_KEY:
        return {"reply": "OpenAI API ключ не настроен. Чат недоступен."}

    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        system_prompt = _build_system_prompt(req.context or {})

        messages = [{"role": "system", "content": system_prompt}]
        for msg in req.messages:
            messages.append({"role": msg.role, "content": msg.content})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=500,
            temperature=0.3,
        )
        reply = response.choices[0].message.content.strip()
        return {"reply": reply}

    except Exception as e:
        logger.warning("Analytics chat failed: %s", e)
        return {"reply": f"Ошибка при обработке запроса: {e}"}
