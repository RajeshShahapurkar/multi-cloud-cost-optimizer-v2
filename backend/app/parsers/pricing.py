import io
import pandas as pd
from app.parsers.common import find_column, parse_decimal, parse_datetime, row_hash, clean

ALIASES = {
    "region": ["region", "location", "resourcelocation"],
    "instance_type": ["instance_type", "instance type", "machine_type", "sku"],
    "vcpu": ["vcpu", "vcpus", "cpu_count", "cores"],
    "memory_gb": ["memory_gb", "memory gb", "ram_gb", "memory"],
    "compute_hourly_cost": ["compute_hourly_cost", "hourly_cost", "price_per_hour", "compute_price_per_hour"],
    "storage_gb_month_cost": ["storage_gb_month_cost", "storage_cost_per_gb_month", "storage_price_per_gb_month"],
    "currency": ["currency", "currency_code", "currencycode"],
    "pricing_date": ["pricing_date", "price_date", "effective_date"],
}

def parse_pricing(content: bytes, provider: str):
    frame = pd.read_csv(io.BytesIO(content))
    mapping = {key: find_column(frame.columns, aliases) for key, aliases in ALIASES.items()}
    required = ["region","instance_type","vcpu","memory_gb","compute_hourly_cost",
                "storage_gb_month_cost","currency","pricing_date"]
    missing = [key for key in required if not mapping[key]]
    if missing:
        raise ValueError("Missing required pricing columns: " + ", ".join(missing))

    rows, errors = [], []
    for index, source in frame.iterrows():
        record = {key: source[col] if col else None for key, col in mapping.items()}
        vcpu_value = parse_decimal(record["vcpu"])
        memory = parse_decimal(record["memory_gb"])
        compute = parse_decimal(record["compute_hourly_cost"])
        storage = parse_decimal(record["storage_gb_month_cost"])
        pricing_date = parse_datetime(record["pricing_date"])
        currency = str(record["currency"]).strip().upper()
        region = clean(record["region"])
        instance_type = clean(record["instance_type"])
        if not region or not instance_type:
            errors.append({"row": int(index)+2, "error": "Region and instance_type are required"})
            continue
        if vcpu_value is None or vcpu_value <= 0 or vcpu_value != vcpu_value.to_integral_value():
            errors.append({"row": int(index)+2, "error": "vCPU must be a positive integer"})
            continue
        if memory is None or memory <= 0:
            errors.append({"row": int(index)+2, "error": "memory_gb must be greater than zero"})
            continue
        if compute is None or compute < 0 or storage is None or storage < 0:
            errors.append({"row": int(index)+2, "error": "Compute and storage rates must be non-negative numbers"})
            continue
        if len(currency) != 3:
            errors.append({"row": int(index)+2, "error": "Currency must be a 3-character code"})
            continue
        if pricing_date is None:
            errors.append({"row": int(index)+2, "error": "pricing_date is invalid"})
            continue
        item = {
            "provider": provider, "region": region, "instance_type": instance_type,
            "vcpu": int(vcpu_value), "memory_gb": str(memory),
            "compute_hourly_cost": str(compute), "storage_gb_month_cost": str(storage),
            "currency": currency, "pricing_date": pricing_date.date().isoformat()
        }
        item["source_row_hash"] = row_hash(item)
        rows.append(item)
    return rows, errors
