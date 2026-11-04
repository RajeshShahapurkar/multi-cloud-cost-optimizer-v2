# Multi-Cloud Cost Optimizer

A multi-cloud FinOps platform for AWS, Microsoft Azure and Google Cloud. Users import billing exports, utilization metrics and optional pricing catalogues as CSV files. The application normalizes these inputs, analyzes spend and produces explainable optimization findings.

**The v2 workflow does not require live cloud-account API access.** Provider profiles represent imported datasets, not connected cloud accounts.

## Core capabilities

- Supabase Auth sign-up/sign-in and user-isolated workspaces
- Provider-specific AWS, Azure and GCP billing CSV import
- Billing normalization, validation, row-level errors and duplicate detection
- Separate CPU, memory and activity metrics CSV import
- Unified cost totals, service/region breakdowns and monthly spend trends
- Utilization-based idle and underutilized resource recommendations
- Recommendation review: accept, dismiss or mark implemented
- Cost anomaly signals and a transparent linear-trend forecast
- User-provided pricing catalogue import and cross-cloud configuration comparison
- Authenticated PDF spend and optimization report
- User-level data protection with PostgreSQL Row Level Security (RLS)

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS, Recharts |
| Authentication | Supabase Auth, Supabase JS and SSR package |
| Backend | FastAPI, Python, Pandas, HTTPX |
| Database | Supabase PostgreSQL |
| Authorization | User JWT forwarded to PostgREST; RLS policies enforce row ownership |
| CI | GitHub Actions backend tests and frontend production build |

## Repository layout

- `frontend/`: Next.js application, authentication and dashboard
- `backend/`: FastAPI routes, provider parsers, persistence, analytics and PDF reports
- `supabase/SCHEMA.sql`: canonical schema for fresh setup
- `sample-data/`: synthetic billing, metric and pricing CSVs for development only
- `docs/`: workflow, data contracts and local setup

## Local setup

Requirements: Python 3.11+, Node.js 22+, npm.

### 1. Backend

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The backend `.env.example` already contains the v2 Supabase project URL and publishable key. These are public client credentials; do not replace them with a secret or service-role key. Keep `.env` local.

API documentation: http://localhost:8000/docs

### 2. Frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000 and create an account. If email confirmation is enabled, verify the email before signing in.

### 3. CSV import workflow

1. Sign in.
2. Choose AWS, Azure or GCP.
3. Import the provider billing CSV.
4. Optionally import a resource metrics CSV for the same provider.
5. Optionally import a provider pricing CSV.
6. View cost analytics, anomalies, forecast, recommendations and saved import history.
7. Use the comparison form with a region/configuration that exists in the uploaded pricing catalogue.
8. Download the PDF summary.

See `sample-data/` for synthetic starter files. Files named `*_synthetic.csv` contain illustrative values only and must not be represented as official provider prices.

## CSV contracts

### Billing

Provider export parsers accept common AWS CUR, Azure Cost Management and GCP Cloud Billing header aliases. A normalized billing record preserves provider, resource, service, region, usage time, cost, currency and charge type. Actual export layouts vary by configuration; unsupported layouts return validation errors.

### Resource metrics

`provider,resource_id,observed_at,cpu_utilization_pct,memory_utilization_pct,active_hours,observed_hours,region,provisioned_vcpu,provisioned_memory_gb,pricing_currency`

Billing records alone cannot prove CPU or memory utilization. Upload metrics separately to enable utilization-based findings. Add provisioned_vcpu and provisioned_memory_gb to get a concrete right-sizing candidate; region and pricing_currency enable price-backed compute savings when matching current and target rates exist in your catalogue. These suggestions are advisory, require workload/peak-period validation and do not make changes to cloud resources.

### Pricing catalogue

`region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date`

Rates must be supplied by the user. The comparison engine accepts separate region codes for AWS, Azure and GCP, matches requested minimum vCPU/RAM and exact provider-specific region/currency, then estimates compute plus storage for the requested hours. Estimates do not include network egress, taxes, support, licensing, discount programs or workload-specific charges; they are not live quotations.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend health |
| POST | `/api/uploads/billing/preview` | Unauthenticated billing preview utility |
| POST | `/api/uploads/metrics/preview` | Unauthenticated metrics preview utility |
| POST | `/api/imports/billing` | Authenticated billing import and persistence |
| POST | `/api/imports/metrics` | Authenticated metrics import and recommendation generation |
| POST | `/api/imports/pricing` | Authenticated pricing catalogue import |
| GET | `/api/dashboard` | Authenticated dashboard data |
| PATCH | `/api/recommendations/{id}` | Update recommendation status |
| POST | `/api/comparison/estimate` | Compare resources using user's saved pricing catalogue |
| POST | `/api/analysis/savings` | Calculate savings from explicit current/target costs |
| GET | `/api/reports/summary.pdf` | Authenticated PDF summary report |

Authenticated endpoints require `Authorization: Bearer <Supabase access token>`. The API validates the token with Supabase Auth and forwards it to PostgREST. No service-role key is used.

## Database and security

The dedicated Supabase v2 project is in `ap-south-1` (Mumbai). It contains user-owned tables for cloud profiles, import batches, billing records, resource metrics, recommendations, anomalies and pricing catalogue rows. RLS is enabled for every application table. Composite foreign keys prevent attaching a user's rows to another user's profile or import batch.

`supabase/SCHEMA.sql` describes the full schema for a fresh database. The dedicated v2 project has already been initialized; do not reapply the bootstrap SQL to an existing production database without reviewing the migrations first.

## Tests

```powershell
cd backend
pytest
```

GitHub Actions runs backend tests and a Next.js production build on changes to `main`.

## Accuracy and security notes

- Cost totals are kept separate by currency; no implicit FX conversion is made.
- Metrics are required for CPU/memory optimization; missing metrics are not treated as idle.
- Savings require a verified rate or an explicit user assumption.
- Pricing comparison only uses imported user-provided pricing rows.
- Forecasts are simple trend estimates and need at least three monthly observations.
- Recommendations are advisory; the system never stops, resizes or deletes real cloud resources.
- Never commit local `.env` files, secrets, database passwords, private user billing exports or Supabase service-role/secret keys.
