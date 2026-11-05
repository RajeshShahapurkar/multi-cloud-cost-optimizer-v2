"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Cloud,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://multi-cloud-cost-optimizer-v2-api.onrender.com";

type DashboardData = {
  user: { id: string; email?: string };
  billing_records: number;
  metric_records: number;
  providers: string[];
  summary: {
    total_cost_by_currency: Record<string, number>;
  };
  recommendations: { status: string }[];
};

export default function DashboardPage() {
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

    if (!response.ok) {
      throw new Error(payload.detail ?? "Could not load your workspace.");
    }

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
        if (alive) {
          setError(err instanceof Error ? err.message : "Workspace load failed.");
        }
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

  const refresh = async () => {
    if (!session) return;
    setError("");
    try {
      await loadDashboard(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed.");
    }
  };

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const currencies = Object.entries(
    data?.summary?.total_cost_by_currency ?? {}
  );
  const pendingRecommendations = (data?.recommendations ?? []).filter(
    (item) => item.status === "new"
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080d18] text-slate-300">
        <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
        Loading your workspace…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-5">
        <div className="mb-5 flex items-center justify-end gap-3">
          <span className="hidden text-sm text-slate-400 sm:inline">
            {data?.user?.email}
          </span>
          <button
            onClick={refresh}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[.16em] text-cyan-300">
              CLOUD SPEND OVERVIEW
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Your optimization workspace
            </h1>
            <p className="mt-2 text-slate-400">
              Import billing exports and resource metrics to create a unified view of your cloud costs.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-200">
            <ShieldCheck className="mr-2 inline h-4 w-4" />
            Private workspace · RLS enabled
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={<Wallet />}
            label="Imported billing rows"
            value={data?.billing_records ?? 0}
          />
          <Stat
            icon={<Activity />}
            label="Resource metrics"
            value={data?.metric_records ?? 0}
          />
          <Stat
            icon={<Cloud />}
            label="Cloud providers"
            value={(data?.providers ?? []).length}
          />
          <Stat
            icon={<AlertTriangle />}
            label="Open recommendations"
            value={pendingRecommendations}
          />
        </section>

        <section className="mt-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Total expenditure</h2>
            <p className="mt-1 text-sm text-slate-400">
              Grouped by original billing currency
            </p>

            {currencies.length === 0 ? (
              <Empty text="No billing data imported yet. Upload billing files from the Cloud Data module." />
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {currencies.map(([currency, amount]) => (
                  <div key={currency} className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">{currency} total</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {formatCurrency(Number(amount), currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-slate-800 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Imported cloud providers</h3>
                <span className="text-xs text-slate-500">CSV profiles</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data?.providers ?? []).length > 0 ? (
                  data?.providers.map((provider) => (
                    <span
                      key={provider}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300"
                    >
                      {provider}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Provider profiles appear after your first import.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-800 pt-5 text-xs text-slate-500">
          Multi-Cloud Cost Optimizer · CSV analysis mode · Recommendations are advisory;
          no cloud resource is changed automatically.
        </footer>
      </div>
    </main>
  );
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return currency + " " + amount.toFixed(2);
  }
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-3 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
