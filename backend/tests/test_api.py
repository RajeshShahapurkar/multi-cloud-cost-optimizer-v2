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
    csv = (b"ConsumedService,Date,Cost,CurrencyCode,ResourceId,ResourceLocation\\n"
           b"Virtual Machines,2026-10-01,17.50,USD,vm-a,eastus\\n"
           b"Storage,2026-10-01,2.50,USD,disk-a,eastus\\n")
    response = client.post("/api/analysis/billing", data={"provider":"azure"},
        files={"file":("azure.csv",csv,"text/csv")})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_cost_by_currency"]["USD"] == 20.0
    assert payload["valid_rows"] == 2
    assert len(payload["service_costs"]) == 2
