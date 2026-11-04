import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    app_env = os.getenv("APP_ENV", "development")
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "10"))
    cors_origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")

settings = Settings()
