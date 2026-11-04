from pathlib import Path
from app.parsers.pricing import parse_pricing

ROOT=Path(__file__).resolve().parents[2]
SAMPLES=ROOT/"sample-data"

def test_provider_pricing_samples_parse():
    for provider,filename,region in [
        ("aws","aws_pricing_synthetic.csv","us-east-1"),
        ("azure","azure_pricing_synthetic.csv","eastus"),
        ("gcp","gcp_pricing_synthetic.csv","us-central1"),
    ]:
        rows,errors=parse_pricing((SAMPLES/filename).read_bytes(),provider)
        assert len(rows)==1
        assert not errors
        assert rows[0]["provider"]==provider
        assert rows[0]["region"]==region
        assert rows[0]["currency"]=="USD"
        assert rows[0]["vcpu"]==2

def test_pricing_rejects_negative_rates():
    csv=b"region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date\nus-east-1,tiny,2,8,-0.1,0.1,USD,2026-10-01\n"
    rows,errors=parse_pricing(csv,"aws")
    assert rows==[]
    assert errors[0]["error"].startswith("Compute and storage rates")
