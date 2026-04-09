import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import optuna
import pandas as pd
import joblib
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score, mean_absolute_error
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier, XGBRegressor

from train_models import load_effort_data, load_sprint_data


RISK_FEATURES = [
    'blocked_ratio',
    'blocking_ratio',
    'scope_creep_rate',
    'high_priority_ratio',
    'avg_dependency_links',
    'bug_ratio',
    'churn_ratio',
    'sprint_size_normalized',
]

EFFORT_FEATURES = [
    'type_encoded',
    'priority_encoded',
    'desc_bucket',
    'title_length_norm',
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def _to_numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


def _load_latest_export_bundle(export_dir: Path) -> dict:
    summaries = sorted(export_dir.glob('export_summary_*.json'), key=lambda p: p.stat().st_mtime)
    if summaries:
        with summaries[-1].open('r', encoding='utf-8') as f:
            summary = json.load(f)

        files = summary.get('files', {})
        risk_path = Path(files.get('risk', '')) if files.get('risk') else None
        effort_path = Path(files.get('effort', '')) if files.get('effort') else None

        if risk_path and not risk_path.is_absolute():
            risk_path = (export_dir / risk_path).resolve()
        if effort_path and not effort_path.is_absolute():
            effort_path = (export_dir / effort_path).resolve()

        if risk_path and effort_path and risk_path.exists() and effort_path.exists():
            return {
                'summary_path': summaries[-1],
                'risk_csv': risk_path,
                'effort_csv': effort_path,
                'source': 'summary',
            }

    risk_files = sorted(export_dir.glob('risk_training_from_mongo_*.csv'), key=lambda p: p.stat().st_mtime)
    effort_files = sorted(export_dir.glob('effort_training_from_mongo_*.csv'), key=lambda p: p.stat().st_mtime)

    if not risk_files or not effort_files:
        return {}

    return {
        'summary_path': None,
        'risk_csv': risk_files[-1],
        'effort_csv': effort_files[-1],
        'source': 'fallback-csv-scan',
    }


def _load_export_risk_df(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    required = RISK_FEATURES + ['success']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'Risk export missing required columns: {missing}')

    df = df[required].copy()
    df = _to_numeric(df, required)
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    df = df[df['success'].isin([0, 1])]
    return df


def _load_export_effort_df(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    required = EFFORT_FEATURES + ['story_points']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'Effort export missing required columns: {missing}')

    df = df[required].copy()
    df = _to_numeric(df, required)
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    df = df[(df['story_points'] > 0) & (df['story_points'] <= 40)]
    return df


def _train_risk_model(df: pd.DataFrame, output_dir: Path, n_trials: int) -> float:
    X = df[RISK_FEATURES]
    y = df['success']

    preprocessor = ColumnTransformer([
        ('num', SimpleImputer(strategy='median'), RISK_FEATURES),
    ])

    def objective(trial: optuna.Trial) -> float:
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 200),
            'max_depth': trial.suggest_int('max_depth', 3, 8),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'random_state': 42,
            'eval_metric': 'logloss',
        }

        pipeline = ImbPipeline([
            ('prep', preprocessor),
            ('smote', SMOTE(random_state=42)),
            ('scaler', StandardScaler()),
            ('clf', XGBClassifier(**params)),
        ])

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        scores = []
        for train_idx, valid_idx in cv.split(X, y):
            X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
            y_train, y_valid = y.iloc[train_idx], y.iloc[valid_idx]

            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_valid)
            scores.append(f1_score(y_valid, preds, average='macro'))

        return float(np.mean(scores))

    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = dict(study.best_params)
    best_params['random_state'] = 42
    best_params['eval_metric'] = 'logloss'

    final_pipeline = ImbPipeline([
        ('prep', preprocessor),
        ('smote', SMOTE(random_state=42)),
        ('scaler', StandardScaler()),
        ('clf', XGBClassifier(**best_params)),
    ])
    final_pipeline.fit(X, y)

    joblib.dump(final_pipeline, output_dir / 'risk_model.pkl')
    joblib.dump(RISK_FEATURES, output_dir / 'risk_features.pkl')
    return float(study.best_value)


