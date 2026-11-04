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
