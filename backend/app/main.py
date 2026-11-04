from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.uploads import router as uploads_router
from app.settings import settings

app = FastAPI(title="Multi-Cloud Cost Optimizer API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(uploads_router, prefix="/api")

@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "environment": settings.app_env}
