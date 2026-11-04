from fastapi import APIRouter, Header
from pydantic import BaseModel, Field
from app.services.supabase_rest import get_supabase_client_from_authorization

router=APIRouter(tags=["cross-cloud cost comparison"])

class ComparisonRequest(BaseModel):
    region: str = Field(min_length=1, max_length=100)
    vcpu: int = Field(gt=0, le=1024)
    memory_gb: float = Field(gt=0, le=65536)
    storage_gb: float = Field(ge=0, le=10000000)
    hours_per_month: float = Field(default=730, gt=0, le=744)
    currency: str = Field(min_length=3, max_length=3)

@router.post("/comparison/estimate")
async def compare_cloud_costs(request:ComparisonRequest,authorization:str|None=Header(default=None)):
    db,user=await get_supabase_client_from_authorization(authorization)
    currency=request.currency.upper()
    rows=await db.request("GET","/rest/v1/pricing_catalogue",params={
        "select":"provider,region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date",
        "region":"eq."+request.region,
        "currency":"eq."+currency,
        "vcpu":"gte."+str(request.vcpu),
        "memory_gb":"gte."+str(request.memory_gb),
        "order":"pricing_date.desc",
        "limit":"1000",
    })
    best_by_provider={}
    for row in rows or []:
        provider=row["provider"]
        monthly=(float(row["compute_hourly_cost"])*request.hours_per_month)+(
            float(row["storage_gb_month_cost"])*request.storage_gb
        )
        option={
            "provider":provider,"instance_type":row["instance_type"],"region":row["region"],
            "vcpu":row["vcpu"],"memory_gb":float(row["memory_gb"]),
            "currency":row["currency"],"pricing_date":row["pricing_date"],
            "estimated_monthly_cost":round(monthly,2),
            "assumptions":{
                "hours_per_month":request.hours_per_month,
                "storage_gb":request.storage_gb,
                "compute_hourly_cost":float(row["compute_hourly_cost"]),
                "storage_gb_month_cost":float(row["storage_gb_month_cost"])
            }
        }
        previous=best_by_provider.get(provider)
        if previous is None or option["estimated_monthly_cost"]<previous["estimated_monthly_cost"]:
            best_by_provider[provider]=option
    options=sorted(best_by_provider.values(),key=lambda x:x["estimated_monthly_cost"])
    return {
        "requested_configuration":{
            "region":request.region,"vcpu":request.vcpu,"memory_gb":request.memory_gb,
            "storage_gb":request.storage_gb,"hours_per_month":request.hours_per_month,"currency":currency
        },
        "options":options,
        "lowest_cost_provider":options[0]["provider"] if options else None,
        "note":"Estimates use only pricing rows uploaded by this user. They are not live provider quotations and exclude taxes, network transfer, discounts, support, licensing and other workload-specific charges."
    }
