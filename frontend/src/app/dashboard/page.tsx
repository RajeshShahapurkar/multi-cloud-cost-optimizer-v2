"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpFromLine,
  Check,
  Cloud,
  FileSpreadsheet,
  Gauge,
  GitCompare,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://multi-cloud-cost-optimizer-v2-api.onrender.com";

type Provider = "aws" | "azure" | "gcp";
type ImportKind = "billing" | "metrics" | "pricing";

type DashboardData = {
  user: { id: string; email?: string };
  providers: string[];
  summary: {
    total_cost_by_currency: Record<string, number>;
  };
};

const providerOptions: Provider[] = ["aws", "azure", "gcp"];

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider>("aws");
  const [kind, setKind] = useState<ImportKind>("billing");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [notice, setNotice] = useState("");
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

  async function upload() {
    if (!file || !session?.access_token) {
      setError("Choose a CSV file and sign in.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    const form = new FormData();
    form.append("provider", provider);
    form.append("file", file);

    try {
      const endpoint = preview
        ? kind === "billing"
          ? "imports/billing"
          : kind === "metrics"
            ? "imports/metrics"
            : "imports/pricing"
        : kind === "billing"
          ? "uploads/billing/preview"
          : kind === "metrics"
            ? "uploads/metrics/preview"
            : "uploads/pricing/preview";

      const headers: Record<string, string> = preview
        ? { Authorization: "Bearer " + session.access_token }
        : {};

      const response = await fetch(API + "/api/" + endpoint, {
        method: "POST",
        headers,
        body: form,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.detail ?? (preview ? "Import failed." : "CSV validation failed.")
        );
      }

      if (!preview) {
        setPreview(payload);
        setNotice(
          "Validation complete. Review the accepted and rejected rows before confirming the import."
        );
        return;
      }

      setNotice(
        kind === "billing"
          ? "Imported " + payload.inserted_records + " billing rows for " + provider.toUpperCase() + "."
          : kind === "metrics"
            ? "Imported " +
              payload.inserted_metrics +
              " metrics rows and generated " +
              (payload.recommendations?.length ?? 0) +
              " recommendations."
            : "Imported " + payload.inserted_prices + " user-provided pricing records for " + provider.toUpperCase() + "."
      );

      setPreview(null);
      setFile(null);

      const input = document.getElementById("csv-file") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadDashboard(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Import failed. Check your API configuration."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const currencies = Object.entries(
    data?.summary?.total_cost_by_currency ?? {}
  );

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
            title="Refresh workspace"
            aria-label="Refresh workspace"
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
          <div className="mt-6 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {notice && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            <span>
              <Check className="mr-2 inline h-4 w-4" />
              {notice}
            </span>
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mt-8 grid items-start gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Import cloud data</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Files are parsed and saved to your private database.
                </p>
              </div>
              <UploadCloud className="h-6 w-6 text-cyan-300" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {providerOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setProvider(item);
                    setPreview(null);
                  }}
                  className={
                    "rounded-xl border px-3 py-3 text-sm font-semibold transition " +
                    (provider === item
                      ? "border-cyan-300 bg-cyan-300/10 text-cyan-200"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800")
                  }
                >
                  {item === "gcp" ? "Google Cloud" : item.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setKind("billing");
                  setPreview(null);
                }}
                className={
                  "rounded-xl border px-2 py-3 text-xs transition sm:text-sm " +
                  (kind === "billing"
                    ? "border-blue-300 bg-blue-300/10 text-blue-200"
                    : "border-slate-700 text-slate-400")
                }
              >
                <FileSpreadsheet className="mr-1 inline h-4 w-4" />
                Billing
              </button>
              <button
                onClick={() => {
                  setKind("metrics");
                  setPreview(null);
                }}
                className={
                  "rounded-xl border px-2 py-3 text-xs transition sm:text-sm " +
                  (kind === "metrics"
                    ? "border-blue-300 bg-blue-300/10 text-blue-200"
                    : "border-slate-700 text-slate-400")
                }
              >
                <Gauge className="mr-1 inline h-4 w-4" />
                Metrics
              </button>
              <button
                onClick={() => {
                  setKind("pricing");
                  setPreview(null);
                }}
                className={
                  "rounded-xl border px-2 py-3 text-xs transition sm:text-sm " +
                  (kind === "pricing"
                    ? "border-blue-300 bg-blue-300/10 text-blue-200"
                    : "border-slate-700 text-slate-400")
                }
              >
                <GitCompare className="mr-1 inline h-4 w-4" />
                Pricing
              </button>
            </div>

            <label
              htmlFor="csv-file"
              className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-600 bg-slate-950/70 px-4 py-7 text-center transition hover:border-cyan-300/70"
            >
              <UploadCloud className="h-7 w-7 text-cyan-300" />
              <span className="mt-2 text-sm font-medium">
                {file ? file.name : "Choose a CSV file"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                CSV only · 10 MB maximum ·{" "}
                {kind === "pricing"
                  ? "user-provided rate catalogue"
                  : kind === "metrics"
                    ? "CPU, memory and activity metrics"
                    : "provider billing export"}
              </span>
            </label>

            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />

            {preview && (
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                <p className="font-semibold text-emerald-200">
                  Validation preview · {preview.provider?.toUpperCase()}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <PreviewCount label="Total rows" value={preview.total_rows} />
                  <PreviewCount label="Valid" value={preview.valid_rows} />
                  <PreviewCount label="Duplicates" value={preview.duplicate_rows ?? 0} />
                  <PreviewCount label="Invalid" value={preview.invalid_rows} />
                </div>

                {preview.total_cost_by_currency && (
                  <p className="mt-3 text-xs text-slate-300">
                    Cost totals:{" "}
                    {Object.entries(preview.total_cost_by_currency)
                      .map(([currency, amount]) => currency + " " + amount)
                      .join(" · ")}
                  </p>
                )}

                {preview.records?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-slate-300">
                      Preview records (first 5)
                    </p>
                    {preview.records.slice(0, 5).map((record: any, index: number) => (
                      <p
                        key={index}
                        className="truncate rounded-md bg-slate-950 px-2 py-1.5 text-[11px] text-slate-400"
                      >
                        {kind === "billing"
                          ? [record.resource_id, record.service_name, record.currency, record.cost]
                              .filter(Boolean)
                              .join(" · ")
                          : kind === "metrics"
                            ? [
                                record.resource_id,
                                record.cpu_utilization_pct !== null
                                  ? "CPU " + record.cpu_utilization_pct + "%"
                                  : null,
                                record.memory_utilization_pct !== null
                                  ? "Memory " + record.memory_utilization_pct + "%"
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : [
                                record.instance_type,
                                record.vcpu + " vCPU",
                                record.memory_gb + " GB",
                                record.currency,
                                record.compute_hourly_cost + "/hr",
                              ].join(" · ")}
                      </p>
                    ))}
                  </div>
                )}

                {preview.warning && (
                  <p className="mt-2 text-xs text-amber-200">{preview.warning}</p>
                )}

                {preview.errors?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-rose-200">
                      Rejected rows (first 5)
                    </p>
                    {preview.errors.slice(0, 5).map((item: any, index: number) => (
                      <p key={index} className="text-xs text-rose-200">
                        Row {item.row}: {item.error}
                      </p>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs text-slate-400">
                  Confirm to save {preview.valid_rows} valid rows to your private workspace.
                </p>
                <button
                  onClick={() => setPreview(null)}
                  className="mt-3 text-xs text-slate-400 underline"
                >
                  Discard preview
                </button>
              </div>
            )}

            <button
              disabled={!file || busy || Boolean(preview && preview.valid_rows === 0)}
              onClick={upload}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : preview ? (
                <Check className="h-4 w-4" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
              {busy
                ? "Processing…"
                : preview
                  ? "Confirm and import " + kind
                  : "Validate and preview CSV"}
            </button>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Billing files provide actual charges. CPU and memory-based recommendations
              require a separate metrics CSV; missing metrics are never assumed to mean
              idle resources.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Total expenditure</h2>
            <p className="mt-1 text-sm text-slate-400">
              Grouped by original billing currency
            </p>

            {currencies.length === 0 ? (
              <Empty text="No billing data imported yet." />
            ) : (
              <div className="mt-5 space-y-3">
                {currencies.map(([currency, amount]) => (
                  <div key={currency} className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs text-slate-500">{currency} total</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency,
                        maximumFractionDigits: 2,
                      }).format(Number(amount))}
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
                {(data?.providers ?? []).length ? (
                  data?.providers.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300"
                    >
                      {item}
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

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-3 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function PreviewCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-950 p-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
