from __future__ import annotations
import httpx
from fastapi import HTTPException
from app.settings import settings

class SupabaseUserClient:
    """PostgREST client forwarding the user's access token so RLS is enforced."""
    def __init__(self, access_token: str):
        if not settings.supabase_url or not settings.supabase_publishable_key:
            raise HTTPException(503, "Supabase is not configured on the API server.")
        self.base = settings.supabase_url
        self.headers = {
            "apikey": settings.supabase_publishable_key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def request(self, method: str, path: str, *, params=None, json=None, prefer=None):
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.request(method, f"{self.base}{path}",
                                            headers=headers, params=params, json=json)
        if response.status_code >= 400:
            detail = "Database request failed."
            try:
                payload = response.json()
                detail = payload.get("message") or payload.get("details") or payload.get("hint") or detail
            except Exception:
                pass
            raise HTTPException(response.status_code, detail)
        if response.status_code == 204 or not response.content:
            return None
        try:
            return response.json()
        except Exception:
            return None

    async def get_user(self):
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"{self.base}/auth/v1/user", headers=self.headers)
        if response.status_code != 200:
            raise HTTPException(401, "Your login session is invalid or expired. Please sign in again.")
        user = response.json()
        if not user.get("id"):
            raise HTTPException(401, "Unable to verify the signed-in user.")
        return user

async def get_supabase_client_from_authorization(authorization: str | None):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "A valid Bearer access token is required.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "A valid Bearer access token is required.")
    db = SupabaseUserClient(token)
    user = await db.get_user()
    return db, user
