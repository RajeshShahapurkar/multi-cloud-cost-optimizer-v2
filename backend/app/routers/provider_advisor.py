from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.ml.provider_advisor import recommend_providers
from app.services.supabase_rest import get_supabase_client_from_authorization

router = APIRouter(tags=["ML provider advisor"])


class ProviderAdvisorRequest(BaseModel):
    region_group: Literal["India"] = "India"
    requested_vcpu: int = Field(gt=0, le=8)
    requested_memory_gb: float = Field(gt=0, le=32)
    usage_hours: float = Field(default=730, gt=0, le=730)
    monthly_budget_usd: float = Field(gt=0, le=1000000)
    optimization_goal: Literal["cost", "balanced", "performance"] = "balanced"
    workload_profile: Literal["general_purpose", "compute_heavy", "memory_heavy"] = "general_purpose"
    architecture_preference: Literal["any", "arm64", "x86_64"] = "any"


@router.post("/provider-advisor/recommend")
async def provider_advisor_recommend(
    request: ProviderAdvisorRequest,
    authorization: str | None = Header(default=None),
):
    # Validate the caller through the existing Supabase bearer-token flow.
    await get_supabase_client_from_authorization(authorization)
    try:
        return recommend_providers(request.model_dump())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Provider Advisor catalogue is unavailable.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Provider recommendation failed. Check backend logs.") from exc
