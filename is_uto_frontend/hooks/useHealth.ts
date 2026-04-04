"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

export function useHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.health();
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, error };
}
