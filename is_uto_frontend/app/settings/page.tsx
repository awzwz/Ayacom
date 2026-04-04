"use client";

import { useState, useEffect } from "react";
import { Database, Cpu, User, RefreshCw, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const TABS = ["Система", "Алгоритм", "Профиль"] as const;
type Tab = typeof TABS[number];

const DEFAULTS = { speed: 40, omegaD: 0.30, omegaT: 0.30, omegaW: 0.15, omegaP: 0.25, mode: "Жадный", solverTime: 30 };

function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-xs w-40 shrink-0" style={{ color: "#8b949e" }}>{label}</div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded appearance-none cursor-pointer"
        style={{ accentColor: "#d4a017" }}
      />
      <div className="text-xs font-mono w-16 text-right font-semibold" style={{ color: "#e6edf3" }}>
        {format ? format(value) : value}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Система");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [omegaD, setOmegaD] = useState(DEFAULTS.omegaD);
  const [omegaT, setOmegaT] = useState(DEFAULTS.omegaT);
  const [omegaW, setOmegaW] = useState(DEFAULTS.omegaW);
  const [omegaP, setOmegaP] = useState(DEFAULTS.omegaP);
  const [mode, setMode] = useState(DEFAULTS.mode);
  const [solverTime, setSolverTime] = useState(DEFAULTS.solverTime);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    try { const r = await api.health(); setHealth(r); } catch { setHealth(null); }
    finally { setChecking(false); }
  };

  const totalOmega = +(omegaD + omegaT + omegaW + omegaP).toFixed(2);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSpeed(DEFAULTS.speed); setOmegaD(DEFAULTS.omegaD); setOmegaT(DEFAULTS.omegaT);
    setOmegaW(DEFAULTS.omegaW); setOmegaP(DEFAULTS.omegaP);
    setMode(DEFAULTS.mode); setSolverTime(DEFAULTS.solverTime);
  };

  const weights = [
    { label: "Расстояние", value: omegaD, color: "#d4a017" },
    { label: "ETA", value: omegaT, color: "#1f6feb" },
    { label: "Ожидание", value: omegaW, color: "#3fb950" },
    { label: "SLA", value: omegaP, color: "#f85149" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Настройки</h1>
            <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>Конфигурация системы и алгоритмов</p>
          </div>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: saved ? "#0d4a1a" : "#d4a017", color: saved ? "#3fb950" : "#0d1117" }}
          >
            {saved ? "✓ Сохранено" : "Сохранить"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 shrink-0" style={{ borderBottom: "1px solid #21262d" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-3 px-1 mr-6 text-sm font-medium relative transition-colors"
              style={{ color: tab === t ? "#e6edf3" : "#8b949e" }}
            >
              {t}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: "#d4a017" }} />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* === СИСТЕМА === */}
          {tab === "Система" && (
            <div className="max-w-2xl space-y-4">
              {/* DB status */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Database size={16} style={{ color: "#d4a017" }} />
                  <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>База данных</span>
                  {health ? (
                    <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: "#3fb950" }}>
                      <CheckCircle size={12} /> Подключено
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: "#f85149" }}>
                      <XCircle size={12} /> Нет соединения
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Хост", value: "95.47.96.41" },
                    { label: "Порт", value: "5432" },
                    { label: "База данных", value: "mock_uto" },
                    { label: "Пользователь", value: "readonly_user" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl px-4 py-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                      <div className="text-xs mb-1" style={{ color: "#484f58" }}>{label}</div>
                      <div className="font-mono text-sm font-semibold" style={{ color: "#e6edf3" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={checkConnection}
                  disabled={checking}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "#21262d", color: "#8b949e" }}
                >
                  <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
                  {checking ? "Проверяю..." : "Проверить соединение"}
                </button>
              </div>

              {/* Speed */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} style={{ color: "#1f6feb" }} />
                  <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>Параметры расчёта</span>
                </div>
                <SliderRow
                  label="Скорость по умолчанию"
                  value={speed} min={20} max={120} step={5}
                  onChange={setSpeed}
                  format={(v) => `${v} км/ч`}
                />
              </div>

              {/* System info */}
              {health && (
                <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                  <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Статус системы</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Транспорт", value: health.vehicles },
                      { label: "Заявки", value: health.tasks },
                      { label: "Скважины", value: health.wells },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl px-4 py-3 text-center" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                        <div className="text-xl font-bold" style={{ color: "#d4a017" }}>{value}</div>
                        <div className="text-xs mt-1" style={{ color: "#484f58" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === АЛГОРИТМ === */}
          {tab === "Алгоритм" && (
            <div className="max-w-2xl space-y-4">
              {/* Weights */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: "#e6edf3" }}>Веса скоринга</span>
                  <span className="text-xs font-mono" style={{ color: totalOmega === 1 ? "#3fb950" : "#f85149" }}>
                    Σ = {totalOmega.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs mb-5" style={{ color: "#484f58" }}>
                  score = 1 − (ω_d·D + ω_t·ETA + ω_w·wait + ω_p·SLA)
                </p>

                {/* Segmented bar */}
                <div className="flex h-3 rounded-full overflow-hidden mb-5">
                  {weights.map(({ label, value, color }) => (
                    <div key={label} style={{ width: `${value * 100}%`, background: color, transition: "width 0.3s" }} title={label} />
                  ))}
                </div>

                <div className="space-y-4">
                  <SliderRow label="ω_d — Расстояние" value={omegaD} min={0} max={1} step={0.05} onChange={setOmegaD} format={(v) => v.toFixed(2)} />
                  <SliderRow label="ω_t — ETA" value={omegaT} min={0} max={1} step={0.05} onChange={setOmegaT} format={(v) => v.toFixed(2)} />
                  <SliderRow label="ω_w — Ожидание" value={omegaW} min={0} max={1} step={0.05} onChange={setOmegaW} format={(v) => v.toFixed(2)} />
                  <SliderRow label="ω_p — SLA-штраф" value={omegaP} min={0} max={1} step={0.05} onChange={setOmegaP} format={(v) => v.toFixed(2)} />
                </div>

                <div className="flex gap-2 mt-4">
                  {weights.map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-1 text-xs" style={{ color: "#8b949e" }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {label} {(value * 100).toFixed(0)}%
                    </div>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Режим оптимизации</div>
                <div className="flex gap-2 mb-5">
                  {["Жадный", "OR-Tools", "Авто"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: mode === m ? "#1f6feb" : "#0d1117",
                        color: mode === m ? "#fff" : "#8b949e",
                        border: `1px solid ${mode === m ? "#1f6feb" : "#21262d"}`,
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {mode === "OR-Tools" && (
                  <SliderRow label="Время решения" value={solverTime} min={10} max={120} step={10} onChange={setSolverTime} format={(v) => `${v} сек`} />
                )}
                <p className="text-xs mt-3" style={{ color: "#484f58" }}>
                  {mode === "Жадный" && "Быстрый базовый алгоритм. Рекомендуется для срочных заявок."}
                  {mode === "OR-Tools" && "Google OR-Tools VRPTW. Оптимальный результат, требует больше времени."}
                  {mode === "Авто" && "Система выбирает режим автоматически в зависимости от числа заявок."}
                </p>
              </div>

              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "#161b22", border: "1px solid #21262d", color: "#8b949e" }}
              >
                <RotateCcw size={12} />
                Сбросить к дефолтам
              </button>
            </div>
          )}

          {/* === ПРОФИЛЬ === */}
          {tab === "Профиль" && (
            <div className="max-w-2xl space-y-4">
              {/* Avatar */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold" style={{ background: "#1f6feb", color: "#fff" }}>
                    AA
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: "#e6edf3" }}>Abdulin Aziz</div>
                    <div className="text-sm mt-0.5" style={{ color: "#8b949e" }}>Менеджер логистики</div>
                    <div className="text-xs mt-1 font-mono" style={{ color: "#484f58" }}>a.abdulin@uto.kz</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Имя", value: "Abdulin Aziz" },
                    { label: "Роль", value: "Менеджер логистики" },
                    { label: "Email", value: "a.abdulin@uto.kz" },
                    { label: "Организация", value: "АО НК «КазМунайГаз»" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
                      <span className="text-xs" style={{ color: "#484f58" }}>{label}</span>
                      <span className="text-xs font-semibold" style={{ color: "#8b949e" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferences */}
              <div className="rounded-2xl p-6" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <div className="font-semibold text-sm mb-4" style={{ color: "#e6edf3" }}>Интерфейс</div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs" style={{ color: "#8b949e" }}>Тема</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: "#d4a017", color: "#0d1117" }}>Тёмная</button>
                    <button className="px-3 py-1 rounded-lg text-xs" style={{ background: "#21262d", color: "#484f58", cursor: "not-allowed" }} disabled>Светлая</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#8b949e" }}>Язык</span>
                  <span className="text-xs font-semibold" style={{ color: "#484f58" }}>Русский (RU)</span>
                </div>
              </div>

              {/* Version */}
              <div className="rounded-2xl px-6 py-4 flex items-center justify-between" style={{ background: "#161b22", border: "1px solid #21262d" }}>
                <span className="text-xs" style={{ color: "#484f58" }}>Версия системы</span>
                <span className="text-xs font-mono font-semibold" style={{ color: "#8b949e" }}>IS УТО v1.0.0 · Хакатон 2025</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
