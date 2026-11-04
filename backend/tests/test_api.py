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
