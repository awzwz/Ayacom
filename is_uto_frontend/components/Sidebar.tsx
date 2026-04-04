"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Route,
  Truck,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  Activity,
} from "lucide-react";
import { useHealth } from "@/hooks/useHealth";
import clsx from "clsx";

const NAV = [
  { label: "Обзор", href: "/", icon: LayoutDashboard },
  { label: "Маршруты", href: "/routes", icon: Route },
  { label: "Автопарк", href: "/fleet", icon: Truck },
  { label: "Аналитика", href: "/analytics", icon: BarChart3 },
  { label: "Настройки", href: "/settings", icon: Settings },
  { label: "Поддержка", href: "/support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: health } = useHealth();

  return (
    <aside
      className="flex flex-col h-full shrink-0"
      style={{
        width: 260,
        background: "#0d1117",
        borderRight: "1px solid #21262d",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid #21262d" }}>
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 36, height: 36, background: "#d4a017" }}
        >
          <Truck size={18} color="#0d1117" />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight" style={{ color: "#e6edf3" }}>
            ИС УТО
          </div>
          <div className="text-xs" style={{ color: "#8b949e" }}>
            Система маршрутизации
          </div>
        </div>
      </div>

      {/* Create button */}
      <div className="px-4 py-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
          style={{ background: "#d4a017", color: "#0d1117" }}
          onMouseOver={(e) =>
            (e.currentTarget.style.background = "#e6b520")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.background = "#d4a017")
          }
        >
          <Plus size={16} />
          Создать маршрут
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={clsx(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-all text-left",
                active
                  ? "font-semibold"
                  : "font-normal"
              )}
              style={{
                background: active ? "#161b22" : "transparent",
                color: active ? "#e6edf3" : "#8b949e",
                borderLeft: active ? "2px solid #d4a017" : "2px solid transparent",
              }}
              onMouseOver={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "#161b22";
                  e.currentTarget.style.color = "#e6edf3";
                }
              }}
              onMouseOut={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#8b949e";
                }
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-lg" style={{ background: "#161b22", border: "1px solid #21262d" }}>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "#8b949e" }}>Статус флота</span>
          <span style={{ color: "#e6edf3" }} className="font-semibold">
            {health?.vehicles ?? "—"} машин
          </span>
        </div>
        <div className="flex justify-between text-xs mb-2">
          <span style={{ color: "#8b949e" }}>Активные заявки</span>
          <span style={{ color: "#e6edf3" }} className="font-semibold">
            {health?.tasks ?? "—"} заявок
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className="pulse-ring absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: health?.status === "ok" ? "#3fb950" : "#f85149" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: health?.status === "ok" ? "#3fb950" : "#f85149" }}
            />
          </span>
          <span style={{ color: health?.status === "ok" ? "#3fb950" : "#f85149" }}>
            Граф: {health?.status === "ok" ? "OK" : "Ошибка"}
          </span>
          <span style={{ color: "#484f58" }} className="ml-auto">
            <Activity size={11} />
          </span>
        </div>
      </div>

      {/* User */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderTop: "1px solid #21262d" }}
      >
        <div
          className="rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ width: 34, height: 34, background: "#1f6feb", color: "#fff" }}
        >
          AA
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>
            Abdulin Aziz
          </div>
          <div className="text-xs truncate" style={{ color: "#8b949e" }}>
            Менеджер логистики
          </div>
        </div>
        <button
          className="p-1.5 rounded transition-colors"
          style={{ color: "#8b949e" }}
          title="Выйти"
          onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