def _train_effort_model(df: pd.DataFrame, output_dir: Path, n_trials: int) -> float:
    X = df[EFFORT_FEATURES]
    y = df['story_points']

    preprocessor = ColumnTransformer([
        ('num', SimpleImputer(strategy='median'), EFFORT_FEATURES),
    ])

    def objective(trial: optuna.Trial) -> float:
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 200),
            'max_depth': trial.suggest_int('max_depth', 3, 8),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'random_state': 42,
        }

        pipeline = ImbPipeline([
            ('prep', preprocessor),
            ('scaler', StandardScaler()),
            ('reg', XGBRegressor(**params)),
        ])

        cv = KFold(n_splits=5, shuffle=True, random_state=42)
        scores = []
        for train_idx, valid_idx in cv.split(X, y):
            X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
            y_train, y_valid = y.iloc[train_idx], y.iloc[valid_idx]

            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_valid)
            scores.append(mean_absolute_error(y_valid, preds))

        return float(np.mean(scores))

    study = optuna.create_study(direction='minimize')
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)

    best_params = dict(study.best_params)
    best_params['random_state'] = 42

    final_pipeline = ImbPipeline([
        ('prep', preprocessor),
        ('scaler', StandardScaler()),
        ('reg', XGBRegressor(**best_params)),
    ])
    final_pipeline.fit(X, y)

    joblib.dump(final_pipeline, output_dir / 'effort_model.pkl')
    joblib.dump(EFFORT_FEATURES, output_dir / 'effort_features.pkl')
    return float(study.best_value)


