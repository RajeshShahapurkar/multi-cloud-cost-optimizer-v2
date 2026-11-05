from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data" / "provider_advisor"
CATALOG_PATH = DATA_DIR / "compute_catalog.csv"
TRAINING_DATA_PATH = DATA_DIR / "synthetic_training_data.csv"
METRICS_PATH = DATA_DIR / "model_metrics.json"
MODEL_DIR = ROOT / "backend" / "app" / "ml" / "artifacts"
MODEL_PATH = MODEL_DIR / "provider_advisor.joblib"
CATEGORICAL_FEATURES = ["provider", "architecture", "workload_profile", "optimization_goal"]
NUMERIC_FEATURES = [
    "requested_vcpu", "requested_memory_gb", "usage_hours", "budget_usd",
    "offered_vcpu", "offered_memory_gb", "estimated_monthly_cost_usd",
    "lowest_feasible_cost_usd", "cpu_headroom_ratio", "memory_headroom_ratio",
    "budget_cost_ratio",
]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
_MODEL_BUNDLE: dict[str, Any] | None = None


def load_catalog() -> pd.DataFrame:
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Provider price catalogue not found: {CATALOG_PATH}")
    catalog = pd.read_csv(CATALOG_PATH)
    required = {
        "provider", "region_group", "provider_region", "instance_type", "vcpu",
        "memory_gb", "architecture", "linux_on_demand_monthly_usd",
        "price_checked_on", "price_source_url", "boot_disk_gb",
    }
    missing = sorted(required.difference(catalog.columns))
    if missing:
        raise ValueError("Provider catalogue is missing columns: " + ", ".join(missing))
    catalog["provider"] = catalog["provider"].str.lower()
    catalog["vcpu"] = pd.to_numeric(catalog["vcpu"], errors="raise").astype(int)
    for column in ("memory_gb", "linux_on_demand_monthly_usd", "boot_disk_gb"):
        catalog[column] = pd.to_numeric(catalog[column], errors="raise")
    if catalog.empty or (catalog["linux_on_demand_monthly_usd"] <= 0).any():
        raise ValueError("Provider catalogue must contain positive public list prices.")
    return catalog


def _feature_row(candidate: dict[str, Any], request: dict[str, Any], lowest_cost: float) -> dict[str, Any]:
    hours = float(request["usage_hours"])
    monthly_estimate = float(candidate["linux_on_demand_monthly_usd"]) * hours / 730.0
    req_cpu = float(request["requested_vcpu"])
    req_mem = float(request["requested_memory_gb"])
    return {
        "provider": candidate["provider"],
        "architecture": candidate["architecture"],
        "workload_profile": request["workload_profile"],
        "optimization_goal": request["optimization_goal"],
        "requested_vcpu": req_cpu,
        "requested_memory_gb": req_mem,
        "usage_hours": hours,
        "budget_usd": float(request["monthly_budget_usd"]),
        "offered_vcpu": float(candidate["vcpu"]),
        "offered_memory_gb": float(candidate["memory_gb"]),
        "estimated_monthly_cost_usd": monthly_estimate,
        "lowest_feasible_cost_usd": lowest_cost,
        "cpu_headroom_ratio": float(candidate["vcpu"]) / req_cpu,
        "memory_headroom_ratio": float(candidate["memory_gb"]) / req_mem,
        "budget_cost_ratio": monthly_estimate / max(float(request["monthly_budget_usd"]), 0.01),
    }


def _synthetic_target(row: dict[str, Any]) -> float:
    """Heuristic label for synthetic examples; not a measured provider benchmark."""
    offered_cpu = float(row["offered_vcpu"])
    offered_mem = float(row["offered_memory_gb"])
    required_cpu = float(row["requested_vcpu"])
    required_mem = float(row["requested_memory_gb"])
    cost = float(row["estimated_monthly_cost_usd"])
    budget = max(float(row["budget_usd"]), 0.01)
    lowest = max(float(row["lowest_feasible_cost_usd"]), 0.01)
    if offered_cpu < required_cpu or offered_mem < required_mem:
        return 0.0
    cost_score = min(100.0, 100.0 * lowest / max(cost, 0.01))
    cpu_extra = max(0.0, offered_cpu / required_cpu - 1.0)
    mem_extra = max(0.0, offered_mem / required_mem - 1.0)
    profile = row["workload_profile"]
    if profile == "compute_heavy":
        fit_penalty = 17.0 * cpu_extra + 9.0 * mem_extra
    elif profile == "memory_heavy":
        fit_penalty = 9.0 * cpu_extra + 17.0 * mem_extra
    else:
        fit_penalty = 13.0 * cpu_extra + 13.0 * mem_extra
    fit_score = max(0.0, 100.0 - min(65.0, fit_penalty))
    over_budget_ratio = max(0.0, (cost - budget) / budget)
    budget_score = max(0.0, 100.0 - min(100.0, over_budget_ratio * 180.0))
    weights = {
        "cost": (0.62, 0.13, 0.25),
        "balanced": (0.42, 0.36, 0.22),
        "performance": (0.22, 0.60, 0.18),
    }
    w_cost, w_fit, w_budget = weights[row["optimization_goal"]]
    return round(w_cost * cost_score + w_fit * fit_score + w_budget * budget_score, 4)


