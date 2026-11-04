"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Your account was created. Check your email for the verification link, then sign in.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-cyan-500/20 via-slate-900 to-blue-500/10 p-10 lg:flex">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-200"><Cloud/></div><div><p className="text-xs tracking-[.2em] text-cyan-200">FINOPS WORKSPACE</p><p className="text-lg font-semibold">Multi-Cloud Cost Optimizer</p></div></div>
        <div><p className="text-sm font-semibold uppercase tracking-[.2em] text-cyan-200">One view across clouds</p><h1 className="mt-4 text-4xl font-bold leading-tight">Turn billing data into clear optimization actions.</h1><p className="mt-5 text-slate-300">Import cost exports and resource metrics, compare spending, and review explainable recommendations in one place.</p></div>
        <p className="text-xs text-slate-500">AWS · Microsoft Azure · Google Cloud</p>
      </section>
      <section className="p-7 sm:p-10">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="rounded-xl bg-cyan-300/10 p-3 text-cyan-200"><Cloud/></div><span className="font-semibold">Multi-Cloud Cost Optimizer</span></div>
        <p className="text-sm font-semibold text-cyan-300">{mode === "signin" ? "WELCOME BACK" : "CREATE YOUR WORKSPACE"}</p>
        <h2 className="mt-2 text-3xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h2>
        <p className="mt-2 text-sm text-slate-400">Your cloud billing imports remain private to your account.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block text-sm font-medium text-slate-300">Email address
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3"><Mail className="h-4 w-4 text-slate-500"/><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-transparent py-3 outline-none" placeholder="you@example.com"/></span>
          </label>
          <label className="block text-sm font-medium text-slate-300">Password
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3"><LockKeyhole className="h-4 w-4 text-slate-500"/><input required minLength={8} type="password" autoComplete={mode==="signin"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-transparent py-3 outline-none" placeholder="At least 8 characters"/></span>
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin"/>}{mode==="signin"?"Sign in":"Create account"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-400">{mode==="signin"?"New to the platform?":"Already have an account?"}{" "}
          <button onClick={()=>{setMode(mode==="signin"?"signup":"signin");setError("");setMessage("");}} className="font-semibold text-cyan-300 hover:text-cyan-200">{mode==="signin"?"Create an account":"Sign in"}</button>
        </p>
      </section>
    </div>
  </main>;
}
