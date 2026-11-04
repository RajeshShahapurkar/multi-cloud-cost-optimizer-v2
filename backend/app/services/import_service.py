from __future__ import annotations
from fastapi import HTTPException
from app.services.supabase_rest import SupabaseUserClient
from app.services.billing_analytics import build_cost_summary
from app.services.optimization import detect_idle, detect_underutilized, detect_cost_anomalies
from app.services.forecasting import aggregate_monthly_by_provider, forecast_monthly_costs

def _items(value):
    return value if isinstance(value, list) else ([value] if value else [])

async def get_or_create_profile(db: SupabaseUserClient, user_id: str, provider: str):
    existing = await db.request(
        "GET", "/rest/v1/cloud_profiles",
        params={"select":"id,provider,display_name","provider":f"eq.{provider}","limit":"1"},
    )
    if existing:
        return existing[0]
    created = await db.request(
        "POST", "/rest/v1/cloud_profiles",
        json={"user_id":user_id,"provider":provider,"display_name":provider.upper()},
        prefer="return=representation",
    )
    values = _items(created)
    if not values:
        raise HTTPException(500, "Could not create the cloud profile.")
    return values[0]

async def create_import_batch(db: SupabaseUserClient, user_id: str, profile_id: str,
                              data_type: str, filename: str, total: int, valid: int,
                              invalid: int, duplicates: int):
    result = await db.request(
        "POST", "/rest/v1/import_batches",
        json={"user_id":user_id,"cloud_profile_id":profile_id,"data_type":data_type,
              "original_filename":filename,"status":"imported","total_rows":total,
              "valid_rows":valid,"invalid_rows":invalid,"duplicate_rows":duplicates},
        prefer="return=representation",
    )
    values = _items(result)
    if not values:
        raise HTTPException(500, "Could not create the import batch.")
    return values[0]

async def insert_in_chunks(db: SupabaseUserClient, table_path: str, rows: list[dict], chunk_size: int=250):
    for start in range(0, len(rows), chunk_size):
        await db.request("POST", table_path, json=rows[start:start+chunk_size], prefer="return=minimal")

async def cleanup_batch(db: SupabaseUserClient, batch_id: str):
    await db.request("DELETE", "/rest/v1/import_batches",
                     params={"id":f"eq.{batch_id}"}, prefer="return=minimal")

async def persist_billing_import(db: SupabaseUserClient, user_id: str, provider: str, filename: str,
                                 records: list[dict], errors: list[dict], duplicates: int):
    profile = await get_or_create_profile(db, user_id, provider)
    batch = await create_import_batch(db, user_id, profile["id"], "billing", filename,
                                      len(records)+len(errors)+duplicates, len(records), len(errors), duplicates)
    db_rows = [{
        "user_id":user_id,"import_batch_id":batch["id"],"provider":provider,
        "resource_id":row.get("resource_id"),"resource_name":row.get("resource_name"),
        "service_name":row["service_name"],"resource_type":row.get("resource_type"),
        "region":row.get("region"),"usage_start":row["usage_start"],"usage_end":row.get("usage_end"),
        "usage_quantity":row.get("usage_quantity"),"usage_unit":row.get("usage_unit"),
        "cost":row["cost"],"currency":row["currency"],"charge_type":row.get("charge_type"),
        "source_row_hash":row["source_row_hash"],
    } for row in records]
    try:
        await insert_in_chunks(db, "/rest/v1/billing_records", db_rows)
    except Exception:
        await cleanup_batch(db, batch["id"])
        raise
    return {"import_batch":batch,"summary":build_cost_summary(records),"inserted_records":len(db_rows)}

