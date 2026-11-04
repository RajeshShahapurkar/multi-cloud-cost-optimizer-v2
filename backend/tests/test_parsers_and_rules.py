from pathlib import Path
from app.parsers.aws import parse_aws_billing
from app.parsers.azure import parse_azure_billing
from app.parsers.gcp import parse_gcp_billing
from app.parsers.metrics import parse_metrics
from app.services.optimization import detect_idle, detect_underutilized, detect_cost_anomalies, estimate_savings

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "sample-data"

def test_provider_samples_normalize():
    for provider, parser, filename in [
        ("aws", parse_aws_billing, "aws_billing_sample.csv"),
        ("azure", parse_azure_billing, "azure_billing_sample.csv"),
        ("gcp", parse_gcp_billing, "gcp_billing_sample.csv"),
    ]:
        records, errors = parser((SAMPLES / filename).read_bytes())
        assert len(records) == 2
        assert errors == []
        assert all(row["provider"] == provider for row in records)
        assert all(row["currency"] == "USD" for row in records)
        assert all("source_row_hash" in row for row in records)

def test_metrics_sample_flags_underutilized_resource():
    rows, errors = parse_metrics((SAMPLES / "resource_metrics_sample.csv").read_bytes(), "aws")
    assert len(rows) == 3
    assert errors == []
    findings = detect_underutilized(rows)
    assert len(findings) == 1
    assert findings[0]["resource_id"] == "i-aws-web-01"

def test_cost_anomaly_requires_history():
    rows = [
        {"provider":"aws","currency":"USD","period":"2026-06","cost":100},
        {"provider":"aws","currency":"USD","period":"2026-07","cost":105},
        {"provider":"aws","currency":"USD","period":"2026-08","cost":98},
        {"provider":"aws","currency":"USD","period":"2026-09","cost":160},
    ]
    findings = detect_cost_anomalies(rows, threshold_pct=30)
    assert len(findings) == 1
    assert findings[0]["increase_pct"] > 30

def test_savings_estimate_is_non_negative():
    result = estimate_savings(120, 75)
    assert result["estimated_monthly_savings"] == 45


def test_idle_detection_requires_activity_and_observation_coverage():
    rows = [
        {"provider":"gcp","resource_id":"vm-idle-1","observed_at":f"2026-10-01T0{i}:00:00Z",
         "cpu_utilization_pct":0,"memory_utilization_pct":2,"active_hours":0,"observed_hours":1}
        for i in (1,2,3)
    ]
    findings = detect_idle(rows)
    assert len(findings) == 1
    assert findings[0]["category"] == "idle_candidate"

def test_no_idle_finding_without_activity_metric():
    rows = [
        {"provider":"azure","resource_id":"vm-unknown","observed_at":f"2026-10-01T0{i}:00:00Z",
         "cpu_utilization_pct":0,"memory_utilization_pct":1,"active_hours":None,"observed_hours":1}
        for i in (1,2,3)
    ]
    assert detect_idle(rows) == []