def generate_synthetic_training_data(
    catalog: pd.DataFrame | None = None, scenarios: int = 1200, seed: int = 42
) -> pd.DataFrame:
    """Pair simulated workload needs with the real dated provider catalogue."""
    from numpy.random import default_rng

    catalog = catalog if catalog is not None else load_catalog()
    rng = default_rng(seed)
    records: list[dict[str, Any]] = []
    profiles = ["general_purpose", "compute_heavy", "memory_heavy"]
    goals = ["cost", "balanced", "performance"]
    groups = sorted(catalog["region_group"].unique())
    for scenario_number in range(scenarios):
        region_group = str(rng.choice(groups))
        requested_cpu = int(rng.integers(1, 9))
        requested_memory = round(float(rng.uniform(2.0, 32.0)), 1)
        usage_hours = round(float(rng.uniform(80.0, 730.0)), 1)
        monthly_budget = round(float(rng.uniform(25.0, 180.0)), 2)
        profile = str(rng.choice(profiles))
        goal = str(rng.choice(goals))
        candidates = catalog[catalog["region_group"] == region_group].to_dict("records")
        feasible = [
            c for c in candidates
            if int(c["vcpu"]) >= requested_cpu and float(c["memory_gb"]) >= requested_memory
        ]
        if not feasible:
            continue
        lowest_cost = min(
            float(c["linux_on_demand_monthly_usd"]) * usage_hours / 730.0 for c in feasible
        )
        request = {
            "requested_vcpu": requested_cpu,
            "requested_memory_gb": requested_memory,
            "usage_hours": usage_hours,
            "monthly_budget_usd": monthly_budget,
            "workload_profile": profile,
            "optimization_goal": goal,
        }
        for candidate in candidates:
            row = _feature_row(candidate, request, lowest_cost)
            row["scenario_id"] = f"scenario-{scenario_number:05d}"
            row["region_group"] = region_group
            row["candidate_eligible"] = int(
                int(candidate["vcpu"]) >= requested_cpu
                and float(candidate["memory_gb"]) >= requested_memory
            )
            row["synthetic_suitability_score"] = _synthetic_target(row)
            records.append(row)
    frame = pd.DataFrame.from_records(records)
    if frame.empty:
        raise ValueError("Synthetic generation produced no workload examples.")
    return frame


