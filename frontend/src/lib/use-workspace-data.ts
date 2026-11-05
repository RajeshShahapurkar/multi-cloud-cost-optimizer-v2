"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "https://multi-cloud-cost-optimizer-v2-api.onrender.com";

export type Recommendation = {
  id: string;
  provider: string;
  resource_id: string | null;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  status: string;
  estimated_monthly_savings: number | null;
  currency: string | null;
  created_at: string;
};

export type ImportRow = {
  id: string;
  data_type: string;
  original_filename: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  created_at: string;
};

export type DashboardData = {
  user: { id: string; email?: string };
  billing_records: number;
  metric_records: number;
  providers: string[];
  summary: {
    total_cost_by_currency: Record<string, number>;
    service_costs: { service_name: string; currency: string; cost: number }[];
    region_costs: { region: string; currency: string; cost: number }[];
    monthly_trend: { month: string; currency: string; cost: number }[];
    top_resources: { resource_id: string; service_name: string; currency: string; cost: number }[];
  };
  recommendations: Recommendation[];
  cost_anomalies: {
    provider: string; currency: string; period: string; current_cost: number;
    baseline_average: number; increase_pct: number; category: string; severity: string;
  }[];
  forecasts: {
    provider: string; currency: string; month: string; forecast_cost: number;
    method: string; history_months: number; limitations: string;
  }[];
  imports: ImportRow[];
};

export function useWorkspaceData() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (current: any) => {
    if (!current?.access_token) return;
    const response = await fetch(API + "/api/dashboard", {
      headers: { Authorization: "Bearer " + current.access_token },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail ?? "Could not load your workspace.");
    setData(payload);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getSession().then(async ({ data: { session: current } }) => {
      if (!alive) return;
      if (!current) {
        router.replace("/login");
        setLoading(false);
        return;
      }
      setSession(current);
      try {
        await loadDashboard(current);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Workspace load failed.");
      } finally {
        if (alive) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      if (!next) {
        router.replace("/login");
        return;
      }
      setSession(next);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [router, loadDashboard]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setError("");
    try {
      await loadDashboard(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    }
  }, [session, loadDashboard]);

  return { session, data, setData, loading, error, setError, refresh, loadDashboard };
}
