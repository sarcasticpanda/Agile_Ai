from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Tuple

import joblib
import numpy as np
import optuna
import pandas as pd
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

BURNOUT_FEATURES = [
    "worklogs_count_window",
    "avg_weekly_logged_hours",
    "capacity_hours_per_week",
    "over_capacity_ratio",
    "after_hours_worklog_ratio",
    "blocked_task_ratio",
    "reopen_events_window",
    "active_projects_window",
    "status_transitions_window",
    "avg_task_cycle_hours_window",
    "days_since_last_activity",
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _load_latest_burnout_csv(export_dir: Path) -> Dict[str, Path | str | None]:
    summaries = sorted(export_dir.glob("export_summary_*.json"), key=lambda p: p.stat().st_mtime)
    if summaries:
        with summaries[-1].open("r", encoding="utf-8") as f:
            summary = json.load(f)

        burnout_path = summary.get("files", {}).get("burnout")
        if burnout_path:
            candidate = Path(burnout_path)
            if not candidate.is_absolute():
                candidate = (export_dir / candidate).resolve()
            if candidate.exists():
                return {
                    "csv": candidate,
                    "summary": summaries[-1],
                    "source": "summary",
                }

    burnout_files = sorted(
        export_dir.glob("burnout_features_unlabeled_*.csv"),
        key=lambda p: p.stat().st_mtime,
    )
    if not burnout_files:
        return {}

    return {
        "csv": burnout_files[-1],
        "summary": None,
        "source": "fallback-csv-scan",
    }


def _parse_manual_labels(series: pd.Series) -> pd.Series:
    mapping = {
        "0": 0,
        "low": 0,
        "1": 1,
        "medium": 1,
        "med": 1,
        "2": 2,
        "high": 2,
    }

    def _map_value(value: object) -> float:
        if value is None:
            return np.nan
        text = str(value).strip().lower()
        if not text:
            return np.nan
        if text in mapping:
            return float(mapping[text])
        return np.nan

    return series.map(_map_value)


def _heuristic_score(row: pd.Series) -> float:
    over_capacity = float(np.clip(row["over_capacity_ratio"], 0.0, 2.0) / 2.0)
    after_hours = float(np.clip(row["after_hours_worklog_ratio"], 0.0, 1.0))
    blocked = float(np.clip(row["blocked_task_ratio"], 0.0, 1.0))
    reopen = float(np.clip(row["reopen_events_window"], 0.0, 8.0) / 8.0)
    transitions = float(np.clip(row["status_transitions_window"], 0.0, 80.0) / 80.0)
    cycle_hours = float(np.clip(row["avg_task_cycle_hours_window"], 0.0, 168.0) / 168.0)
    inactivity = float(np.clip(row["days_since_last_activity"], 0.0, 30.0) / 30.0)

    # Weighted fatigue signal grounded in available telemetry exported from Mongo.
    return (
        0.34 * over_capacity
        + 0.18 * after_hours
        + 0.14 * blocked
        + 0.10 * reopen
        + 0.10 * transitions
        + 0.08 * cycle_hours
        + 0.06 * inactivity
    )


def _build_labels(df: pd.DataFrame, auto_label: bool) -> Tuple[pd.Series, pd.Series, str]:
    manual = _parse_manual_labels(df.get("burnout_label", pd.Series(dtype=object)))
    manual_mask = manual.notna()

    if manual_mask.sum() >= 20 and manual[manual_mask].nunique() >= 2:
        labels = manual.fillna(0).astype(int)
        scores = labels.astype(float) / 2.0
        return labels, scores, "manual"

    if not auto_label:
        raise ValueError(
            "Burnout labels are missing. Re-run with --auto-label or provide a labeled burnout CSV."
        )

    scores = df.apply(_heuristic_score, axis=1)
    q1, q2 = np.nanquantile(scores, [0.45, 0.75])

    labels = pd.Series(np.where(scores >= q2, 2, np.where(scores >= q1, 1, 0)), index=df.index)

    if labels.nunique() < 2:
        ranked = scores.rank(method="first")
        qcut_labels = pd.qcut(ranked, q=3, labels=[0, 1, 2], duplicates="drop")
        labels = qcut_labels.astype(int)

    if labels.nunique() < 2:
        raise ValueError("Unable to generate enough class diversity for burnout training.")

    return labels.astype(int), scores.astype(float), "heuristic"


def _encode_class_indices(labels: pd.Series) -> Tuple[pd.Series, Dict[int, str]]:
    canonical_to_level = {0: "low", 1: "medium", 2: "high"}
    present_canonical = sorted(int(v) for v in labels.unique())

    canonical_to_index = {canonical: idx for idx, canonical in enumerate(present_canonical)}
    class_index_to_level = {
        idx: canonical_to_level[canonical] for canonical, idx in canonical_to_index.items()
    }

    encoded = labels.map(canonical_to_index).astype(int)
    return encoded, class_index_to_level


def _train_burnout_model(X: pd.DataFrame, y: pd.Series, n_trials: int):
    preprocessor = ColumnTransformer(
        transformers=[("num", SimpleImputer(strategy="median"), BURNOUT_FEATURES)]
    )

    class_count = int(y.nunique())
    min_class_size = int(y.value_counts().min())
    n_splits = max(2, min(5, min_class_size))

    if n_splits < 2:
        raise ValueError("Not enough labeled rows per class for cross-validation.")

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 50, 220),
            "max_depth": trial.suggest_int("max_depth", 2, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "random_state": 42,
        }

        if class_count == 2:
            params.update({"objective": "binary:logistic", "eval_metric": "logloss"})
        else:
            params.update(
                {
                    "objective": "multi:softprob",
                    "num_class": class_count,
                    "eval_metric": "mlogloss",
                }
            )

        pipeline = ImbPipeline(
            [
                ("prep", preprocessor),
                ("scaler", StandardScaler()),
                ("clf", XGBClassifier(**params)),
            ]
        )

        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scores = []
        for train_idx, valid_idx in cv.split(X, y):
            X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
            y_train, y_valid = y.iloc[train_idx], y.iloc[valid_idx]

            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_valid)
            scores.append(f1_score(y_valid, preds, average="macro"))

        return float(np.mean(scores))

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = dict(study.best_params)
    best_params["random_state"] = 42
    if class_count == 2:
        best_params.update({"objective": "binary:logistic", "eval_metric": "logloss"})
    else:
        best_params.update(
            {
                "objective": "multi:softprob",
                "num_class": class_count,
                "eval_metric": "mlogloss",
            }
        )

    final_pipeline = ImbPipeline(
        [
            ("prep", preprocessor),
            ("scaler", StandardScaler()),
            ("clf", XGBClassifier(**best_params)),
        ]
    )
    final_pipeline.fit(X, y)

    return final_pipeline, float(study.best_value), best_params, n_splits


