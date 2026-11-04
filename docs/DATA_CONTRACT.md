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

## Metrics record
`provider,resource_id,observed_at,cpu_utilization_pct,memory_utilization_pct,active_hours,observed_hours`

## Simplified billing template
`service_name,usage_start,cost,currency,resource_id,resource_name,resource_type,region,usage_quantity,usage_unit,charge_type`

Provider adapters map documented export aliases to the canonical fields. Export formats vary by provider and configuration; unknown formats should be rejected with a useful explanation rather than guessed.
