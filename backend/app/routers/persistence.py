from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from app.parsers.aws import parse_aws_billing
from app.parsers.azure import parse_azure_billing
from app.parsers.gcp import parse_gcp_billing
from app.parsers.metrics import parse_metrics
from app.routers.uploads import read_csv, PARSERS
from app.services.supabase_rest import get_supabase_client_from_authorization
from app.services.import_service import persist_billing_import, persist_metrics_import, load_dashboard_data

router = APIRouter(tags=["authenticated imports and dashboard"])

@router.post("/imports/billing")
async def import_billing(provider: str=Form(...), file: UploadFile=File(...),
                         authorization: str|None=Header(default=None)):
    db,user = await get_supabase_client_from_authorization(authorization)
    provider=provider.lower()
    if provider not in PARSERS: raise HTTPException(422,"Provider must be aws, azure or gcp")
    content=await read_csv(file)
    try: records,errors=PARSERS[provider](content)
    except Exception as exc: raise HTTPException(422,f"Could not parse {provider} billing CSV: {exc}") from exc
    seen=set(); unique=[]; duplicates=0
    for row in records:
        if row["source_row_hash"] in seen: duplicates+=1
        else: seen.add(row["source_row_hash"]); unique.append(row)
    result=await persist_billing_import(db,user["id"],provider,file.filename or "billing.csv",unique,errors,duplicates)
    return {"provider":provider,"total_rows":len(records)+len(errors),"valid_rows":len(unique),
            "invalid_rows":len(errors),"duplicate_rows":duplicates,**result,
            "message":"Billing data was imported into your private workspace."}

@router.post("/imports/metrics")
async def import_metrics(provider: str=Form(...), file: UploadFile=File(...),
                         authorization: str|None=Header(default=None)):
    db,user=await get_supabase_client_from_authorization(authorization)
    provider=provider.lower()
    if provider not in PARSERS: raise HTTPException(422,"Provider must be aws, azure or gcp")
    content=await read_csv(file)
    try: metrics,errors=parse_metrics(content,provider)
    except Exception as exc: raise HTTPException(422,f"Could not parse metrics CSV: {exc}") from exc
    result=await persist_metrics_import(db,user["id"],provider,file.filename or "metrics.csv",metrics,errors)
    return {"provider":provider,"total_rows":len(metrics)+len(errors),"valid_rows":len(metrics),
            "invalid_rows":len(errors),**result,
            "message":"Resource metrics were imported and recommendations were saved."}

@router.get("/dashboard")
async def dashboard(authorization: str|None=Header(default=None)):
    db,user=await get_supabase_client_from_authorization(authorization)
    result=await load_dashboard_data(db)
    result["user"]={"id":user["id"],"email":user.get("email")}
    return result
