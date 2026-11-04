from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from app.parsers.metrics import parse_metrics
from app.parsers.aws import parse_aws_billing
from app.parsers.azure import parse_azure_billing
from app.parsers.gcp import parse_gcp_billing
from app.routers.uploads import read_csv, PARSERS
from app.services.optimization import detect_underutilized, detect_cost_anomalies, estimate_savings

router = APIRouter(tags=["optimization analysis"])

class PeriodCost(BaseModel):
    provider: str
    currency: str = Field(min_length=3, max_length=3)
    period: str
    cost: float = Field(ge=0)

class SavingsRequest(BaseModel):
    current_monthly_cost: float = Field(ge=0)
    target_monthly_cost: float = Field(ge=0)

@router.post("/analysis/metrics")
async def analyse_metrics(provider: str = Form(...), file: UploadFile = File(...)):
    provider = provider.lower()
    if provider not in PARSERS:
        raise HTTPException(422, "Provider must be aws, azure or gcp")
    content = await read_csv(file)
    try:
        metrics, errors = parse_metrics(content, provider)
        recommendations = detect_underutilized(metrics)
    except Exception as exc:
        raise HTTPException(422, f"Could not analyse metrics CSV: {exc}") from exc
    return {
        "provider": provider,
        "valid_metrics": len(metrics),
        "invalid_metrics": len(errors),
        "recommendations": recommendations,
        "errors": errors[:100],
        "note": "Findings are advisory and based only on the supplied utilization measurements."
    }

@router.post("/analysis/cost-anomalies")
def analyse_cost_anomalies(period_costs: list[PeriodCost]):
    rows = [item.model_dump() for item in period_costs]
    return {"anomalies": detect_cost_anomalies(rows),
            "note": "Periods are compared within provider and currency; supply comparable, consistently sized periods."}

@router.post("/analysis/savings")
def savings_estimate(request: SavingsRequest):
    return estimate_savings(request.current_monthly_cost, request.target_monthly_cost)