async def persist_metrics_import(db: SupabaseUserClient, user_id: str, provider: str, filename: str,
                                 metrics: list[dict], errors: list[dict]):
    profile = await get_or_create_profile(db, user_id, provider)
    batch = await create_import_batch(db, user_id, profile["id"], "metrics", filename,
                                      len(metrics)+len(errors), len(metrics), len(errors), 0)
    db_rows = [{
        "user_id":user_id,"import_batch_id":batch["id"],"provider":provider,
        "resource_id":row["resource_id"],"observed_at":row["observed_at"],
        "cpu_utilization_pct":row.get("cpu_utilization_pct"),
        "memory_utilization_pct":row.get("memory_utilization_pct"),
        "active_hours":row.get("active_hours"),"observed_hours":row.get("observed_hours"),
    } for row in metrics]
    findings = detect_idle(metrics) + detect_underutilized(metrics)
    recommendation_rows = [{
        "user_id":user_id,"import_batch_id":batch["id"],"provider":provider,
        "resource_id":item.get("resource_id"),"category":item["category"],
        "severity":item["severity"],
        "title":"Potential idle resource" if item["category"]=="idle_candidate" else "Potentially underutilized resource",
        "explanation":item["recommendation"]+" "+item.get("limitations",""),
        "evidence":item.get("evidence",{}),"status":"new",
    } for item in findings]
    try:
        await insert_in_chunks(db, "/rest/v1/resource_metrics", db_rows)
        if recommendation_rows:
            await insert_in_chunks(db, "/rest/v1/optimization_recommendations", recommendation_rows)
    except Exception:
        await cleanup_batch(db, batch["id"])
        raise
    return {"import_batch":batch,"inserted_metrics":len(db_rows),
            "recommendations":findings,"errors":errors[:100]}


async def persist_pricing_import(db: SupabaseUserClient, user_id: str, provider: str, filename: str,
                                 prices: list[dict], errors: list[dict]):
    profile = await get_or_create_profile(db, user_id, provider)
    batch = await create_import_batch(db, user_id, profile["id"], "pricing", filename,
                                      len(prices)+len(errors), len(prices), len(errors), 0)
    rows = [{
        "user_id":user_id,"import_batch_id":batch["id"],"provider":provider,
        "region":row["region"],"instance_type":row["instance_type"],
        "vcpu":row["vcpu"],"memory_gb":row["memory_gb"],
        "compute_hourly_cost":row["compute_hourly_cost"],
        "storage_gb_month_cost":row["storage_gb_month_cost"],
        "currency":row["currency"],"pricing_date":row["pricing_date"],
        "source_row_hash":row["source_row_hash"],
    } for row in prices]
    try:
        await insert_in_chunks(db, "/rest/v1/pricing_catalogue", rows)
    except Exception:
        await cleanup_batch(db, batch["id"])
        raise
    return {"import_batch":batch,"inserted_prices":len(rows),"errors":errors[:100]}

async def load_dashboard_data(db: SupabaseUserClient):
    billing = await db.request("GET","/rest/v1/billing_records",
        params={"select":"provider,service_name,region,resource_id,usage_start,cost,currency",
                "order":"usage_start.desc","limit":"10000"})
    metrics = await db.request("GET","/rest/v1/resource_metrics",
        params={"select":"provider,resource_id,observed_at,cpu_utilization_pct,memory_utilization_pct,active_hours,observed_hours",
                "order":"observed_at.desc","limit":"10000"})
    recommendations = await db.request("GET","/rest/v1/optimization_recommendations",
        params={"select":"id,provider,resource_id,category,severity,title,explanation,evidence,status,estimated_monthly_savings,currency,created_at",
                "order":"created_at.desc","limit":"500"})
    imports = await db.request("GET","/rest/v1/import_batches",
        params={"select":"id,data_type,original_filename,status,total_rows,valid_rows,invalid_rows,duplicate_rows,created_at,cloud_profile_id",
                "order":"created_at.desc","limit":"100"})
    summary = build_cost_summary(billing or [])
    monthly = aggregate_monthly_by_provider(billing or [])
    anomalies = detect_cost_anomalies([
        {"provider":row["provider"],"currency":row["currency"],"period":row["month"],"cost":row["cost"]}
        for row in monthly
    ])
    forecasts = forecast_monthly_costs(monthly)
    return {"billing_records":len(billing or []),"metric_records":len(metrics or []),
            "providers":sorted({row["provider"] for row in billing or []}),
            "summary":summary,"recommendations":recommendations or [],
            "cost_anomalies":anomalies,"forecasts":forecasts,
            "imports":imports or [],"recent_metrics":(metrics or [])[:200]}
