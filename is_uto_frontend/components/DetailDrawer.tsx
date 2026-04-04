"use client";

import { useEffect, useState } from "react";
import {
  X, MapPin, Clock, Zap, Truck, Wrench, Navigation,
  CheckCircle, Circle, Route,
} from "lucide-react";
import type { FleetVehicle, Task, RouteResponse } from "@/lib/types";
import { api } from "@/lib/api";

interface Props {
  vehicle: FleetVehicle | null;
  task: Task | null;
  onClose: () => void;
  onRouteBuilt: (route: RouteResponse, vehicleId: number) => void;
}

export default function DetailDrawer({ vehicle, task, onClose, onRouteBuilt }: Props) {
  const open = !!(vehicle || task);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResponse | null>(null);

  // Reset route when selection changes
  useEffect(() => {
    setRouteResult(null);
  }, [vehicle?.wialon_id, task?.task_id]);

  const handleBuildRoute = async () => {
    if (!vehicle) return;
    setRouteLoading(true);
    try {
      const uwi = task?.destination_uwi ?? "ASA_0003";
      const route = await api.route({
        from_location: { wialon_id: vehicle.wialon_id },
        to_location: { uwi },
      });
      setRouteResult(route);
      onRouteBuilt(route, vehicle.wialon_id);
    } catch (e: any) {
      console.error(e);
    } finally {
      setRouteLoading(false);
    }
  };

  const priorityLabel: Record<string, string> = {
    high: "Высокий", medium: "Средний", low: "Низкий",
  };
  const priorityColor: Record<string, string> = {
    high: "#d4a017", medium: "#1f6feb", low: "#8b949e",
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="absolute inset-0 z-40"
          style={{ background: "transparent" }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="absolute top-4 left-4 z-50 flex flex-col"
        style={{
          width: 320,
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 16,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          transform: open ? "translateX(0) scale(1)" : "translateX(-16px) scale(0.97)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease",
          maxHeight: "calc(100% - 32px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid #21262d" }}
        >
          <div className="flex items-center gap-2">
            {vehicle ? (
              <div className="rounded-lg p-1.5" style={{ background: "#21262d" }}>
                <Truck size={14} style={{ color: "#d4a017" }} />
              </div>
            ) : (
              <div className="rounded-lg p-1.5" style={{ background: "#21262d" }}>
                <MapPin size={14} style={{ color: "#1f6feb" }} />
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
              {vehicle ? "Транспортное средство" : "Заявка"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "#8b949e" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#e6edf3")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#8b949e")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {vehicle && <VehicleDetail vehicle={vehicle} routeResult={routeResult} onBuildRoute={handleBuildRoute} routeLoading={routeLoading} />}
          {task && !vehicle && <TaskDetail task={task} priorityColor={priorityColor} priorityLabel={priorityLabel} />}
        </div>
      </div>
    </>
  );
}

function VehicleDetail({
  vehicle, routeResult, onBuildRoute, routeLoading,
}: {
  vehicle: FleetVehicle;
  routeResult: RouteResponse | null;
  onBuildRoute: () => void;
  routeLoading: boolean;
}) {
  const isFree = vehicle.free_at_minutes === 0;

  return (
    <div className="p-4 space-y-4">
      {/* Name & status */}
      <div>
        <div className="font-bold text-base leading-tight" style={{ color: "#e6edf3" }}>
          {vehicle.name}
        </div>
        <div className="font-mono text-xs mt-1" style={{ color: "#8b949e" }}>
          {vehicle.registration}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: isFree ? "#0d4a1a" : "#4a0d0d",
              color: isFree ? "#3fb950" : "#f85149",
            }}
          >
            {isFree ? <CheckCircle size={11} /> : <Circle size={11} />}
            {isFree ? "Свободна" : "Занята"}
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: "#21262d", color: "#8b949e" }}
          >
            {vehicle.vehicle_type_code}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Zap, label: "Скорость", value: `${vehicle.avg_speed_kmh} км/ч`, color: "#d4a017" },
          { icon: Wrench, label: "Типов работ", value: vehicle.skills_count, color: "#1f6feb" },
          { icon: MapPin, label: "Узел графа", value: `#${vehicle.start_node}`, color: "#8b949e" },
          { icon: Clock, label: "Свободна в", value: isFree ? "Сейчас" : `+${vehicle.free_at_minutes.toFixed(0)} мин`, color: isFree ? "#3fb950" : "#f85149" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: "#0d1117", border: "1px solid #21262d" }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={11} style={{ color }} />
              <span className="text-xs" style={{ color: "#484f58" }}>{label}</span>
            </div>
            <div className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Coordinates */}
      <div className="rounded-xl p-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
        <div className="text-xs mb-2 font-semibold" style={{ color: "#484f58" }}>
          <Navigation size={11} className="inline mr-1" />
          Координаты
        </div>
        <div className="font-mono text-xs" style={{ color: "#8b949e" }}>
          {vehicle.start_lat?.toFixed(5) ?? "—"}, {vehicle.start_lon?.toFixed(5) ?? "—"}
        </div>
      </div>

      {/* Route result */}
      {routeResult && (
        <div
          className="rounded-xl p-3 fade-in"
          style={{ background: "#0d2d1a", border: "1px solid #3fb95033" }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: "#3fb950" }}>
            <Route size={11} className="inline mr-1" />
            Маршрут построен
          </div>
          <div className="flex gap-4">
            <div>
              <div className="text-lg font-bold" style={{ color: "#e6edf3" }}>
                {routeResult.distance_km.toFixed(1)}
                <span className="text-xs font-normal ml-1" style={{ color: "#8b949e" }}>км</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: "#e6edf3" }}>
                {routeResult.time_minutes.toFixed(0)}
                <span className="text-xs font-normal ml-1" style={{ color: "#8b949e" }}>мин</span>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: "#e6edf3" }}>
                {routeResult.nodes.length}
                <span className="text-xs font-normal ml-1" style={{ color: "#8b949e" }}>узлов</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <button
        onClick={onBuildRoute}
        disabled={routeLoading}
        className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
        style={{
          background: routeLoading ? "#1a3a5c" : "#1f6feb",
          color: "#fff",
          opacity: routeLoading ? 0.7 : 1,
        }}
      >
        <Route size={14} />
        {routeLoading ? "Строю маршрут..." : "Построить маршрут"}
      </button>
    </div>
  );
}

