"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowUpFromLine, BarChart3, Check, Cloud, FileDown, FileSpreadsheet, Gauge, GitCompare, LoaderCircle, LogOut, RefreshCw, ShieldCheck, TrendingUp, UploadCloud, Wallet, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Provider = "aws" | "azure" | "gcp";
type Recommendation = { id:string; provider:string; resource_id:string|null; category:string; severity:string; title:string; explanation:string; evidence:Record<string,unknown>; status:string; estimated_monthly_savings:number|null; currency:string|null; created_at:string };
type ImportRow = { id:string; data_type:string; original_filename:string; status:string; total_rows:number; valid_rows:number; invalid_rows:number; duplicate_rows:number; created_at:string };
type DashboardData = {
  user:{id:string;email?:string};
  billing_records:number; metric_records:number; providers:string[];
  summary:{
    total_cost_by_currency:Record<string,number>;
    service_costs:{service_name:string;currency:string;cost:number}[];
    region_costs:{region:string;currency:string;cost:number}[];
    monthly_trend:{month:string;currency:string;cost:number}[];
    top_resources:{resource_id:string;service_name:string;currency:string;cost:number}[];
  };
  recommendations:Recommendation[];
  cost_anomalies:{provider:string;currency:string;period:string;current_cost:number;baseline_average:number;increase_pct:number;category:string;severity:string}[];
  forecasts:{provider:string;currency:string;month:string;forecast_cost:number;method:string;history_months:number;limitations:string}[];
  imports:ImportRow[];
};

const providerOptions:Provider[]=["aws","azure","gcp"];

