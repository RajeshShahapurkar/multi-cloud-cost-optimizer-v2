import io
import pandas as pd
from app.parsers.common import find_column, parse_datetime, parse_decimal

ALIASES = {
 "resource_id":["resource_id","resourceid","resource id"],
 "observed_at":["observed_at","timestamp","date","time"],
 "cpu_utilization_pct":["cpu_utilization_pct","cpu","cpu_percent","cpu utilization"],
 "memory_utilization_pct":["memory_utilization_pct","memory","memory_percent","memory utilization"],
 "active_hours":["active_hours","activehours"],
 "observed_hours":["observed_hours","observedhours","uptime_hours"]
}

def parse_metrics(content: bytes, provider: str):
    frame = pd.read_csv(io.BytesIO(content))
    mapping = {k: find_column(frame.columns,v) for k,v in ALIASES.items()}
    missing = [k for k in ("resource_id","observed_at") if not mapping[k]]
    if missing: raise ValueError("Missing required metric columns: " + ", ".join(missing))
    rows, errors = [], []
    for index, source in frame.iterrows():
        observed = parse_datetime(source[mapping["observed_at"]])
        resource = str(source[mapping["resource_id"]]).strip()
        if not observed or not resource:
            errors.append({"row":int(index)+2,"error":"Missing/invalid resource_id or observed_at"}); continue
        item = {"provider":provider,"resource_id":resource,"observed_at":observed.isoformat()}
        for key in ("cpu_utilization_pct","memory_utilization_pct","active_hours","observed_hours"):
            col = mapping[key]
            value = parse_decimal(source[col]) if col else None
            item[key] = float(value) if value is not None else None
        invalid_pct = any(item[k] is not None and not 0 <= item[k] <= 100 for k in ("cpu_utilization_pct","memory_utilization_pct"))
        invalid_hours = (item["active_hours"] is not None and item["active_hours"] < 0) or (item["observed_hours"] is not None and item["observed_hours"] <= 0)
        if item["active_hours"] is not None and item["observed_hours"] is not None and item["active_hours"] > item["observed_hours"]:
            invalid_hours = True
        if invalid_pct: errors.append({"row":int(index)+2,"error":"Utilization percentage must be between 0 and 100"})
        elif invalid_hours: errors.append({"row":int(index)+2,"error":"Hours must be non-negative and active_hours cannot exceed observed_hours"})
        else: rows.append(item)
    return rows, errors
