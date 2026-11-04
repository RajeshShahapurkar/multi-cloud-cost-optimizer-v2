# Implementation Plan

## Workflow
1. User signs in to a private workspace.
2. User selects a provider profile (AWS, Azure or GCP). A profile labels imported data; it is not a live API connection.
3. User uploads a provider billing CSV.
4. Provider adapter maps source columns into the common billing contract.
5. Validation reports valid, invalid and duplicate rows with a preview.
6. User optionally uploads resource metrics linked by provider/resource ID/time.
7. Analytics aggregate spending by provider, service, region, resource and period.
8. Optimization rules evaluate only the evidence present in uploaded files.
9. Dashboard distinguishes observed billing from savings estimates.
10. User reviews recommendations and exports reports.

## Rules and correctness
- Billing data alone cannot establish CPU/memory utilization or prove a resource is idle.
- Right-sizing requires a sufficiently long and representative resource-metrics window.
- Never combine different currencies without an explicit FX rate and date.
- Savings must be based on verified catalogue prices or explicit user-entered assumptions.
- Cross-cloud comparison must match region, vCPU, memory, runtime, storage, currency and pricing timestamp.
- Recommendations are advisory; no resource mutation is performed.

## Phases
- Phase 0: repository foundation and local development shell
- Phase 1: AWS/Azure/GCP billing parsers, normalization, validation, metrics upload
- Phase 2: authenticated imports, Supabase schema/RLS, analytics endpoints and dashboard
- Phase 3: explainable utilization rules, recommendation lifecycle and savings assumptions
- Phase 4: anomaly detection, forecasting, pricing catalogue comparison and PDF reports
- Phase 5: tests, security hardening and deployment

## Initial acceptance criteria
- API health endpoint works.
- CSV extension, size, provider and required columns are checked.
- Sample billing exports from all three providers normalize into a common structure.
- Invalid rows return row-level errors; duplicates are counted.
- Metrics CSV is parsed separately from billing CSV.
- Tests cover parser and API validation paths.