export default function DashboardPage(){
  const router=useRouter();
  const [session,setSession]=useState<any>(null);
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [provider,setProvider]=useState<Provider>("aws");
  const [kind,setKind]=useState<"billing"|"metrics"|"pricing">("billing");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<any>(null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [awsRegion,setAwsRegion]=useState("us-east-1");
  const [azureRegion,setAzureRegion]=useState("eastus");
  const [gcpRegion,setGcpRegion]=useState("us-central1");
  const [compareVcpu,setCompareVcpu]=useState("2");
  const [compareMemory,setCompareMemory]=useState("8");
  const [compareStorage,setCompareStorage]=useState("100");
  const [compareHours,setCompareHours]=useState("730");
  const [compareCurrency,setCompareCurrency]=useState("USD");
  const [compareBusy,setCompareBusy]=useState(false);
  const [compareResult,setCompareResult]=useState<any>(null);

  const loadDashboard=useCallback(async(current:any)=>{
    if(!current?.access_token)return;
    const response=await fetch(API+"/api/dashboard",{headers:{Authorization:"Bearer "+current.access_token},cache:"no-store"});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.detail??"Could not load your dashboard.");
    setData(payload);
  },[]);

  useEffect(()=>{
    const supabase=createClient();
    let alive=true;
    supabase.auth.getSession().then(async({data:{session:current}})=>{
      if(!alive)return;
      if(!current){router.replace("/login");return;}
      setSession(current);
      try{await loadDashboard(current);}catch(e){setError(e instanceof Error?e.message:"Dashboard load failed.");}
      finally{if(alive)setLoading(false);}
    });
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(!alive)return;
      if(!next){router.replace("/login");return;}
      setSession(next);
    });
    return()=>{alive=false;listener.subscription.unsubscribe();};
  },[router,loadDashboard]);

  const refresh=async()=>{
    if(!session)return;
    setError("");
    try{await loadDashboard(session);}catch(e){setError(e instanceof Error?e.message:"Refresh failed.");}
  };

  async function upload(){
    if(!file||!session?.access_token){setError("Choose a CSV file and sign in.");return;}
    setBusy(true);setError("");setNotice("");
    const form=new FormData();form.append("provider",provider);form.append("file",file);
    try{
      const endpoint = preview
        ? (kind==="billing"?"imports/billing":kind==="metrics"?"imports/metrics":"imports/pricing")
        : (kind==="billing"?"uploads/billing/preview":kind==="metrics"?"uploads/metrics/preview":"uploads/pricing/preview");
      const headers:Record<string,string> = preview ? {Authorization:"Bearer "+session.access_token} : {};
      const response=await fetch(API+"/api/"+endpoint,{method:"POST",headers,body:form});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.detail??(preview?"Import failed.":"CSV validation failed."));
      if(!preview){
        setPreview(payload);
        setNotice("Validation complete. Review the accepted and rejected rows before confirming the import.");
        return;
      }
      setNotice(kind==="billing"
        ?"Imported "+payload.inserted_records+" billing rows for "+provider.toUpperCase()+"."
        :kind==="metrics"
          ?"Imported "+payload.inserted_metrics+" metrics rows and generated "+(payload.recommendations?.length??0)+" recommendations."
          :"Imported "+payload.inserted_prices+" user-provided pricing records for "+provider.toUpperCase()+".");
      setPreview(null);
      setFile(null);
      const input=document.getElementById("csv-file") as HTMLInputElement|null;
      if(input)input.value="";
      await loadDashboard(session);
    }catch(e){setError(e instanceof Error?e.message:"Import failed. Check your API configuration.");}
    finally{setBusy(false);}
  }

  async function changeRecommendation(item:Recommendation,status:"accepted"|"dismissed"|"implemented"){
    if(!session?.access_token)return;
    try{
      const response=await fetch(API+"/api/recommendations/"+item.id,{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({status})
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.detail??"Could not update recommendation.");
      await loadDashboard(session);
    }catch(e){setError(e instanceof Error?e.message:"Recommendation update failed.");}
  }


  async function compareCloudCosts(){
    if(!session?.access_token){setError("Please sign in again.");return;}
    setCompareBusy(true);setCompareResult(null);setError("");
    try{
      const response=await fetch(API+"/api/comparison/estimate",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({
          regions:{aws:awsRegion,azure:azureRegion,gcp:gcpRegion},vcpu:Number(compareVcpu),memory_gb:Number(compareMemory),
          storage_gb:Number(compareStorage),hours_per_month:Number(compareHours),currency:compareCurrency.toUpperCase()
        })
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.detail??"Cost comparison failed.");
      setCompareResult(payload);
    }catch(e){setError(e instanceof Error?e.message:"Cost comparison failed.");}
    finally{setCompareBusy(false);}
  }

  async function downloadReport(){
    if(!session?.access_token){setError("Please sign in again.");return;}
    try{
      const response=await fetch(API+"/api/reports/summary.pdf",{headers:{Authorization:"Bearer "+session.access_token}});
      if(!response.ok){const payload=await response.json();throw new Error(payload.detail??"Could not generate the PDF report.");}
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="multi-cloud-cost-optimizer-report.pdf";anchor.click();
      URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"PDF download failed.");}
  }

  async function signOut(){
    await createClient().auth.signOut();
    router.replace("/login");router.refresh();
  }

  const currencies=Object.entries(data?.summary?.total_cost_by_currency??{});
  const monthly=data?.summary?.monthly_trend??[];
  const chartCurrency=monthly.length?monthly[0].currency:undefined;
  const chartData=useMemo(()=>monthly.filter(x=>x.currency===chartCurrency).map(x=>({month:x.month,cost:x.cost})),[monthly,chartCurrency]);
  const pending=(data?.recommendations??[]).filter(x=>x.status==="new");

  if(loading)return <main className="flex min-h-screen items-center justify-center text-slate-300"><LoaderCircle className="mr-3 h-5 w-5 animate-spin"/>Loading your workspace…</main>;

  return <main className="min-h-screen bg-[#080d18] text-slate-100">
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#080d18]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Cloud/></div><div><p className="text-[10px] font-semibold tracking-[.22em] text-cyan-300">FINOPS WORKSPACE</p><p className="font-semibold">Multi-Cloud Cost Optimizer</p></div></div>
        <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-400 sm:inline">{data?.user?.email}</span><button onClick={refresh} title="Refresh dashboard" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><RefreshCw className="h-4 w-4"/></button><button onClick={signOut} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><LogOut className="h-4 w-4"/><span className="hidden sm:inline">Sign out</span></button></div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-5 py-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-sm font-semibold tracking-[.16em] text-cyan-300">CLOUD SPEND OVERVIEW</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your optimization workspace</h1><p className="mt-2 text-slate-400">Import billing exports and resource metrics to create a unified view of your cloud costs.</p></div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-200"><ShieldCheck className="mr-2 inline h-4 w-4"/>Private workspace · RLS enabled</div>
      </section>

      {error&&<div className="mt-6 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"><span>{error}</span><button onClick={()=>setError("")}><X className="h-4 w-4"/></button></div>}
      {notice&&<div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200"><span><Check className="mr-2 inline h-4 w-4"/>{notice}</span><button onClick={()=>setNotice("")}><X className="h-4 w-4"/></button></div>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Wallet/>} label="Imported billing rows" value={data?.billing_records??0}/>
        <Stat icon={<Activity/>} label="Resource metrics" value={data?.metric_records??0}/>
        <Stat icon={<Cloud/>} label="Cloud providers" value={(data?.providers??[]).length}/>
        <Stat icon={<AlertTriangle/>} label="Open recommendations" value={pending.length}/>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Import cloud data</h2><p className="mt-1 text-sm text-slate-400">Files are parsed and saved to your private database.</p></div><UploadCloud className="h-6 w-6 text-cyan-300"/></div>
          <div className="mt-5 grid grid-cols-3 gap-2">{providerOptions.map(p=><button key={p} onClick={()=>{setProvider(p);setPreview(null);}} className={"rounded-xl border px-3 py-3 text-sm font-semibold "+(provider===p?"border-cyan-300 bg-cyan-300/10 text-cyan-200":"border-slate-700 text-slate-400 hover:bg-slate-800")}>{p==="gcp"?"Google Cloud":p.toUpperCase()}</button>)}</div>
          <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={()=>{setKind("billing");setPreview(null);}} className={"rounded-xl border px-2 py-3 text-xs sm:text-sm "+(kind==="billing"?"border-blue-300 bg-blue-300/10 text-blue-200":"border-slate-700 text-slate-400")}><FileSpreadsheet className="mr-1 inline h-4 w-4"/>Billing</button><button onClick={()=>{setKind("metrics");setPreview(null);}} className={"rounded-xl border px-2 py-3 text-xs sm:text-sm "+(kind==="metrics"?"border-blue-300 bg-blue-300/10 text-blue-200":"border-slate-700 text-slate-400")}><Gauge className="mr-1 inline h-4 w-4"/>Metrics</button><button onClick={()=>{setKind("pricing");setPreview(null);}} className={"rounded-xl border px-2 py-3 text-xs sm:text-sm "+(kind==="pricing"?"border-blue-300 bg-blue-300/10 text-blue-200":"border-slate-700 text-slate-400")}><GitCompare className="mr-1 inline h-4 w-4"/>Pricing</button></div>
          <label htmlFor="csv-file" className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-600 bg-slate-950/70 px-4 py-7 text-center hover:border-cyan-300/70"><UploadCloud className="h-7 w-7 text-cyan-300"/><span className="mt-2 text-sm font-medium">{file?file.name:"Choose a CSV file"}</span><span className="mt-1 text-xs text-slate-500">CSV only · 10 MB maximum · {kind==="pricing"?"user-provided rate catalogue":kind==="metrics"?"CPU, memory and activity metrics":"provider billing export"}</span></label>
          <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);}}/>
          {preview&&<div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
            <p className="font-semibold text-emerald-200">Validation preview · {preview.provider?.toUpperCase()}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PreviewCount label="Total rows" value={preview.total_rows}/>
              <PreviewCount label="Valid" value={preview.valid_rows}/>
              <PreviewCount label="Duplicates" value={preview.duplicate_rows??0}/>
              <PreviewCount label="Invalid" value={preview.invalid_rows}/>
            </div>
            {preview.total_cost_by_currency&&<p className="mt-3 text-xs text-slate-300">Cost totals: {Object.entries(preview.total_cost_by_currency).map(([currency,amount])=>currency+" "+amount).join(" · ")}</p>}
            {preview.records?.length>0&&<div className="mt-3 space-y-1"><p className="text-xs font-semibold text-slate-300">Preview records (first 5)</p>{preview.records.slice(0,5).map((record:any,index:number)=><p key={index} className="truncate rounded-md bg-slate-950 px-2 py-1.5 text-[11px] text-slate-400">{kind==="billing"?[record.resource_id,record.service_name,record.currency,record.cost].filter(Boolean).join(" · "):kind==="metrics"?[record.resource_id,record.cpu_utilization_pct!==null?"CPU "+record.cpu_utilization_pct+"%":null,record.memory_utilization_pct!==null?"Memory "+record.memory_utilization_pct+"%":null].filter(Boolean).join(" · "):[record.instance_type,record.vcpu+" vCPU",record.memory_gb+" GB",record.currency,record.compute_hourly_cost+"/hr"].join(" · ")}</p>)}</div>}
            {preview.warning&&<p className="mt-2 text-xs text-amber-200">{preview.warning}</p>}
            {preview.errors?.length>0&&<div className="mt-3 space-y-1"><p className="text-xs font-semibold text-rose-200">Rejected rows (first 5)</p>{preview.errors.slice(0,5).map((item:any,index:number)=><p key={index} className="text-xs text-rose-200">Row {item.row}: {item.error}</p>)}</div>}
            <p className="mt-3 text-xs text-slate-400">Confirm to save {preview.valid_rows} valid rows to your private workspace.</p>
            <button onClick={()=>setPreview(null)} className="mt-3 text-xs text-slate-400 underline">Discard preview</button>
          </div>}
          <button disabled={!file||busy||Boolean(preview&&preview.valid_rows===0)} onClick={upload} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:preview?<Check className="h-4 w-4"/>:<ArrowUpFromLine className="h-4 w-4"/>}{busy?"Processing…":preview?"Confirm and import "+kind:"Validate and preview CSV"}</button>
          <p className="mt-3 text-xs leading-5 text-slate-500">Billing files provide actual charges. CPU and memory-based recommendations require a separate metrics CSV; missing metrics are never assumed to mean idle resources.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Total expenditure</h2><p className="mt-1 text-sm text-slate-400">Grouped by original billing currency</p>
          {currencies.length===0?<Empty text="No billing data imported yet."/>:<div className="mt-5 space-y-3">{currencies.map(([currency,amount])=><div key={currency} className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">{currency} total</p><p className="mt-1 text-2xl font-bold tabular-nums">{new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(amount)}</p></div>)}</div>}
          <div className="mt-6 border-t border-slate-800 pt-5"><div className="flex items-center justify-between"><h3 className="font-medium">Imported cloud providers</h3><span className="text-xs text-slate-500">CSV profiles</span></div><div className="mt-3 flex flex-wrap gap-2">{(data?.providers??[]).length?data?.providers.map(p=><span key={p} className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">{p}</span>):<p className="text-sm text-slate-500">Provider profiles appear after your first import.</p>}</div></div>
        </div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Monthly spend trend</h2><p className="mt-1 text-xs text-slate-500">{chartCurrency?"Values in "+chartCurrency:"Upload billing data to see trends"}</p></div><BarChart3 className="text-cyan-300"/></div>{chartData.length?<div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="#263244" strokeDasharray="3 3"/><XAxis dataKey="month" stroke="#8492a6" fontSize={11}/><YAxis stroke="#8492a6" fontSize={11}/><Tooltip contentStyle={{background:"#0b1220",border:"1px solid #334155",borderRadius:12}}/><Bar dataKey="cost" fill="#38bdf8" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>:<Empty text="Monthly expenditure will appear after importing billing CSVs."/>}</div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6"><h2 className="font-semibold">Spend by service</h2><p className="mt-1 text-xs text-slate-500">Top services, grouped by currency</p>{data?.summary?.service_costs?.length?<div className="mt-5 space-y-3">{data.summary.service_costs.slice(0,7).map((item,index)=><div key={index}><div className="flex justify-between gap-3 text-sm"><span className="text-slate-300">{item.service_name}</span><span className="font-medium tabular-nums">{item.currency} {item.cost.toFixed(2)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{width:String(Math.max(3,Math.min(100,item.cost/Math.max(...data.summary.service_costs.map(x=>x.cost))*100)))+"%"}}/></div></div>)}</div>:<Empty text="Service costs will appear after importing billing data."/>}</div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Cost anomaly signals</h2><p className="mt-1 text-xs text-slate-500">Provider-specific monthly history</p></div><AlertTriangle className="text-amber-300"/></div>
          {data?.cost_anomalies?.length?<div className="mt-4 space-y-3">{data.cost_anomalies.map((item,index)=><div key={index} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-amber-100">{item.provider.toUpperCase()} · {item.period}</span><span className="text-amber-200">+{item.increase_pct.toFixed(1)}%</span></div><p className="mt-1 text-xs text-slate-400">{item.currency} {item.current_cost.toFixed(2)} vs {item.currency} {item.baseline_average.toFixed(2)} historical baseline</p></div>)}</div>:<Empty text="No anomaly met the threshold with enough monthly history."/>}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Spend forecast</h2><p className="mt-1 text-xs text-slate-500">Next three months by provider and currency</p></div><TrendingUp className="text-cyan-300"/></div>
          {data?.forecasts?.length?<div className="mt-4 space-y-2">{data.forecasts.map((item,index)=><div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2 text-sm"><span className="text-slate-300">{item.provider.toUpperCase()} · {item.month}</span><span className="font-medium tabular-nums">{item.currency} {item.forecast_cost.toFixed(2)}</span></div>)}<p className="mt-2 text-[11px] leading-5 text-slate-500">Linear trend estimate from uploaded history; not a guaranteed bill.</p></div>:<Empty text="At least three months of billing history are required for a trend forecast."/>}
        </div>
      </section>

      <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Cross-cloud configuration comparison</h2><p className="mt-1 text-sm text-slate-400">Enter each provider's region code separately, then compare equivalent VM requirements using your uploaded pricing.</p></div><GitCompare className="text-cyan-300"/></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="AWS region" value={awsRegion} onChange={setAwsRegion}/>
          <Field label="Azure region" value={azureRegion} onChange={setAzureRegion}/>
          <Field label="GCP region" value={gcpRegion} onChange={setGcpRegion}/>
          <Field label="vCPU" value={compareVcpu} onChange={setCompareVcpu} type="number"/>
          <Field label="Memory (GB)" value={compareMemory} onChange={setCompareMemory} type="number"/>
          <Field label="Storage (GB)" value={compareStorage} onChange={setCompareStorage} type="number"/>
          <Field label="Hours / month" value={compareHours} onChange={setCompareHours} type="number"/>
          <Field label="Currency" value={compareCurrency} onChange={setCompareCurrency}/>
        </div>
        <button disabled={compareBusy} onClick={compareCloudCosts} className="mt-4 flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{compareBusy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<GitCompare className="h-4 w-4"/>}Compare provider estimates</button>
        {compareResult&&<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-sm font-semibold text-cyan-200">{compareResult.lowest_cost_provider?"Lowest estimate: "+compareResult.lowest_cost_provider.toUpperCase():"No matching catalogue rows found"}</p>{compareResult.options?.length?<div className="mt-3 grid gap-2 sm:grid-cols-3">{compareResult.options.map((option:any,index:number)=><div key={index} className="rounded-lg border border-slate-800 p-3"><p className="text-xs uppercase text-slate-500">{option.provider}</p><p className="mt-1 text-lg font-bold">{option.currency} {option.estimated_monthly_cost.toFixed(2)}</p><p className="mt-1 text-xs text-slate-400">{option.instance_type} · {option.vcpu} vCPU · {option.memory_gb} GB</p><p className="mt-1 text-[10px] text-slate-500">Price date: {option.pricing_date}</p></div>)}</div>:<p className="mt-2 text-xs text-slate-400">Upload a pricing CSV for each provider you wish to compare.</p>}<p className="mt-3 text-[11px] leading-5 text-slate-500">{compareResult.note}</p></div>}
      </section>

      <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Optimization recommendations</h2><p className="mt-1 text-sm text-slate-400">Evidence-based findings from uploaded resource metrics</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{pending.length} new</span></div>
        {!(data?.recommendations?.length)?<Empty text="Upload resource metrics to generate idle-resource and right-sizing findings."/>:<div className="mt-4 grid gap-3">{data.recommendations.map(item=><div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs uppercase tracking-wide text-cyan-300">{item.provider}</span><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-400">{item.severity}</span><span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">{item.status}</span></div><h3 className="mt-2 font-medium">{item.title} · {item.resource_id??"resource"}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{item.explanation}</p>{item.estimated_monthly_savings!==null&&item.currency&&<p className="mt-2 text-xs font-semibold text-emerald-300">Estimated compute savings: {item.currency} {item.estimated_monthly_savings.toFixed(2)} / month</p>}</div>{item.status==="new"&&<div className="flex shrink-0 gap-2"><button onClick={()=>changeRecommendation(item,"accepted")} className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-400/10">Accept</button><button onClick={()=>changeRecommendation(item,"dismissed")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800">Dismiss</button></div>}</div></div>)}</div>}
      </section>

      <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Import history</h2><button onClick={downloadReport} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"><FileDown className="h-4 w-4"/>Download PDF report</button></div>
        {!(data?.imports?.length)?<Empty text="Your uploaded billing and metrics files will be listed here."/>:<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-3">File</th><th>Type</th><th>Rows</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.imports.map(item=><tr key={item.id} className="border-t border-slate-800"><td className="py-3 pr-4">{item.original_filename}</td><td className="pr-4 capitalize">{item.data_type}</td><td className="pr-4">{item.valid_rows}/{item.total_rows}</td><td className="pr-4 text-emerald-300">{item.status}</td><td className="text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
      </section>
      <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-5 text-xs text-slate-500"><span>Multi-Cloud Cost Optimizer · CSV analysis mode</span><span>Recommendations are advisory; no cloud resource is changed automatically.</span></footer>
    </div>
  </main>;
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:number}){return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300">{icon}</span></div><p className="mt-4 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p></div>}
function Empty({text}:{text:string}){return <div className="flex min-h-32 items-center justify-center px-3 text-center text-sm text-slate-500">{text}</div>}
function PreviewCount({label,value}:{label:string;value:number}){return <div className="rounded-lg bg-slate-950 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>}
function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(value:string)=>void;type?:React.HTMLInputTypeAttribute}){return <label className="block text-xs text-slate-400">{label}<input type={type} value={value} onChange={event=>onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-300"/></label>}
