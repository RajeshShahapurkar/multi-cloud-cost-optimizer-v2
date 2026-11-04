from collections import defaultdict

def build_cost_summary(records):
    """Aggregate normalized billing rows without combining currencies."""
    totals = defaultdict(float)
    by_service = defaultdict(float)
    by_region = defaultdict(float)
    by_month = defaultdict(float)
    by_resource = defaultdict(float)

    for row in records:
        currency = row["currency"]
        cost = float(row["cost"])
        totals[currency] += cost
        by_service[(row["service_name"], currency)] += cost

        region = row.get("region") or "Unspecified"
        by_region[(region, currency)] += cost

        month = row["usage_start"][:7]
        by_month[(month, currency)] += cost

        resource_id = row.get("resource_id")
        if resource_id:
            key = (resource_id, row["service_name"], currency)
            by_resource[key] += cost

    return {
        "total_cost_by_currency": {k: round(v, 2) for k, v in sorted(totals.items())},
        "service_costs": [
            {"service_name": k[0], "currency": k[1], "cost": round(v, 2)}
            for k, v in sorted(by_service.items(), key=lambda item: item[1], reverse=True)
        ],
        "region_costs": [
            {"region": k[0], "currency": k[1], "cost": round(v, 2)}
            for k, v in sorted(by_region.items(), key=lambda item: item[1], reverse=True)
        ],
        "monthly_trend": [
            {"month": k[0], "currency": k[1], "cost": round(v, 2)}
            for k, v in sorted(by_month.items())
        ],
        "top_resources": [
            {"resource_id": k[0], "service_name": k[1], "currency": k[2], "cost": round(v, 2)}
            for k, v in sorted(by_resource.items(), key=lambda item: item[1], reverse=True)[:20]
        ],
        "currency_note": "Totals are kept separate by currency. No FX conversion is applied."
    }
