# IS УТО — Интеллектуальная система маршрутизации спецтехники

Прототип REST API для автоматического назначения спецтехники на заявки нефтяного месторождения Жетыбай.  
Задача: Multi-Depot VRPTW (Vehicle Routing Problem with Time Windows).

---

## Быстрый старт

```bash
# 1. Установить зависимости
pip install -r requirements.txt

# 2. Сгенерировать mock-данные (задачи + словарь совместимости)
python -m app.data.mock_generator

# 3. Запустить сервер
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Swagger UI
open http://localhost:8000/docs
```

---

## Архитектура

```
DB (PostgreSQL) ──► graph_loader.py  ──► NetworkX DiGraph + KDTree
                      road_nodes (4624)
                      road_edges (19031)

                 ──► fleet_state.py   ──► 126 VehicleState objects
                      wialon_snapshots

                 ──► loaders.py       ──► wells (3293), tasks (70)
                      wells / tasks.csv

VehicleState + TaskRecord ──► optimizer.py ──► recommendations / routes / groupings
```

**Модули:**
| Файл | Назначение |
|---|---|
| `core/graph_loader.py` | Загрузка графа дорог, KDTree, snap_to_node() |
| `core/shortest_path.py` | Dijkstra + матрица расстояний и времён |
| `core/fleet_state.py` | Состояние парка (126 машин из Wialon) |
| `core/scorer.py` | Формула скоринга кандидатов |
| `core/optimizer.py` | Жадный алгоритм, Clarke-Wright, OR-Tools VRPTW |
| `core/llm_reason.py` | OpenAI GPT для текстовых обоснований |
| `visualization/map_viz.py` | Folium интерактивные карты |

---

## API Endpoints

### POST /api/recommendations
Рекомендует топ-3 единицы техники для выполнения заявки.

**Запрос:**
```json
{
  "task_id": "T-2025-0042",
  "priority": "high",
  "destination_uwi": "ASA_0003",
  "planned_start": "2025-02-20T08:00:00",
  "duration_hours": 4.5,
  "shift": "day",
  "task_type": "103"
}
```

**Ответ:**
```json
{
  "task_id": "T-2025-0042",
  "destination_uwi": "ASA_0003",
  "dest_node": 4027,
  "units": [
    {
      "wialon_id": 28996027,
      "name": "BPA_Daewoo BH-120F GDW 834ZX12",
      "eta_minutes": 26.51,
      "distance_km": 17.67,
      "score": 0.969,
      "reason": "Ближайшая свободная машина, ETA 27 мин.",
      "is_free": true,
      "compatible": true
    }
  ]
}
```

**Формула скоринга:**
```
score = 1 - (0.30·D/Dmax + 0.30·ETA/ETAmax + 0.15·wait/waitmax + 0.25·penalty_SLA)
```

---

### POST /api/route
Строит кратчайший маршрут по графу дорог.

**Запрос:**
```json
{
  "from_location": {"wialon_id": 28996027},
  "to_location": {"uwi": "ASA_0003"}
}
```

**Ответ:**
```json
{
  "distance_km": 17.675,
  "time_minutes": 26.51,
  "nodes": [3947, 3950, "..."],
  "coords": [[56.259, 46.528], "..."],
  "from_node": 3947,
  "to_node": 4027
}
```

---

### POST /api/multitask
Clarke-Wright savings — оценка целесообразности объединения заявок.

**Запрос:**
```json
{
  "task_ids": ["T-2025-0001", "T-2025-0002", "T-2025-0003"],
  "constraints": {
    "max_total_time_minutes": 480,
    "max_detour_ratio": 1.3
  }
}
```

**Ответ:**
```json
{
  "groups": [["T-2025-0001", "T-2025-0003"], ["T-2025-0002"]],
  "strategy_summary": "mixed",
  "total_distance_km": 41.2,
  "baseline_distance_km": 56.8,
  "savings_percent": 27.5,
  "reason": "Заявки T-2025-0001, T-2025-0003 объединены..."
}
```

