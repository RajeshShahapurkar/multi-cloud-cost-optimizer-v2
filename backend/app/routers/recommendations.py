from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.services.supabase_rest import get_supabase_client_from_authorization

router=APIRouter(tags=["recommendations"])

class RecommendationUpdate(BaseModel):
    status: str

@router.patch("/recommendations/{recommendation_id}")
async def update_recommendation(recommendation_id:str,payload:RecommendationUpdate,
                                authorization:str|None=Header(default=None)):
    if payload.status not in {"accepted","dismissed","implemented"}:
        raise HTTPException(422,"Status must be accepted, dismissed or implemented.")
    db,user=await get_supabase_client_from_authorization(authorization)
    result=await db.request("PATCH","/rest/v1/optimization_recommendations",
        params={"id":f"eq.{recommendation_id}","user_id":f"eq.{user['id']}"},
        json={"status":payload.status,"reviewed_at":datetime.now(timezone.utc).isoformat()},
        prefer="return=representation")
    if not result:
        raise HTTPException(404,"Recommendation not found.")
    return {"recommendation":result[0]}
