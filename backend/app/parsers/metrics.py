import io
import pandas as pd
from app.parsers.common import find_column, parse_datetime, parse_decimal, clean, row_hash

ALIASES = {
 "resource_id":["resource_id","resourceid","resource id"],
 "observed_at":["observed_at","timestamp","date","time"],
 "cpu_utilization_pct":["cpu_utilization_pct","cpu","cpu_percent","cpu utilization"],
 "memory_utilization_pct":["memory_utilization_pct","memory","memory_percent","memory utilization"],
 "active_hours":["active_hours","activehours"],
 "observed_hours":["observed_hours","observedhours","uptime_hours"],
 "region":["region","location","resourcelocation"],
 "provisioned_vcpu":["provisioned_vcpu","vcpu","vcpus","cores"],
 "provisioned_memory_gb":["provisioned_memory_gb","memory_gb","ram_gb"],
 "pricing_currency":["pricing_currency","currency","currency_code"]
}

def parse_metrics(content: bytes, provider: str):
    frame = pd.read_csv(io.BytesIO(content))
    mapping = {k: find_column(frame.columns,v) for k,v in ALIASES.items()}
    missing = [k for k in ("resource_id","observed_at") if not mapping[k]]
    if missing: raise ValueError("Missing required metric columns: " + ", ".join(missing))
    rows, errors = [], []
    for index, source in frame.iterrows():
        observed = parse_datetime(source[mapping["observed_at"]])
        resource = clean(source[mapping["resource_id"]])
        if not observed or not resource:
            errors.append({"row":int(index)+2,"error":"Missing/invalid resource_id or observed_at"}); continue
        item = {"provider":provider,"resource_id":resource,"observed_at":observed.isoformat()}
        item["region"] = clean(source[mapping["region"]]) if mapping["region"] else None
        item["pricing_currency"] = clean(source[mapping["pricing_currency"]]).upper() if mapping["pricing_currency"] else None
        for key in ("cpu_utilization_pct","memory_utilization_pct","active_hours","observed_hours","provisioned_vcpu","provisioned_memory_gb"):
            col = mapping[key]
            value = parse_decimal(source[col]) if col else None
            item[key] = float(value) if value is not None else None
        invalid_pct = any(item[k] is not None and not 0 <= item[k] <= 100 for k in ("cpu_utilization_pct","memory_utilization_pct"))
        invalid_capacity = (
            (item["provisioned_vcpu"] is not None and (item["provisioned_vcpu"] <= 0 or not float(item["provisioned_vcpu"]).is_integer()))
            or (item["provisioned_memory_gb"] is not None and item["provisioned_memory_gb"] <= 0)
        )
        invalid_hours = (item["active_hours"] is not None and item["active_hours"] < 0) or (item["observed_hours"] is not None and item["observed_hours"] <= 0)
        if item["active_hours"] is not None and item["observed_hours"] is not None and item["active_hours"] > item["observed_hours"]:
            invalid_hours = True
        if invalid_pct: errors.append({"row":int(index)+2,"error":"Utilization percentage must be between 0 and 100"})
        elif invalid_hours: errors.append({"row":int(index)+2,"error":"Hours must be non-negative and active_hours cannot exceed observed_hours"})
        elif invalid_capacity: errors.append({"row":int(index)+2,"error":"Provisioned vCPU and memory must be positive"})
        else:
            if item["provisioned_vcpu"] is not None:
                item["provisioned_vcpu"] = int(item["provisioned_vcpu"])
            item["source_row_hash"] = row_hash(item)
            rows.append(item)
    return rows, errors
