from app.services.forecasting import aggregate_monthly_by_provider, forecast_monthly_costs

def test_monthly_aggregation_keeps_provider_and_currency_separate():
    rows=[
        {"provider":"aws","currency":"USD","usage_start":"2026-01-02T00:00:00+00:00","cost":"12.25"},
        {"provider":"aws","currency":"USD","usage_start":"2026-01-15T00:00:00+00:00","cost":"7.75"},
        {"provider":"gcp","currency":"EUR","usage_start":"2026-01-15T00:00:00+00:00","cost":"5.00"},
    ]
    monthly=aggregate_monthly_by_provider(rows)
    assert len(monthly)==2
    aws=next(x for x in monthly if x["provider"]=="aws")
    assert aws["cost"]==20.0
    assert aws["currency"]=="USD"

def test_forecast_returns_no_values_without_minimum_history():
    rows=[
        {"provider":"aws","currency":"USD","month":"2026-01","cost":100},
        {"provider":"aws","currency":"USD","month":"2026-02","cost":110},
    ]
    assert forecast_monthly_costs(rows)==[]

def test_forecast_generates_three_future_periods():
    rows=[
        {"provider":"azure","currency":"USD","month":"2026-01","cost":100},
        {"provider":"azure","currency":"USD","month":"2026-02","cost":110},
        {"provider":"azure","currency":"USD","month":"2026-03","cost":120},
    ]
    result=forecast_monthly_costs(rows)
    assert [x["month"] for x in result]==["2026-04","2026-05","2026-06"]
    assert result[0]["forecast_cost"]==130.0
