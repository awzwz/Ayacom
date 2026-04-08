"use client";

import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";

type PriorityFilter = "all" | "high" | "medium" | "low";

const PRIORITY_FILTERS: { key: PriorityFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "high", label: "Высокий" },
  { key: "medium", label: "Средний" },
  { key: "low", label: "Низкий" },
];

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  high: { color: "#d4a017", bg: "#d4a01718", border: "#d4a01740", label: "Высокий" },
  medium: { color: "#58a6ff", bg: "#58a6ff18", border: "#58a6ff40", label: "Средний" },
  low: { color: "#484f58", bg: "#484f5818", border: "#484f5840", label: "Низкий" },
};

const SHIFT_LABEL: Record<string, string> = {
  day: "День",
  night: "Ночь",
  morning: "Утро",
  evening: "Вечер",
};

function TaskCard({ t }: { t: Task }) {
  const p = PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.low;
  const shiftLabel = SHIFT_LABEL[t.shift] ?? t.shift;
  const startDate = new Date(t.planned_start).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderLeft: `3px solid ${p.color}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Top row: task_id + priority badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            color: "#e6edf3",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {t.task_id}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: 6,
            flexShrink: 0,
            background: p.bg,
            border: `1px solid ${p.border}`,
            color: p.color,
          }}
        >
          {p.label}
        </span>
      </div>

      {/* UWI */}
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#8b949e" }}>{t.destination_uwi}</div>

      {/* Meta row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span
          style={{
            fontSize: 10,
            color: "#8b949e",
            background: "#21262d",
            borderRadius: 6,
            padding: "2px 6px",
          }}
        >
          {t.task_type}
        </span>
        <span
          style={{
            fontSize: 10,
            color: t.shift === "night" ? "#8b949e" : "#d4a017",
            background: t.shift === "night" ? "#21262d" : "#d4a01712",
            borderRadius: 6,
            padding: "2px 6px",
          }}
        >
          {shiftLabel}
        </span>
        <span style={{ fontSize: 10, color: "#484f58" }}>{t.planned_duration_hours} ч</span>
      </div>

      {/* Date */}
      <div style={{ fontSize: 10, color: "#484f58" }}>{startDate}</div>
    </div>
  );
}

export default function MobileTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PriorityFilter>("all");

  useEffect(() => {
    api
      .tasks(undefined, 100)
      .then((r) => setTasks(r.tasks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.priority === filter);

  const counts = {
    high: tasks.filter((t) => t.priority === "high").length,
    medium: tasks.filter((t) => t.priority === "medium").length,
    low: tasks.filter((t) => t.priority === "low").length,
  };

  return (
    <div style={{ padding: "0 0 8px" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid #21262d",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: "#e6edf3" }}>Заявки</span>
        {!loading && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "#21262d",
              color: "#8b949e",
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Priority stats */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["high", "medium", "low"] as const).map((key) => {
              const p = PRIORITY_STYLE[key];
              return (
                <div
                  key={key}
                  style={{
                    background: "#161b22",
                    border: "1px solid #21262d",
                    borderRadius: 10,
                    padding: "10px 8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: p.color, lineHeight: 1 }}>
                    {counts[key]}
                  </div>
                  <div style={{ fontSize: 10, color: "#484f58", marginTop: 3 }}>{p.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRIORITY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${filter === key ? "#d4a017" : "#21262d"}`,
                background: filter === key ? "#d4a01718" : "transparent",
                color: filter === key ? "#d4a017" : "#8b949e",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                minHeight: 36,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#484f58" }}>
            <ClipboardList size={32} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13 }}>Нет заявок</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((t) => (
              <TaskCard key={t.task_id} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
