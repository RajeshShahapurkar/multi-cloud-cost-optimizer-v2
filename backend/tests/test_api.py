from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)

def test_health():
    response=client.get("/health")
    assert response.status_code==200 and response.json()["status"]=="ok"

def test_reject_non_csv():
    response=client.post("/api/uploads/billing/preview",data={"provider":"aws"},
      files={"file":("report.txt",b"hello","text/plain")})
    assert response.status_code==415

def test_aws_preview():
    data=b"service_name,usage_start,cost,currency,resource_id\nEC2,2026-10-01,10.5,USD,i-1\n"
    response=client.post("/api/uploads/billing/preview",data={"provider":"aws"},
      files={"file":("billing.csv",data,"text/csv")})
    assert response.status_code==200
    assert response.json()["valid_rows"]==1
    assert response.json()["total_cost_by_currency"]["USD"]==10.5

def test_reject_unknown_provider():
    response=client.post("/api/uploads/billing/preview",data={"provider":"oracle"},
      files={"file":("billing.csv",b"a,b\n1,2","text/csv")})
    assert response.status_code==422


def test_azure_billing_analysis_groups_costs_by_service():
    csv = (b"ConsumedService,Date,Cost,CurrencyCode,ResourceId,ResourceLocation\n"
           b"Virtual Machines,2026-10-01,17.50,USD,vm-a,eastus\n"
           b"Storage,2026-10-01,2.50,USD,disk-a,eastus\n")
    response = client.post("/api/analysis/billing", data={"provider":"azure"},
        files={"file":("azure.csv",csv,"text/csv")})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_cost_by_currency"]["USD"] == 20.0
    assert payload["valid_rows"] == 2
    assert len(payload["service_costs"]) == 2


def test_dashboard_requires_bearer_token():
    response = client.get("/api/dashboard")
    assert response.status_code == 401

def test_billing_import_requires_bearer_token():
    data = b"service_name,usage_start,cost,currency\\nEC2,2026-10-01,3.5,USD\\n"
    response = client.post("/api/imports/billing", data={"provider":"aws"},
        files={"file":("billing.csv",data,"text/csv")})
    assert response.status_code == 401


def test_pricing_import_requires_auth():
    csv = b"region,instance_type,vcpu,memory_gb,compute_hourly_cost,storage_gb_month_cost,currency,pricing_date\\nus-east-1,tiny,2,8,0.1,0.1,USD,2026-10-01\\n"
    response = client.post("/api/imports/pricing", data={"provider":"aws"},
        files={"file":("pricing.csv",csv,"text/csv")})
    assert response.status_code == 401

def test_comparison_requires_auth():
    response = client.post("/api/comparison/estimate", json={
        "regions":{"aws":"us-east-1","azure":"eastus","gcp":"us-central1"},"vcpu":2,"memory_gb":8,
        "storage_gb":100,"currency":"USD"
    })
    assert response.status_code == 401

def test_pdf_report_requires_auth():
    response = client.get("/api/reports/summary.pdf")
    assert response.status_code == 401
