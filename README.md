# Multi-Cloud Cost Optimizer

CSV-based multi-cloud FinOps platform for AWS, Azure and Google Cloud. Upload provider billing exports and optional resource-utilization CSVs, normalize to a common schema, analyse spend and generate explainable optimization recommendations.

> This implementation does not require live cloud-account API access. Billing data and utilization metrics are user-uploaded. Billing data alone cannot prove CPU/memory utilization. Recommendations are advisory and do not modify cloud resources.

## Stack
- Frontend: Next.js, TypeScript, Tailwind CSS, Recharts
- Backend: FastAPI, Python, Pandas
- Planned persistence/auth: Supabase PostgreSQL and Supabase Auth

## Modules
1. User authentication and isolated workspaces
2. AWS/Azure/GCP billing CSV ingestion and validation
3. Common billing data normalization
4. Resource metrics CSV ingestion
5. Unified cost analytics
6. Explainable idle-resource and right-sizing analysis
7. Cost anomaly detection and forecasting
8. Cross-cloud pricing comparison
9. Optimization history and downloadable reports

## Current status
Initial repository foundation. The first implementation slice will provide CSV preview/validation and the frontend upload UI. Authenticated persistence and complete analytics are subsequent milestones.

See `docs/IMPLEMENTATION_PLAN.md` and `docs/LOCAL_DEVELOPMENT.md`.


## API endpoints in the initial slice

Run the backend from the `backend/` directory on port 8000.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API health |
| POST | `/api/uploads/billing/preview` | Validate and preview AWS/Azure/GCP billing CSV |
| POST | `/api/uploads/metrics/preview` | Validate and preview utilization metrics CSV |
| POST | `/api/analysis/metrics` | Detect idle candidates and underutilized resources from metrics |
| POST | `/api/analysis/cost-anomalies` | Analyse comparable monthly provider/currency cost totals |
| POST | `/api/analysis/savings` | Calculate savings from explicit current/target costs |

The preview endpoints do not persist data yet. The optimization endpoints are analysis utilities; authenticated imports, database persistence, full dashboard aggregates and recommendation lifecycle are the next implementation milestone.

## Supabase database

A proposed schema with per-user Row Level Security is in [supabase/SCHEMA.sql](supabase/SCHEMA.sql). Apply it only to a new Supabase project dedicated to this repository after reviewing the SQL. Do not apply it to a different project's production database.

## CI

GitHub Actions runs backend tests and a Next.js production build on pushes and pull requests to `main`. See [Actions](https://github.com/RajeshShahapurkar/multi-cloud-cost-optimizer-v2/actions).
