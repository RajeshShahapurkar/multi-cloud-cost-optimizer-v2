"use client";

import { useState } from "react";
import { BrainCircuit, CheckCircle2, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";
import WorkspaceHeader from "@/components/workspace-header";
import { API, useWorkspaceData } from "@/lib/use-workspace-data";

type Recommendation = {
  provider: string;
  provider_region: string;
  location: string;
  instance_type: string;
  vcpu: number;
  memory_gb: number;
  architecture: string;
  cpu_platform: string | null;
  estimated_monthly_cost_usd: number;
  within_budget: boolean;
  ml_suitability_score: number;
  price_checked_on: string;
  price_source_url: string;
};

type AdvisorResult = {
  recommended_provider: string;
  recommendations: Recommendation[];
  note: string;
  model_metrics: {
    algorithm: string;
    mae: number;
    rmse: number;
    r2: number;
    synthetic_scenarios: number;
    catalogue_rows: number;
    evaluation_note: string;
  };
};

const fieldClass = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300";

export default function ProviderAdvisorPage() {
  const { session, data, loading, error, setError, refresh } = useWorkspaceData();
  const [vcpu, setVcpu] = useState("2");
  const [memory, setMemory] = useState("8");
  const [hours, setHours] = useState("730");
  const [budget, setBudget] = useState("100");
  const [goal, setGoal] = useState("cost");
  const [profile, setProfile] = useState("general_purpose");
  const [architecture, setArchitecture] = useState("any");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);

  async function recommend() {
    if (!session?.access_token) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(API + "/api/provider-advisor/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          region_group: "India",
          requested_vcpu: Number(vcpu),
          requested_memory_gb: Number(memory),
          usage_hours: Number(hours),
          monthly_budget_usd: Number(budget),
          optimization_goal: goal,
          workload_profile: profile,
          architecture_preference: architecture,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "Provider recommendation failed.");
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider recommendation failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Loading Provider Advisor…</div>;

  return (
    <div>
      <WorkspaceHeader
        title="Provider Advisor"
        description="Use an ML model to rank feasible cloud VM options against your workload requirements."
        email={data?.user.email}
        onRefresh={refresh}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        <section>
          <p className="text-xs font-semibold tracking-[.18em] text-cyan-300">INTELLIGENT PROVIDER SELECTION</p>
          <h2 className="mt-2 text-2xl font-bold">Which cloud provider fits your workload?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Enter your compute requirements and preferences. The Random Forest model scores available AWS, Azure and Google Cloud VM configurations using public Linux list-price inputs.
          </p>
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-100">
          <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
          <p>
            ML model trained on synthetic workload scenarios using a dated public price/configuration catalogue. This first version covers general-purpose Linux virtual machines in India; it does not compare managed databases, object storage or serverless services.
          </p>
        </div>

        {error && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-300" /><h3 className="font-semibold">Workload requirements</h3></div>
          <p className="mt-1 text-xs text-slate-500">Prices are shown in USD. Current catalogue covers 2, 4 and 8 vCPU configurations.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs text-slate-400">Region group<input disabled value="India" className={fieldClass + " opacity-70"} /></label>
            <label className="block text-xs text-slate-400">Required vCPU<input type="number" min="1" max="8" value={vcpu} onChange={e=>setVcpu(e.target.value)} className={fieldClass}/></label>
            <label className="block text-xs text-slate-400">Required RAM (GB)<input type="number" min="1" max="32" step="0.5" value={memory} onChange={e=>setMemory(e.target.value)} className={fieldClass}/></label>
            <label className="block text-xs text-slate-400">Expected usage (hours/month)<input type="number" min="1" max="730" value={hours} onChange={e=>setHours(e.target.value)} className={fieldClass}/></label>
            <label className="block text-xs text-slate-400">Monthly budget (USD)<input type="number" min="1" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} className={fieldClass}/></label>
            <label className="block text-xs text-slate-400">Optimization priority<select value={goal} onChange={e=>setGoal(e.target.value)} className={fieldClass}><option value="cost">Lowest cost</option><option value="balanced">Balanced cost and capacity</option><option value="performance">More capacity headroom</option></select></label>
            <label className="block text-xs text-slate-400">Workload profile<select value={profile} onChange={e=>setProfile(e.target.value)} className={fieldClass}><option value="general_purpose">General purpose / web app</option><option value="compute_heavy">Compute-heavy</option><option value="memory_heavy">Memory-heavy</option></select></label>
            <label className="block text-xs text-slate-400">CPU architecture preference<select value={architecture} onChange={e=>setArchitecture(e.target.value)} className={fieldClass}><option value="any">Any architecture</option><option value="arm64">ARM64</option><option value="x86_64">x86-64</option></select></label>
          </div>
          <button onClick={recommend} disabled={busy || !vcpu || !memory || !hours || !budget} className="mt-5 flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <BrainCircuit className="h-4 w-4"/>}
            {busy ? "Evaluating providers…" : "Recommend cloud provider"}
          </button>
        </section>

        {result && (
          <>
            <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="h-5 w-5"/><span className="text-xs font-semibold tracking-[.16em]">TOP ML RECOMMENDATION</span></div>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-3xl font-bold">{result.recommended_provider.toUpperCase()}</h3><p className="mt-1 text-sm text-slate-300">Highest predicted suitability score for the submitted requirements.</p></div>
                <p className="text-xs text-slate-400">Ranked using the trained Random Forest model</p>
              </div>
            </section>

            <section className="space-y-3">
              <div><h3 className="font-semibold">Provider ranking</h3><p className="mt-1 text-xs text-slate-500">One best-fitting eligible VM configuration per provider.</p></div>
              <div className="grid gap-3 lg:grid-cols-3">
                {result.recommendations.map((item, index) => (
                  <article key={item.provider} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold uppercase">{index + 1}. {item.provider}</p><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{item.ml_suitability_score.toFixed(1)} / 100</span></div>
                    <p className="mt-4 text-2xl font-bold tabular-nums">${item.estimated_monthly_cost_usd.toFixed(2)}<span className="ml-1 text-xs font-normal text-slate-500">/ estimate</span></p>
                    <p className="mt-2 text-sm font-medium text-slate-200">{item.instance_type}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.vcpu} vCPU · {item.memory_gb} GB RAM · {item.architecture}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.provider_region} · {item.location}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs">{item.within_budget ? <CheckCircle2 className="h-4 w-4 text-emerald-300"/> : <CircleAlert className="h-4 w-4 text-amber-300"/>}<span className={item.within_budget ? "text-emerald-200" : "text-amber-200"}>{item.within_budget ? "Within your budget" : "Above your budget"}</span></div>
                    <p className="mt-3 text-[11px] text-slate-500">Price checked {item.price_checked_on} · <a href={item.price_source_url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Source</a></p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-semibold">Model evaluation</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metric label="MAE" value={result.model_metrics.mae.toFixed(2)}/>
                <Metric label="RMSE" value={result.model_metrics.rmse.toFixed(2)}/>
                <Metric label="R²" value={result.model_metrics.r2.toFixed(3)}/>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{result.model_metrics.algorithm} · {result.model_metrics.synthetic_scenarios.toLocaleString()} generated workload scenarios · {result.model_metrics.catalogue_rows} real catalogue entries. {result.model_metrics.evaluation_note}</p>
            </section>

            <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100">
              <p className="font-semibold">Pricing and model limitations</p>
              <p className="mt-1">{result.note}</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}