def _merge_global_metrics(models_dir: Path, updates: Dict[str, float | int | str]) -> Dict:
    metrics_path = models_dir / "metrics.json"
    merged = {}

    if metrics_path.exists():
        with metrics_path.open("r", encoding="utf-8") as f:
            merged = json.load(f)

    merged.update(updates)
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train burnout model from Mongo-exported burnout feature CSVs."
    )
    parser.add_argument("--trials", type=int, default=30, help="Optuna trials (default: 30)")
    parser.add_argument("--export-dir", type=str, default="data_exports", help="Export directory")
    parser.add_argument("--models-dir", type=str, default="models", help="Models directory")
    parser.add_argument("--burnout-csv", type=str, default="", help="Explicit burnout CSV path")
    parser.add_argument(
        "--use-exported-data",
        action="store_true",
        help="Read latest burnout CSV from export bundle",
    )
    parser.add_argument(
        "--auto-label",
        action="store_true",
        help="Generate heuristic labels when burnout_label is missing",
    )
    parser.add_argument("--window-days", type=int, default=30, help="Feature window days for metadata")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    export_dir = (script_dir / args.export_dir).resolve()
    models_dir = (script_dir / args.models_dir).resolve()
    models_dir.mkdir(parents=True, exist_ok=True)

    burnout_csv = None
    export_summary_path = None
    export_source = None

    if args.burnout_csv:
        burnout_csv = Path(args.burnout_csv)
        if not burnout_csv.is_absolute():
            burnout_csv = (script_dir / burnout_csv).resolve()
        export_source = "explicit-path"
    elif args.use_exported_data:
        export_info = _load_latest_burnout_csv(export_dir)
        if not export_info:
            raise FileNotFoundError(
                f"No burnout export CSV found in {export_dir}. Run npm run export:training-data first."
            )
        burnout_csv = Path(export_info["csv"]) if export_info.get("csv") else None
        export_summary_path = export_info.get("summary")
        export_source = str(export_info.get("source"))
    else:
        raise ValueError("Provide --burnout-csv or use --use-exported-data.")

    if burnout_csv is None or not burnout_csv.exists():
        raise FileNotFoundError("Burnout CSV not found.")

    df = pd.read_csv(burnout_csv)
    required = BURNOUT_FEATURES + ["burnout_label"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Burnout CSV missing required columns: {missing}")

    df = df[required].copy()
    df = _to_numeric(df, BURNOUT_FEATURES)
    df = df.replace([np.inf, -np.inf], np.nan)

    # Normalize nullables from telemetry exports.
    df["after_hours_worklog_ratio"] = df["after_hours_worklog_ratio"].fillna(0.0)
    df["avg_task_cycle_hours_window"] = df["avg_task_cycle_hours_window"].fillna(0.0)
    df["days_since_last_activity"] = df["days_since_last_activity"].fillna(0.0)
    df[BURNOUT_FEATURES] = df[BURNOUT_FEATURES].fillna(0.0)

    labels, scores, label_source = _build_labels(df, auto_label=args.auto_label)
    y_encoded, class_index_to_level = _encode_class_indices(labels)

    X = df[BURNOUT_FEATURES]
    model, macro_f1, best_params, cv_splits = _train_burnout_model(X, y_encoded, args.trials)

    model_path = models_dir / "burnout_model.pkl"
    features_path = models_dir / "burnout_features.pkl"
    metadata_path = models_dir / "burnout_metadata.json"
    metrics_path = models_dir / "burnout_metrics.json"

    joblib.dump(model, model_path)
    joblib.dump(BURNOUT_FEATURES, features_path)

    model_version = _sha256_file(model_path)

    class_distribution = {
        class_index_to_level[int(class_idx)]: int(count)
        for class_idx, count in y_encoded.value_counts().sort_index().items()
    }

    burnout_metrics = {
        "burnout_model_macro_f1": round(macro_f1, 4),
        "burnout_training_rows": int(len(df)),
        "burnout_label_source": label_source,
    }

    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                **burnout_metrics,
                "class_distribution": class_distribution,
                "computed_at": _utc_now_iso(),
            },
            f,
            indent=2,
        )

    _merge_global_metrics(models_dir, burnout_metrics)

    metadata = {
        "featureVersion": "burnout_v1_mongo_export",
        "createdAt": _utc_now_iso(),
        "modelVersion": model_version,
        "windowDays": int(args.window_days),
        "labelSource": label_source,
        "classIndexToLevel": {str(k): v for k, v in class_index_to_level.items()},
        "classDistribution": class_distribution,
        "trainingRows": int(len(df)),
        "crossValidation": {
            "nSplits": int(cv_splits),
            "macroF1": round(macro_f1, 4),
            "trials": int(args.trials),
        },
        "bestParams": best_params,
        "data": {
            "csvPath": str(burnout_csv.resolve()),
            "source": export_source,
            "summaryPath": str(export_summary_path) if export_summary_path else None,
            "heuristicScoreStats": {
                "min": float(np.min(scores)),
                "p50": float(np.median(scores)),
                "max": float(np.max(scores)),
            },
        },
    }

    with metadata_path.open("w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("=" * 70)
    print("AgileAI Burnout Model Training Complete")
    print("=" * 70)
    print(f"CSV: {burnout_csv}")
    print(f"Rows: {len(df)}")
    print(f"Label source: {label_source}")
    print(f"Class distribution: {class_distribution}")
    print(f"CV macro F1: {macro_f1:.4f}")
    print(f"Model: {model_path}")
    print(f"Features: {features_path}")
    print(f"Metadata: {metadata_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()
