from app.ml.provider_advisor import generate_synthetic_training_data, load_catalog, recommend_providers


def valid_request(**changes):
    request = {
        "region_group": "India",
        "requested_vcpu": 2,
        "requested_memory_gb": 8,
        "usage_hours": 730,
        "monthly_budget_usd": 100,
        "optimization_goal": "cost",
        "workload_profile": "general_purpose",
        "architecture_preference": "any",
    }
    request.update(changes)
    return request


def test_catalog_has_three_providers_and_public_price_provenance():
    catalog = load_catalog()
    assert set(catalog.provider) == {"aws", "azure", "gcp"}
    assert len(catalog) >= 9
    assert catalog.price_source_url.str.contains("vmprices.com").all()
    assert (catalog.linux_on_demand_monthly_usd > 0).all()


def test_synthetic_dataset_uses_catalogue_configurations():
    frame = generate_synthetic_training_data(scenarios=20, seed=7)
    assert frame.scenario_id.nunique() == 20
    assert set(frame.provider.unique()) == {"aws", "azure", "gcp"}
    assert frame.synthetic_suitability_score.between(0, 100).all()
    assert frame.estimated_monthly_cost_usd.gt(0).all()


def test_recommendations_rank_provider_options_and_respect_cpu_memory():
    result = recommend_providers(valid_request())
    assert result["recommended_provider"] in {"aws", "azure", "gcp"}
    assert len(result["recommendations"]) == 3
    assert all(x["vcpu"] >= 2 and x["memory_gb"] >= 8 for x in result["recommendations"])
    assert result["recommendations"] == sorted(
        result["recommendations"], key=lambda item: item["ml_suitability_score"], reverse=True
    )


def test_architecture_filter_can_narrow_provider_candidates():
    result = recommend_providers(valid_request(architecture_preference="x86_64"))
    assert all(x["architecture"] == "x86_64" for x in result["recommendations"])
    assert {x["provider"] for x in result["recommendations"]} == {"gcp"}


def test_maximum_supported_shape_returns_matching_provider_options():
    result = recommend_providers(valid_request(requested_vcpu=8, requested_memory_gb=32))
    assert all(x["vcpu"] >= 8 and x["memory_gb"] >= 32 for x in result["recommendations"])
    assert len(result["recommendations"]) == 3
