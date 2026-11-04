# Local Development

## Requirements
- Python 3.11+
- Node.js 22+
- npm

## 1. Start the FastAPI backend (PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend API: http://localhost:8000  
OpenAPI docs: http://localhost:8000/docs

The backend environment file uses:
- `SUPABASE_URL`: dedicated v2 project URL
- `SUPABASE_PUBLISHABLE_KEY`: public/publishable key, not a service-role key
- `CORS_ORIGINS`: local frontend origin

## 2. Start the Next.js frontend (second terminal)

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Frontend: http://localhost:3000

The frontend environment file contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_API_URL`. These public values are used by the browser Supabase client and API request target. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable.

## 3. Create an account

Open http://localhost:3000. Choose **Create account**, register with an email and password, and verify your email if the Supabase Auth project requires email confirmation. Then sign in.

## 4. Import data

1. Select AWS, Azure or GCP and upload a billing export.
2. Upload a metrics CSV to enable CPU/memory/activity-based recommendations.
3. Upload a pricing catalogue CSV to enable equivalent VM cost comparisons.
4. Refresh the dashboard to see totals, service costs, anomalies, forecasts and recommendations.
5. Download the PDF summary.

Synthetic sample files are in `sample-data/`. Files containing `synthetic` in the filename contain illustrative values, not official provider prices.

## 5. Tests

```powershell
cd backend
pytest
```

GitHub Actions runs the backend tests and frontend production build on pushes/pull requests to `main`.

## Troubleshooting

- **API unreachable:** confirm Uvicorn is running on port 8000 and `NEXT_PUBLIC_API_URL` points to it.
- **Supabase config missing:** check that `.env` and `.env.local` were copied from the example files and that the names are exact.
- **401 from private endpoints:** sign out/in again; the browser access token is validated against Supabase Auth.
- **Email confirmation:** confirm the email before signing in if confirmations are enabled in Supabase Auth.
- **CORS:** add your frontend origin to the backend `CORS_ORIGINS` value and restart FastAPI.

Keep `.env` and `.env.local` private. Never commit real billing exports, passwords or secret keys.
