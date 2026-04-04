"use client";

import { useState, useEffect } from "react";
import {
  Activity, Database, GitBranch, Truck, RefreshCw,
  ExternalLink, FileDown, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Clock,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MOCK_LOG = [
  { time: "09:42:15", level: "info", msg: "Граф дорог загружен: 4624 узла, 19031 рёбер" },
  { time: "09:42:18", level: "info", msg: "Парк техники: 126 единиц инициализировано" },
  { time: "09:42:19", level: "info", msg: "Заявки загружены: 70 записей из tasks.csv" },
  { time: "09:43:01", level: "info", msg: "POST /api/recommendations — 3 кандидата за 1.2с" },
  { time: "09:44:32", level: "info", msg: "POST /api/route — маршрут 17.4 км, 26 мин" },
  { time: "09:51:07", level: "info", msg: "POST /api/recommendations — топ: score=0.969" },
  { time: "09:55:44", level: "warn", msg: "Undirected fallback для пары узлов 1023→4401" },
  { time: "10:02:18", level: "info", msg: "GET /api/fleet — 126 ТС возвращено за 45мс" },
  { time: "10:08:33", level: "info", msg: "POST /api/multitask — экономия 23.4% (Clarke-Wright)" },
  { time: "10:15:01", level: "info", msg: "Heartbeat OK — система работает стабильно" },
];

const FAQ = [
  {
    q: "Как работает скоринг рекомендаций?",
    a: "Формула: score = 1 − (ω_d·D/D_max + ω_t·ETA/ETA_max + ω_w·wait/wait_max + ω_p·penalty_SLA). Веса по умолчанию: расстояние 30%, ETA 30%, ожидание 15%, SLA-штраф 25%. Чем выше score (ближе к 1.0), тем лучше кандидат.",
  },
  {
    q: "Что означает статус «Граф: OK»?",
    a: "Дорожный граф месторождения успешно загружен в память. Граф содержит 4 624 узла и 19 031 направленное ребро. На нём работает алгоритм Дейкстры для расчёта кратчайших маршрутов между любыми точками.",
  },
  {
    q: "Почему машины кластеризованы в одной зоне?",
    a: "Система Wialon хранит координаты в анонимизированном пространстве (pos_x 59–60°), которое не совпадает с реальным графом дорог (lon 55–57°). Применяется линейная нормализация координат для корректного размещения техники в пространстве графа.",
  },
  {
    q: "Как создать новую заявку?",
    a: "Перейдите на главную страницу (Обзор). В правой панели выберите вкладку «Рекомендации». Заполните UWI объекта, тип работ, приоритет и смену. Нажмите «Найти технику» — система предложит топ-3 кандидата с обоснованием.",
  },
  {
    q: "Что такое Clarke-Wright группировка?",
    a: "Классический алгоритм экономии маршрутов. Для N заявок базово каждая выполняется отдельно. Алгоритм считает экономию savings[i][j] = d(депо,i) + d(депо,j) − d(i,j) и жадно объединяет выгодные пары с учётом ограничений времени и коэффициента объезда.",
  },
];

function DiagRow({ icon: Icon, label, value, ok, sub }: {
  icon: any; label: string; value: string; ok: boolean | null; sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: "1px solid #21262d" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#21262d" }}>
        <Icon size={14} style={{ color: ok ? "#3fb950" : ok === null ? "#484f58" : "#f85149" }} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: "#e6edf3" }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>{sub}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: ok ? "#3fb950" : ok === null ? "#484f58" : "#f85149" }}>
          {value}
        </span>
        {ok === true && <CheckCircle size={14} style={{ color: "#3fb950" }} />}
        {ok === false && <XCircle size={14} style={{ color: "#f85149" }} />}
        {ok === null && <Clock size={14} style={{ color: "#484f58" }} />}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid #21262d" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: "#161b22" }}
      >
        <span className="text-sm font-medium" style={{ color: "#e6edf3" }}>{q}</span>
        {open ? <ChevronDown size={14} style={{ color: "#8b949e" }} /> : <ChevronRight size={14} style={{ color: "#8b949e" }} />}
      </button>
      {open && (
        <div className="px-5 py-4 text-sm leading-relaxed" style={{ background: "#0d1117", color: "#8b949e" }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const t0 = Date.now();
    try {
      const r = await api.health();
      setHealth(r);
      setLatency(Date.now() - t0);
    } catch {
      setHealth(null);
      setLatency(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const handleExportCSV = () => {
    const rows = ["task_id,priority,destination_uwi,task_type,shift,planned_duration_hours"];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tasks_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-8 py-5 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Служба поддержки</h1>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Диагностика, документация и справка</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="grid grid-cols-2 gap-6 max-w-5xl">
            {/* LEFT COL */}
            <div className="space-y-5">
              {/* Diagnostics */}
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity size={15} style={{ color: "#d4a017" }} />
                    <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>Диагностика системы</span>
                  </div>
                  <button
                    onClick={checkStatus}
                    disabled={checking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "#21262d", color: "#8b949e" }}
                  >
                    <RefreshCw size={11} className={checking ? "animate-spin" : ""} />
                    Обновить
                  </button>
                </div>
                <DiagRow
                  icon={Activity}
                  label="Бэкенд API"
                  value={latency ? `${latency} мс` : health ? "OK" : "Недоступен"}
                  ok={health !== null}
                  sub={BACKEND}
                />
                <DiagRow
                  icon={Database}
                  label="База данных"
                  value={health ? "Neon PostgreSQL" : "—"}
                  ok={health ? true : null}
                  sub="neondb / cloud"
                />
                <DiagRow
                  icon={GitBranch}
                  label="Граф дорог"
                  value={health ? "4624 узла · 19031 рёбер" : "—"}
                  ok={health ? true : null}
                  sub="NetworkX DiGraph + KDTree"
                />
                <DiagRow
                  icon={Truck}
                  label="Техника загружена"
                  value={health ? `${health.vehicles} ТС` : "—"}
                  ok={health ? health.vehicles > 0 : null}
                  sub={health ? `${health.tasks} заявок · ${health.wells} скважин` : ""}
                />
              </div>

              {/* Quick actions */}
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Быстрые действия</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      icon: ExternalLink,
                      label: "Документация API",
                      sub: "Swagger UI",
                      action: () => window.open(`${BACKEND}/docs`, "_blank"),
                    },
                    {
                      icon: ExternalLink,
                      label: "Карта флота",
                      sub: "Folium HTML",
                      action: () => window.open(`${BACKEND}/api/map/fleet`, "_blank"),
                    },
                    {
                      icon: FileDown,
                      label: "Экспорт задач",
                      sub: "CSV формат",
                      action: handleExportCSV,
                    },
                    {
                      icon: Activity,
                      label: "Health Check",
                      sub: "JSON ответ",
                      action: () => window.open(`${BACKEND}/health`, "_blank"),
                    },
                  ].map(({ icon: Icon, label, sub, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                      style={{ background: "#0d1117", border: "1px solid #21262d" }}
                      onMouseOver={(e) => (e.currentTarget.style.borderColor = "#30363d")}
                      onMouseOut={(e) => (e.currentTarget.style.borderColor = "#21262d")}
                    >
                      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: "#d4a017" }} />
                      <div>
                        <div className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{label}</div>
                        <div className="text-xs mt-0.5" style={{ color: "#484f58" }}>{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COL */}
            <div className="space-y-5">
              {/* FAQ */}
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Частые вопросы</div>
                <div className="space-y-2">
                  {FAQ.map((item) => <FaqItem key={item.q} {...item} />)}
                </div>
              </div>

              {/* Event log */}
              <div className="rounded-2xl p-5" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Лог событий</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {MOCK_LOG.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5 text-xs">
                      <span className="font-mono shrink-0" style={{ color: "#484f58" }}>{entry.time}</span>
                      <span
                        className="shrink-0 px-1.5 rounded text-xs"
                        style={{
                          background: entry.level === "warn" ? "#4a3a0d" : "#0d2d1a",
                          color: entry.level === "warn" ? "#d4a017" : "#3fb950",
                        }}
                      >
                        {entry.level}
                      </span>
                      <span style={{ color: "#8b949e" }}>{entry.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
