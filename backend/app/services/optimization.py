from collections import defaultdict
from statistics import mean

def detect_underutilized(metric_rows, cpu_threshold=20.0, memory_threshold=25.0, minimum_observations=3):
    groups = defaultdict(list)
    for row in metric_rows: groups[(row["provider"],row["resource_id"])].append(row)
    findings = []
    for (provider,resource_id), rows in groups.items():
        cpu = [r["cpu_utilization_pct"] for r in rows if r.get("cpu_utilization_pct") is not None]
        memory = [r["memory_utilization_pct"] for r in rows if r.get("memory_utilization_pct") is not None]
        if len(rows)<minimum_observations or not cpu: continue
        avg_cpu, avg_memory = mean(cpu), mean(memory) if memory else None
        if avg_cpu<cpu_threshold and (avg_memory is None or avg_memory<memory_threshold):
            findings.append({"provider":provider,"resource_id":resource_id,"category":"underutilized",
              "severity":"medium","evidence":{"observations":len(rows),"average_cpu_pct":round(avg_cpu,2),
              "average_memory_pct":round(avg_memory,2) if avg_memory is not None else None},
              "recommendation":"Review a smaller instance or lower-capacity configuration after workload validation.",
              "limitations":"Advisory finding based only on uploaded utilization metrics; not a live cloud observation."})
    return findings

def detect_cost_anomalies(period_costs, threshold_pct=30.0, minimum_baseline=3):
    groups = defaultdict(list)
    for row in period_costs: groups[(row["provider"],row["currency"])].append(row)
    findings=[]
    for (provider,currency), rows in groups.items():
        rows.sort(key=lambda x:x["period"])
        if len(rows)<minimum_baseline+1: continue
        baseline=[float(x["cost"]) for x in rows[:-1]]
        current=float(rows[-1]["cost"]); avg=mean(baseline)
        if avg>0:
            increase=(current-avg)/avg*100
            if increase>=threshold_pct:
                findings.append({"provider":provider,"currency":currency,"period":rows[-1]["period"],
                    "current_cost":current,"baseline_average":round(avg,2),"increase_pct":round(increase,2),
                    "category":"cost_spike","severity":"high"})
    return findings

def estimate_savings(current_monthly_cost, target_monthly_cost):
    current,target=float(current_monthly_cost),float(target_monthly_cost)
    if current<0 or target<0: raise ValueError("Costs must be non-negative")
    return {"current_monthly_cost":current,"target_monthly_cost":target,
       "estimated_monthly_savings":round(max(current-target,0),2),
       "assumption":"Target cost must come from a verified catalogue or an explicitly stated user assumption."}