---

### POST /api/batch
OR-Tools VRPTW — пакетное назначение техники на все заявки.

**Запрос:**
```json
{
  "task_ids": ["T-2025-0001", "T-2025-0002", "T-2025-0003"],
  "time_limit_seconds": 30
}
```

---

### GET /api/map/route?from_node=0&to_node=100
Возвращает HTML Folium-карту маршрута.

### GET /api/map/fleet
Возвращает HTML Folium-карту всех машин и заявок.

### GET /api/tasks?priority=high&limit=20
Список загруженных заявок.

### GET /api/fleet?limit=20
Список машин с их состоянием.

### GET /health
Статус сервиса.

---

## Технические детали

### База данных (PostgreSQL)
- `"references".road_nodes` — 4,624 узлов (lon 55–57, lat 46–48)
- `"references".road_edges` — 19,031 рёбер, **направленный граф**, веса в метрах
- `"references".wells` — 3,293 скважины с координатами
- `"references".wialon_units_snapshot_1/2/3` — 126 единиц техники

### Примечание о координатах
Координаты Wialon (pos_x ~59–60, pos_y ~49–51) используют другую систему анонимизации, чем граф дорог (lon 55–57, lat 46–48). В прототипе каждая машина детерминистически привязывается к узлу графа через `hash(wialon_id) % len(nodes)`.

### Алгоритмы
| Задача | Алгоритм |
|---|---|
| Кратчайший путь | Dijkstra (NetworkX), fallback: undirected |
| Рекомендация (1 заявка) | Greedy + формула скоринга |
| Группировка заявок | Clarke-Wright savings |
| Пакетное назначение | OR-Tools VRPTW (GUIDED_LOCAL_SEARCH, 30s) |
| Reason field | OpenAI GPT-4o-mini (fallback: шаблон) |

### Скоринг
```
score(v, j) = 1 - [ω_d·D/D_max + ω_t·ETA/ETA_max + ω_w·wait/wait_max + ω_p·penalty_SLA]
  ω_d = 0.30  (расстояние)
  ω_t = 0.30  (ETA)
  ω_w = 0.15  (время ожидания)
  ω_p = 0.25  (штраф SLA)

ETA = D/avg_speed + wait
wait = max(0, tw_start - free_at - travel_time)
penalty_SLA = max(0, ETA - deadline) / deadline
deadline = tw_start + {high:2h, medium:5h, low:12h}
```

---

## Демо-сценарии

### Сценарий 1: Срочная заявка (high priority)
```bash
curl -X POST http://localhost:8000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"task_id":"T-2025-0001","priority":"high","destination_uwi":"ASA_0003",
       "planned_start":"2025-02-20T08:00:00","duration_hours":4.5,"shift":"day","task_type":"103"}'
```

### Сценарий 2: Маршрут конкретной машины
```bash
curl -X POST http://localhost:8000/api/route \
  -H "Content-Type: application/json" \
  -d '{"from_location":{"wialon_id":28996027},"to_location":{"uwi":"ASA_0003"}}'
```

### Сценарий 3: Группировка заявок
```bash
curl -X POST http://localhost:8000/api/multitask \
  -H "Content-Type: application/json" \
  -d '{"task_ids":["T-2025-0001","T-2025-0002","T-2025-0003"],
       "constraints":{"max_total_time_minutes":480,"max_detour_ratio":1.3}}'
```

### Сценарий 4: Карта маршрута (в браузере)
```
http://localhost:8000/api/map/route?from_node=0&to_node=100
http://localhost:8000/api/map/fleet
```

---

## Конфигурация (.env)
```env
DB_HOST=95.47.96.41
DB_PORT=5432
DB_NAME=mock_uto
DB_USER=readonly_user
DB_PASS=Eh092P72se.)

AVG_SPEED_KMH=40.0
OPENAI_API_KEY=sk-...   # опционально, для LLM-обоснований
```
