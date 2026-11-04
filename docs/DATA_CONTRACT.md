# Data Contract

## Billing record

| Field | Required | Meaning |
|---|---:|---|
| provider | yes | aws, azure, gcp |
| resource_id | no | Provider resource identifier |
| resource_name | no | Display name |
| service_name | yes | Normalized service/category |
| resource_type | no | VM, storage, database, network |
| region | no | Provider region |
| usage_start | yes | Usage interval start |
| usage_end | no | Usage interval end |
| usage_quantity | no | Usage quantity |
| usage_unit | no | Unit |
| cost | yes | Original amount |
| currency | yes | Three-character currency code |
| charge_type | no | Usage, tax, credit, adjustment |
| source_row_hash | yes | Deterministic fingerprint |

## Resource metrics

Required:
`resource_id,observed_at`

Optional utilization and capacity fields:
`cpu_utilization_pct,memory_utilization_pct,active_hours,observed_hours,region,provisioned_vcpu,provisioned_memory_gb,pricing_currency`

Example complete template:

```csv
provider,resource_id,observed_at,cpu_utilization_pct,memory_utilization_pct,active_hours,observed_hours,region,provisioned_vcpu,provisioned_memory_gb,pricing_currency
aws,i-123456,2026-10-01T01:00:00Z,8,18,1,1,us-east-1,4,16,USD
```

CPU/memory metrics support underutilization analysis. If provisioned vCPU and RAM are also included, the system can propose a smaller candidate configuration. Those proposed capacities are advisory starting points and require peak-load testing and workload owner approval.

## Pricing catalogue

`region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date`

Each row is a user-provided rate for a specific provider, region and configuration. The application uses it for approximate compute + storage comparisons and compute-only right-sizing savings estimates.

## Simplified billing template

`service_name,usage_start,cost,currency,resource_id,resource_name,resource_type,region,usage_quantity,usage_unit,charge_type`

Provider adapters map documented export aliases to the canonical fields. Export formats vary by provider and configuration; unknown formats should be rejected with a useful explanation rather than guessed.
