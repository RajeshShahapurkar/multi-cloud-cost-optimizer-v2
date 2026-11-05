from pathlib import Path
from app.parsers.pricing import parse_pricing

ROOT=Path(__file__).resolve().parents[2]
SAMPLES=ROOT/"sample-data"

def test_provider_pricing_samples_parse():
    for provider,filename,region,expected_count in [
        ("aws","aws_pricing_synthetic.csv","us-east-1",2),
        ("azure","azure_pricing_synthetic.csv","eastus",1),
        ("gcp","gcp_pricing_synthetic.csv","us-central1",1),
    ]:
        rows,errors=parse_pricing((SAMPLES/filename).read_bytes(),provider)
        assert len(rows)==expected_count
        assert not errors
        assert all(row["provider"]==provider for row in rows)
        assert all(row["region"]==region for row in rows)
        assert all(row["currency"]=="USD" for row in rows)
        assert all(row["vcpu"] in (2,4) for row in rows)

def test_pricing_rejects_negative_rates():
    csv=b"region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date\nus-east-1,tiny,2,8,-0.1,0.1,USD,2026-10-01\n"
    rows,errors=parse_pricing(csv,"aws")
    assert rows==[]
    assert errors[0]["error"].startswith("Compute and storage rates")


def test_right_sizing_compute_savings_uses_uploaded_current_and_target_rates():
    import asyncio
    from app.services.import_service import estimate_compute_savings

    class FakeDb:
        async def request(self, method, endpoint, params=None):
            if params["vcpu"] == "eq.4":
                return [{"compute_hourly_cost":"0.16","storage_gb_month_cost":"0.10",
                         "currency":"USD","pricing_date":"2026-10-01"}]
            if params["vcpu"] == "eq.2":
                return [{"compute_hourly_cost":"0.08","storage_gb_month_cost":"0.10",
                         "currency":"USD","pricing_date":"2026-10-01"}]
            return []

    result = asyncio.run(estimate_compute_savings(
        FakeDb(),"aws","us-east-1","USD",4,16.0,2,8.0
    ))
    assert result["amount"] == 58.4
    assert result["currency"] == "USD"
    assert result["assumptions"]["excludes_storage_network_transfer_taxes_and_discounts"] is True

def test_right_sizing_savings_requires_both_catalogue_rates():
    import asyncio
    from app.services.import_service import estimate_compute_savings

    class EmptyDb:
        async def request(self, method, endpoint, params=None):
            return []

    result = asyncio.run(estimate_compute_savings(
        EmptyDb(),"aws","us-east-1","USD",4,16.0,2,8.0
    ))
    assert result is None

def test_pricing_rejects_non_finite_numeric_values():
    csv=b"region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date\nus-east-1,tiny,2,8,NaN,0.1,USD,2026-10-01\n"
    rows,errors=parse_pricing(csv,"aws")
    assert rows==[]
    assert errors[0]["error"].startswith("Compute and storage rates")