def train_model(
    catalog: pd.DataFrame | None = None, scenarios: int = 1200, seed: int = 42
) -> dict[str, Any]:
    """Train Random Forest and save the synthetic data, metrics and model artifact."""
    catalog = catalog if catalog is not None else load_catalog()
    dataset = generate_synthetic_training_data(catalog, scenarios=scenarios, seed=seed)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(TRAINING_DATA_PATH, index=False)
    x = dataset[FEATURES]
    y = dataset["synthetic_suitability_score"].astype(float)
    groups = dataset["scenario_id"]
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
    train_idx, test_idx = next(splitter.split(x, y, groups=groups))
    transformer = ColumnTransformer([
        ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ("numeric", "passthrough", NUMERIC_FEATURES),
    ])
    model = Pipeline([
        ("features", transformer),
        ("regressor", RandomForestRegressor(
            n_estimators=120, max_depth=12, min_samples_leaf=3, random_state=seed, n_jobs=-1
        )),
    ])
    model.fit(x.iloc[train_idx], y.iloc[train_idx])
    predictions = np.clip(model.predict(x.iloc[test_idx]), 0.0, 100.0)
    metrics = {
        "algorithm": "RandomForestRegressor",
        "target": "synthetic_suitability_score",
        "training_rows": int(len(train_idx)),
        "testing_rows": int(len(test_idx)),
        "synthetic_scenarios": int(dataset["scenario_id"].nunique()),
        "catalogue_rows": int(len(catalog)),
        "mae": round(float(mean_absolute_error(y.iloc[test_idx], predictions)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y.iloc[test_idx], predictions))), 4),
        "r2": round(float(r2_score(y.iloc[test_idx], predictions)), 4),
        "evaluation_note": "Metrics are measured against heuristic-generated labels on held-out synthetic workload scenarios; they are not real-world provider-performance accuracy.",
        "trained_at_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "catalog_sha256": hashlib.sha256(CATALOG_PATH.read_bytes()).hexdigest(),
        "price_snapshot": "Public Linux on-demand list-price estimates checked 2026-11-04 and 2026-11-05; see dataset README and source URLs.",
    }
    joblib.dump({"model": model, "features": FEATURES, "metrics": metrics}, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return {"model": model, "metrics": metrics}


def get_model_bundle(force_retrain: bool = False) -> dict[str, Any]:
    global _MODEL_BUNDLE
    if _MODEL_BUNDLE is not None and not force_retrain:
        return _MODEL_BUNDLE
    expected_hash = hashlib.sha256(CATALOG_PATH.read_bytes()).hexdigest()
    if force_retrain or not MODEL_PATH.exists():
        _MODEL_BUNDLE = train_model()
    else:
        stored = joblib.load(MODEL_PATH)
        _MODEL_BUNDLE = train_model() if stored.get("metrics", {}).get("catalog_sha256") != expected_hash else stored
    return _MODEL_BUNDLE


def recommend_providers(request: dict[str, Any]) -> dict[str, Any]:
    catalog = load_catalog()
    candidates = catalog[catalog["region_group"] == request["region_group"]].copy()
    architecture = request.get("architecture_preference", "any")
    if architecture != "any":
        candidates = candidates[candidates["architecture"] == architecture]
    candidates = candidates[
        (candidates["vcpu"] >= int(request["requested_vcpu"]))
        & (candidates["memory_gb"] >= float(request["requested_memory_gb"]))
    ]
    if candidates.empty:
        raise ValueError("No catalogue configuration satisfies the selected region, architecture and CPU/RAM requirements. Try a lower requirement or Any architecture.")

    hours = float(request["usage_hours"])
    candidates["estimated_monthly_cost_usd"] = candidates["linux_on_demand_monthly_usd"] * hours / 730.0
    lowest_cost = float(candidates["estimated_monthly_cost_usd"].min())
    bundle = get_model_bundle()
    feature_rows = [_feature_row(row, request, lowest_cost) for row in candidates.to_dict("records")]
    predictions = np.clip(bundle["model"].predict(pd.DataFrame(feature_rows)[FEATURES]), 0.0, 100.0)
    candidates["ml_suitability_score"] = predictions
    best_by_provider = (
        candidates.sort_values(
            ["ml_suitability_score", "estimated_monthly_cost_usd"], ascending=[False, True]
        )
        .groupby("provider", as_index=False).first()
        .sort_values("ml_suitability_score", ascending=False)
    )

    results = []
    budget = float(request["monthly_budget_usd"])
    for row in best_by_provider.to_dict("records"):
        cost = float(row["estimated_monthly_cost_usd"])
        results.append({
            "provider": row["provider"], "provider_region": row["provider_region"],
            "location": row["location"], "instance_type": row["instance_type"],
            "vcpu": int(row["vcpu"]), "memory_gb": float(row["memory_gb"]),
            "architecture": row["architecture"], "cpu_platform": row.get("cpu_platform"),
            "estimated_monthly_cost_usd": round(cost, 2),
            "source_730h_monthly_price_usd": float(row["linux_on_demand_monthly_usd"]),
            "usage_hours": hours, "within_budget": cost <= budget,
            "ml_suitability_score": round(float(row["ml_suitability_score"]), 2),
            "price_checked_on": row["price_checked_on"],
            "price_source_url": row["price_source_url"],
            "boot_disk_gb_included_in_source_estimate": int(row["boot_disk_gb"]),
        })
    note = (
        "Decision-support ranking for general-purpose Linux VMs. The model is trained on simulated workload scenarios "
        "labelled by a documented heuristic, using public provider list-price/configuration snapshots. The score is not "
        "a measured performance benchmark or probability. Price estimates scale the published 730-hour monthly "
        "estimate linearly by entered hours; the source estimate includes a 10 GB boot disk. Additional storage, "
        "network egress, taxes, discounts, credits, licensing and negotiated prices are excluded. Provider regions "
        "are grouped at country level and are not identical data-centre locations."
    )
    return {
        "region_group": request["region_group"],
        "requested_configuration": {
            "requested_vcpu": int(request["requested_vcpu"]),
            "requested_memory_gb": float(request["requested_memory_gb"]),
            "usage_hours": hours, "monthly_budget_usd": budget,
            "optimization_goal": request["optimization_goal"],
            "workload_profile": request["workload_profile"],
            "architecture_preference": architecture,
        },
        "recommended_provider": results[0]["provider"],
        "recommendations": results,
        "model_metrics": bundle["metrics"],
        "catalogue_rows_considered": int(len(candidates)),
        "note": note,
    }
