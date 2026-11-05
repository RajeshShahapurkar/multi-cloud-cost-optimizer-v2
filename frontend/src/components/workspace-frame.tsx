"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Cloud, FileClock, GitCompareArrows, LayoutDashboard,
  Settings2, ShieldCheck, UploadCloud, WandSparkles,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/data", label: "Cloud Data", icon: UploadCloud },
  { href: "/dashboard/analytics", label: "Cost Analytics", icon: BarChart3 },
  { href: "/dashboard/optimization", label: "Optimization", icon: WandSparkles },
  { href: "/dashboard/comparison", label: "Cloud Comparison", icon: GitCompareArrows },
  { href: "/dashboard/reports", label: "Reports & History", icon: FileClock },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
];

export default function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[#080d18] text-slate-100 lg:flex-row">
      <aside className="z-30 flex w-full shrink-0 flex-col border-b border-slate-800 bg-[#0b1220] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Cloud className="h-6 w-6" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[.18em] text-cyan-300">FINOPS WORKSPACE</p>
            <p className="truncate text-sm font-semibold text-white">Multi-Cloud Optimizer</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 px-5 pb-3 text-[11px] text-slate-500 lg:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Private workspace
        </div>
        <nav aria-label="Workspace navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:py-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={"flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition " +
                  (active ? "bg-cyan-400/10 font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-300/20" : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100")}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-800 px-5 py-4 text-[11px] leading-5 text-slate-500 lg:block">
          <div className="mb-1 flex items-center gap-2 text-slate-400"><Activity className="h-3.5 w-3.5" /> CSV analysis mode</div>
          Recommendations are advisory. No cloud resources are changed automatically.
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
