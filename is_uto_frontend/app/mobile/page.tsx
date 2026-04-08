"use client";

import { Bus, Brain, Route, TrendingDown, CheckCircle, Loader2 } from "lucide-react";
import { useHealth } from "@/hooks/useHealth";

const FEATURES = [
  {
    Icon: Brain,
    color: "#58a6ff",
    title: "AI-рекомендации маршрутов",
    desc: "Система подбирает оптимальные ТС для каждой заявки с учётом навыков, расстояния и временных окон.",
  },
  {
    Icon: Route,
    color: "#3fb950",
    title: "Оптимизация групповых поездок",
    desc: "Clarke-Wright и OR-Tools VRPTW объединяют близкие заявки, сокращая порожние пробеги.",
  },
  {
    Icon: TrendingDown,
    color: "#d4a017",
    title: "Бизнес-анализ экономии",
    desc: "Расчёт экономии по дистанции, топливу, времени и CO₂ с годовыми проекциями для инвесторов.",
  },
];

export default function MobileOverviewPage() {
  const { data: health } = useHealth();

  const isReady = health?.status === "ok";
  const isLoading = !health;

  return (
    <div style={{ padding: "0 0 8px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 16px 12px",
          borderBottom: "1px solid #21262d",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: "#d4a01722",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bus size={20} color="#d4a017" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e6edf3", lineHeight: 1 }}>ИС УТО</div>
          <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>
            {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* System status card */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {isLoading ? (
              <Loader2 size={14} color="#8b949e" style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isReady ? "#3fb950" : "#f85149",
                  boxShadow: isReady ? "0 0 6px #3fb950" : "0 0 6px #f85149",
                }}
              />
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3" }}>
              {isLoading ? "Подключение..." : isReady ? "Система готова" : "Загрузка данных..."}
            </span>
            {health && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: isReady ? "#3fb950" : "#d4a017",
                  background: isReady ? "#3fb95018" : "#d4a01718",
                  border: `1px solid ${isReady ? "#3fb95040" : "#d4a01740"}`,
                  borderRadius: 6,
                  padding: "2px 6px",
                  fontWeight: 600,
                }}
              >
                {isReady ? "OK" : "LOADING"}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Транспорт", value: health?.vehicles ?? "—", color: "#58a6ff" },
              { label: "Заявки", value: health?.tasks ?? "—", color: "#d4a017" },
              { label: "Скважины", value: health?.wells ?? "—", color: "#3fb950" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#0d1117",
                  borderRadius: 8,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#484f58", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Project description card */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderLeft: "3px solid #d4a017",
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3", marginBottom: 6 }}>
            Интеллектуальная система управления транспортом
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.6 }}>
            ИС УТО оптимизирует маршрутизацию спецтехники на нефтяных месторождениях.
            Система анализирует граф дорог (4 624 узла), флот из 116+ единиц техники
            и тысячи скважин-назначений, формируя эффективные маршруты в реальном времени.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
              fontSize: 11,
              color: "#3fb950",
            }}
          >
            <CheckCircle size={12} />
            <span>Хакатон KMG 2025 · Месторождение Жетыбай</span>
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#484f58", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 2 }}>
            Возможности системы
          </div>
          {FEATURES.map(({ Icon, color, title, desc }) => (
            <div
              key={title}
              style={{
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: `${color}18`,
                  border: `1px solid ${color}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 11, color: "#8b949e", lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "#30363d" }}>IS УТО · Ayacom · 2025</div>
        </div>
      </div>
    </div>
  );
}