def _make_candidate_version(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()[:12]


def _promote_candidate(candidate_dir: Path, models_dir: Path) -> Path:
    timestamp = _now_stamp()
    backup_dir = models_dir / 'backups' / f'pre_promote_{timestamp}'
    backup_dir.mkdir(parents=True, exist_ok=True)

    prod_files = [
        'risk_model.pkl',
        'risk_features.pkl',
        'effort_model.pkl',
        'effort_features.pkl',
        'metrics.json',
    ]

    for name in prod_files:
        src = models_dir / name
        if src.exists():
            shutil.copy2(src, backup_dir / name)

    for name in prod_files:
        src = candidate_dir / name
        if not src.exists():
            raise FileNotFoundError(f'Candidate artifact missing: {src}')
        shutil.copy2(src, models_dir / name)

    marker = {
        'promotedAt': _utc_now_iso(),
        'candidateDir': str(candidate_dir.resolve()),
    }
    with (models_dir / 'current_candidate.json').open('w', encoding='utf-8') as f:
        json.dump(marker, f, indent=2)

    return backup_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Train versioned candidate models from base datasets + exported Mongo CSVs.',
    )
    parser.add_argument('--trials', type=int, default=25, help='Optuna trials per model (default: 25).')
    parser.add_argument('--export-dir', type=str, default='data_exports', help='Export CSV directory.')
    parser.add_argument('--models-dir', type=str, default='models', help='Models directory.')
    parser.add_argument(
        '--use-exported-data',
        action='store_true',
        help='Append latest exported Mongo CSV rows into training data.',
    )
    parser.add_argument('--promote', action='store_true', help='Promote candidate artifacts to production models.')
    parser.add_argument('--candidate-tag', type=str, default='', help='Optional suffix for the candidate folder.')

    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    export_dir = (script_dir / args.export_dir).resolve()
    models_dir = (script_dir / args.models_dir).resolve()
    candidates_root = models_dir / 'candidates'
    candidates_root.mkdir(parents=True, exist_ok=True)

    print('=' * 70)
    print('AgileAI Candidate Retraining Runner')
    print('=' * 70)
    print(f'Trials per model: {args.trials}')
    print(f'Use exported data: {args.use_exported_data}')
    print(f'Promote after train: {args.promote}')

    base_risk_df = load_sprint_data(data_root=str(script_dir / 'repo_cache' / 'morakotch' / 'agile sprints' / 'IEEE TSE2017' / 'dataset'))
    base_effort_df = load_effort_data(data_root=str(script_dir / 'repo_cache' / 'morakotch' / 'storypoint' / 'IEEE TSE2018' / 'dataset'))

    base_risk_df = _to_numeric(base_risk_df[RISK_FEATURES + ['success']].copy(), RISK_FEATURES + ['success'])
    base_effort_df = _to_numeric(base_effort_df[EFFORT_FEATURES + ['story_points']].copy(), EFFORT_FEATURES + ['story_points'])

    export_info = {}
    export_risk_rows = 0
    export_effort_rows = 0

    if args.use_exported_data:
        export_info = _load_latest_export_bundle(export_dir)
        if not export_info:
            raise FileNotFoundError(
                f'No export bundle found in {export_dir}. Run `npm run export:training-data` from agileai/server first.'
            )

        export_risk_df = _load_export_risk_df(export_info['risk_csv'])
        export_effort_df = _load_export_effort_df(export_info['effort_csv'])
        export_risk_rows = len(export_risk_df)
        export_effort_rows = len(export_effort_df)

        base_risk_df = pd.concat([base_risk_df, export_risk_df], ignore_index=True)
        base_effort_df = pd.concat([base_effort_df, export_effort_df], ignore_index=True)

    base_risk_df = base_risk_df.replace([np.inf, -np.inf], np.nan).fillna(0)
    base_effort_df = base_effort_df.replace([np.inf, -np.inf], np.nan).fillna(0)
    base_effort_df = base_effort_df[(base_effort_df['story_points'] > 0) & (base_effort_df['story_points'] <= 40)]

    stamp = _now_stamp()
    version_seed = {
        'stamp': stamp,
        'trials': args.trials,
        'riskRows': int(len(base_risk_df)),
        'effortRows': int(len(base_effort_df)),
        'riskExportRows': int(export_risk_rows),
        'effortExportRows': int(export_effort_rows),
    }
    candidate_version = _make_candidate_version(version_seed)
    tag = f"_{args.candidate_tag}" if args.candidate_tag else ''
    candidate_name = f'candidate_{stamp}_{candidate_version}{tag}'
    candidate_dir = candidates_root / candidate_name
    candidate_dir.mkdir(parents=True, exist_ok=False)

    risk_score = _train_risk_model(base_risk_df, candidate_dir, n_trials=args.trials)
    effort_mae = _train_effort_model(base_effort_df, candidate_dir, n_trials=args.trials)

    metrics = {
        'risk_model_macro_f1': round(risk_score, 4),
        'effort_model_mae': round(effort_mae, 4),
    }
    with (candidate_dir / 'metrics.json').open('w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)

    manifest = {
        'candidateVersion': candidate_version,
        'createdAt': _utc_now_iso(),
        'candidateName': candidate_name,
        'candidateDir': str(candidate_dir.resolve()),
        'trials': args.trials,
        'data': {
            'riskRowsTotal': int(len(base_risk_df)),
            'effortRowsTotal': int(len(base_effort_df)),
            'riskRowsFromExport': int(export_risk_rows),
            'effortRowsFromExport': int(export_effort_rows),
            'usedExportData': bool(args.use_exported_data),
            'exportSource': export_info.get('source') if export_info else None,
            'exportSummaryPath': str(export_info.get('summary_path')) if export_info.get('summary_path') else None,
            'riskExportCsv': str(export_info.get('risk_csv')) if export_info.get('risk_csv') else None,
            'effortExportCsv': str(export_info.get('effort_csv')) if export_info.get('effort_csv') else None,
        },
        'metrics': metrics,
        'productionOverwritten': False,
    }

    backup_dir = None
    if args.promote:
        backup_dir = _promote_candidate(candidate_dir, models_dir)
        manifest['productionOverwritten'] = True
        manifest['backupDir'] = str(backup_dir.resolve())

    with (candidate_dir / 'candidate_manifest.json').open('w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print('-' * 70)
    print(f'Candidate created: {candidate_dir}')
    print(f"Metrics: risk_f1={metrics['risk_model_macro_f1']} effort_mae={metrics['effort_model_mae']}")
    if args.promote:
        print(f'Production models promoted. Backup: {backup_dir}')
    else:
        print('Production models unchanged (default behavior).')
    print('-' * 70)


if __name__ == '__main__':
    main()