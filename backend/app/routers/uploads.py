from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.settings import settings
from app.parsers.aws import parse_aws_billing
from app.parsers.azure import parse_azure_billing
from app.parsers.gcp import parse_gcp_billing
from app.parsers.metrics import parse_metrics
from app.parsers.pricing import parse_pricing

router = APIRouter(tags=["CSV uploads"])
PARSERS = {"aws":parse_aws_billing,"azure":parse_azure_billing,"gcp":parse_gcp_billing}

async def read_csv(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(415, "Upload a .csv file")
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB limit")
    if not data: raise HTTPException(400, "CSV file is empty")
    return data

@router.post("/uploads/billing/preview")
async def billing_preview(provider: str = Form(...), file: UploadFile = File(...)):
    provider = provider.lower()
    if provider not in PARSERS: raise HTTPException(422, "Provider must be aws, azure or gcp")
    content = await read_csv(file)
    try: records, errors = PARSERS[provider](content)
    except Exception as exc: raise HTTPException(422, f"Could not parse {provider} billing CSV: {exc}") from exc
    unique, seen, duplicates = [], set(), 0
    for row in records:
        key = row["source_row_hash"]
        if key in seen: duplicates += 1
        else: seen.add(key); unique.append(row)
    currencies = sorted({row["currency"] for row in unique})
    totals = {c:round(sum(float(r["cost"]) for r in unique if r["currency"]==c),2) for c in currencies}
    return {"provider":provider,"filename":file.filename,"total_rows":len(records)+len(errors),
      "valid_rows":len(unique),"duplicate_rows":duplicates,"invalid_rows":len(errors),
      "total_cost_by_currency":totals,"records":unique[:100],"errors":errors[:100],
      "warning":"Preview only; confirm the import from your signed-in dashboard to persist these records."}

@router.post("/uploads/metrics/preview")
async def metrics_preview(provider: str = Form(...), file: UploadFile = File(...)):
    provider = provider.lower()
    if provider not in PARSERS: raise HTTPException(422, "Provider must be aws, azure or gcp")
    content = await read_csv(file)
    try: rows, errors = parse_metrics(content, provider)
    except Exception as exc: raise HTTPException(422, f"Could not parse metrics CSV: {exc}") from exc
    return {"provider":provider,"total_rows":len(rows)+len(errors),"valid_rows":len(rows),
            "invalid_rows":len(errors),"records":rows[:100],"errors":errors[:100]}


@router.post("/uploads/pricing/preview")
async def pricing_preview(provider: str = Form(...), file: UploadFile = File(...)):
    provider = provider.lower()
    if provider not in PARSERS:
        raise HTTPException(422, "Provider must be aws, azure or gcp")
    content = await read_csv(file)
    try:
        rows, errors = parse_pricing(content, provider)
    except Exception as exc:
        raise HTTPException(422, f"Could not parse pricing CSV: {exc}") from exc
    seen, unique, duplicates = set(), [], 0
    for row in rows:
        fingerprint = row["source_row_hash"]
        if fingerprint in seen:
            duplicates += 1
        else:
            seen.add(fingerprint)
            unique.append(row)
    return {
        "provider": provider,
        "filename": file.filename,
        "total_rows": len(rows) + len(errors),
        "valid_rows": len(unique),
        "duplicate_rows": duplicates,
        "invalid_rows": len(errors),
        "records": unique[:100],
        "errors": errors[:100],
        "warning": "Rates are user-provided estimates, not live provider quotations."
    }
