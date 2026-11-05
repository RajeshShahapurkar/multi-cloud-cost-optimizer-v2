# Provider Advisor compute catalogue and synthetic training data

## Scope

Version 1 supports general-purpose Linux virtual machines in the India region group. The seed catalogue contains 42 SKU/configuration entries: 15 AWS, 15 Azure and 12 Google Cloud options across 2 vCPU / 8 GB, 4 vCPU / 16 GB and 8 vCPU / 32 GB configurations. Provider-native regions are preserved in each row. The India group is a country-level comparison and does not imply that provider locations are the same city or data centre.

## Public pricing source and dates

The values were transcribed from public VM size-comparison pages on vmprices.com. The pages state that the site compares Linux list prices published by AWS, Microsoft Azure and Google Cloud from their public price files, and checks prices daily.

- 2 vCPU / 8 GB: https://vmprices.com/sizes/2-vcpu-8-gb/ — checked 4 November 2026.
- 4 vCPU / 16 GB: https://vmprices.com/sizes/4-vcpu-16-gb/ — checked 4 November 2026.
- 8 vCPU / 32 GB: https://vmprices.com/sizes/8-vcpu-32-gb/ — checked 5 November 2026.

The values are public Linux on-demand list-price estimates in USD for 730 hours/month. The source comparison includes a 10 GB boot disk. They are not actual customer invoices or negotiated contract prices. Taxes, data transfer, additional storage, discounts, credits, free tiers, licensing and support are not represented.

## Synthetic training data

The backend ML module generates 1,000 simulated workload scenarios by default and pairs each scenario with candidate configurations from the 42-entry public catalogue. The synthetic dataset contains multiple candidate rows per scenario. A transparent heuristic generates each synthetic suitability label from capacity fit, cost relative to the cheapest eligible option, budget and the user's optimization priority. A Random Forest Regressor is trained to predict that synthetic suitability score.

The workload scenarios and labels are synthetic; price and VM configuration inputs are seeded from the dated public catalogue. The model's MAE, RMSE and R-squared are computed on held-out synthetic scenarios and must not be described as real-world provider-performance accuracy.

## Generate dataset and model

From the `backend` directory:

```powershell
python -m pip install -r requirements.txt
python -m app.ml.train_provider_advisor
```

This generates:
- `data/provider_advisor/synthetic_training_data.csv`
- `data/provider_advisor/model_metrics.json`
- `backend/app/ml/artifacts/provider_advisor.joblib`

The API also trains the model automatically on its first recommendation request if the model artifact does not exist.
