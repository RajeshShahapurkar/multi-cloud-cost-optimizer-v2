from collections import defaultdict
from statistics import mean

def detect_idle(metric_rows, minimum_observations=3, minimum_observed_hours=3.0):
    """Flag idle candidates only when an explicit activity signal and coverage exist."""
    groups = defaultdict(list)
    for row in metric_rows:
        groups[(row["provider"], row["resource_id"])].append(row)
    findings = []
    for (provider, resource_id), rows in groups.items():
        if len(rows) < minimum_observations:
            continue
        active = [r["active_hours"] for r in rows if r.get("active_hours") is not None]
        observed = [r["observed_hours"] for r in rows if r.get("observed_hours") is not None]
        if not active or not observed:
            continue
        total_active, total_observed = sum(active), sum(observed)
        if total_observed >= minimum_observed_hours and total_active == 0:
            findings.append({
                "provider": provider, "resource_id": resource_id,
                "category": "idle_candidate", "severity": "high",
                "evidence": {"observations": len(rows), "active_hours": total_active,
                             "observed_hours": total_observed},
                "recommendation": "Verify whether this resource is still required; consider scheduling, stopping or removing it only after owner approval.",
                "limitations": "Advisory signal from uploaded activity metrics. Confirm dependencies, minimum capacity and business schedules before action."
            })
    return findings

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
            provisioned_vcpu = [r["provisioned_vcpu"] for r in rows if r.get("provisioned_vcpu") is not None]
            provisioned_memory = [r["provisioned_memory_gb"] for r in rows if r.get("provisioned_memory_gb") is not None]
            regions = [r["region"] for r in rows if r.get("region")]
            current_vcpu = int(round(mean(provisioned_vcpu))) if provisioned_vcpu else None
            current_memory = round(mean(provisioned_memory), 2) if provisioned_memory else None
            right_sizing = current_vcpu is not None and current_memory is not None
            target_vcpu = max(1, current_vcpu // 2) if right_sizing else None
            target_memory = max(1.0, round(current_memory / 2, 2)) if right_sizing else None
            evidence = {"observations":len(rows),"average_cpu_pct":round(avg_cpu,2),
              "average_memory_pct":round(avg_memory,2) if avg_memory is not None else None}
            if right_sizing:
                evidence["current_configuration"] = {"vcpu":current_vcpu,"memory_gb":current_memory}
                evidence["candidate_configuration"] = {"vcpu":target_vcpu,"memory_gb":target_memory}
            if regions:
                evidence["region"] = regions[0]
            findings.append({"provider":provider,"resource_id":resource_id,
              "category":"right_sizing_candidate" if right_sizing else "underutilized",
              "severity":"medium","evidence":evidence,
              "recommendation":(
                f"Review a candidate reduction from {current_vcpu} vCPU / {current_memory} GB RAM "
                f"to {target_vcpu} vCPU / {target_memory} GB RAM after workload and peak-period validation."
                if right_sizing else
                "Review a smaller instance or lower-capacity configuration after workload validation."
              ),
              "region":regions[0] if regions else None,
              "provisioned_vcpu":current_vcpu,"provisioned_memory_gb":current_memory,
              "target_vcpu":target_vcpu,"target_memory_gb":target_memory,
              "limitations":"Advisory finding based only on uploaded utilization metrics; suggested capacity is a starting point, not a guarantee of workload fit."})
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
