from __future__ import annotations
import hashlib, json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any
import pandas as pd

ALIASES = {
 "resource_id": ["resource_id","resourceid","resource id","lineitem/resourceid","resource.name"],
 "resource_name": ["resource_name","resourcename","resource name"],
 "service_name": ["service_name","service","product/productname","consumedservice","service.description"],
 "resource_type": ["resource_type","instancetype","metercategory","sku_description"],
 "region": ["region","product/region","resourcelocation","location.region"],
 "usage_start": ["usage_start","usage_start_date","lineitem/usagestartdate","date","usage_start_time"],
 "usage_end": ["usage_end","usage_end_date","lineitem/usageenddate","usage_end_time"],
 "usage_quantity": ["usage_quantity","usageamount","quantity"],
 "usage_unit": ["usage_unit","pricingunit","unit"],
 "cost": ["cost","unblendedcost","lineitem/unblendedcost","pretaxcost","costinbillingcurrency","costatlist"],
 "currency": ["currency","currencycode","billingcurrency","lineitem/currencycode"],
 "charge_type": ["charge_type","chargetype","lineitem/lineitemtype","costtype"]
}

def find_column(columns, aliases):
    normalized = {str(c).strip().lower(): c for c in columns}
    compact = {str(c).strip().lower().replace(" ", ""): c for c in columns}
    for alias in aliases:
        if alias in normalized: return normalized[alias]
        if alias.replace(" ", "") in compact: return compact[alias.replace(" ", "")]
    return None

def parse_decimal(value: Any):
    if value is None or pd.isna(value) or str(value).strip() == "": return None
    try: return Decimal(str(value).strip().replace(",", "").replace("$", "").replace("₹", ""))
    except InvalidOperation: return None

def parse_datetime(value: Any):
    if value is None or pd.isna(value) or str(value).strip() == "": return None
    parsed = pd.to_datetime(value, utc=True, errors="coerce")
    return None if pd.isna(parsed) else parsed.to_pydatetime()

def row_hash(row: dict):
    serial = json.dumps({k: str(v) if v is not None else None for k,v in sorted(row.items())}, sort_keys=True)
    return hashlib.sha256(serial.encode()).hexdigest()

def clean(value):
    if value is None or pd.isna(value) or str(value).strip() == "": return None
    return str(value).strip()

def normalize_billing_frame(frame: pd.DataFrame, provider: str):
    mapping = {key: find_column(frame.columns, aliases) for key,aliases in ALIASES.items()}
    missing = [key for key in ("service_name","usage_start","cost","currency") if not mapping[key]]
    if missing: raise ValueError("Missing required columns: " + ", ".join(missing))
    accepted, errors = [], []
    for index, source in frame.iterrows():
        record = {key: source[col] if col else None for key,col in mapping.items()}
        cost, start = parse_decimal(record["cost"]), parse_datetime(record["usage_start"])
        if cost is None:
            errors.append({"row": int(index)+2, "error": "Invalid or missing cost"}); continue
        if start is None:
            errors.append({"row": int(index)+2, "error": "Invalid or missing usage_start"}); continue
        currency = str(record["currency"]).strip().upper()
        if len(currency) != 3:
            errors.append({"row": int(index)+2, "error": "Currency must be a 3-character code"}); continue
        item = {
          "provider": provider, "resource_id": clean(record["resource_id"]),
          "resource_name": clean(record["resource_name"]), "service_name": str(record["service_name"]).strip(),
          "resource_type": clean(record["resource_type"]), "region": clean(record["region"]),
          "usage_start": start.isoformat(),
          "usage_end": parse_datetime(record["usage_end"]).isoformat() if parse_datetime(record["usage_end"]) else None,
          "usage_quantity": str(parse_decimal(record["usage_quantity"])) if parse_decimal(record["usage_quantity"]) is not None else None,
          "usage_unit": clean(record["usage_unit"]), "cost": str(cost), "currency": currency,
          "charge_type": clean(record["charge_type"])
        }
        item["source_row_hash"] = row_hash(item)
        accepted.append(item)
    return accepted, errors