function TaskDetail({
  task, priorityColor, priorityLabel,
}: {
  task: Task;
  priorityColor: Record<string, string>;
  priorityLabel: Record<string, string>;
}) {
  const pc = priorityColor[task.priority] ?? "#8b949e";
  const date = new Date(task.planned_start);
  const dateStr = date.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="p-4 space-y-4">
      {/* ID & priority */}
      <div>
        <div className="font-bold text-base font-mono" style={{ color: "#e6edf3" }}>
          {task.task_id}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: pc + "22", color: pc, border: `1px solid ${pc}44` }}
          >
            {priorityLabel[task.priority] ?? task.priority}
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: "#21262d", color: "#8b949e" }}
          >
            {task.shift === "day" ? "День" : "Ночь"}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        {[
          { label: "UWI объекта", value: task.destination_uwi },
          { label: "Тип работ", value: task.task_type },
          { label: "Начало", value: dateStr },
          { label: "Длительность", value: `${task.planned_duration_hours} ч` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between items-center rounded-xl px-3 py-2.5"
            style={{ background: "#0d1117", border: "1px solid #21262d" }}
          >
            <span className="text-xs" style={{ color: "#484f58" }}>{label}</span>
            <span className="text-xs font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Coords */}
      {task.dest_lat && task.dest_lon && (
        <div className="rounded-xl p-3" style={{ background: "#0d1117", border: "1px solid #21262d" }}>
          <div className="text-xs mb-2 font-semibold" style={{ color: "#484f58" }}>
            <Navigation size={11} className="inline mr-1" />
            Координаты скважины
          </div>
          <div className="font-mono text-xs" style={{ color: "#8b949e" }}>
            {task.dest_lat.toFixed(5)}, {task.dest_lon.toFixed(5)}
          </div>
        </div>
      )}
    </div>
  );
}
