import os
import json
import joblib
import pandas as pd
import numpy as np
import optuna
import shap
import warnings
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import classification_report, mean_absolute_error, f1_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings('ignore')
os.makedirs('models', exist_ok=True)

print("="*60)
print("AGILE AI - ENTERPRISE ML PIPELINE (XGBOOST + OPTUNA + SMOTE)")
print("="*60)

# ═══════════════════════════════════════════════════════════════
# PART 1 — Robust Ingestion & Feature Engineering
# ═══════════════════════════════════════════════════════════════
def load_sprint_data(data_root=r'repo_cache/morakotch/agile sprints/IEEE TSE2017/dataset'):
    print("\n[1/4] Loading and Engineering Sprint Risk Data...")
    all_issues = []
    
    for project_folder in ['Apache', 'JBoss', 'JIRA', 'MongoDB', 'Spring']:
        folder_path = os.path.join(data_root, project_folder)
        if not os.path.exists(folder_path): continue
        
        for file in os.listdir(folder_path):
            if file.endswith('.csv'):
                file_path = os.path.join(folder_path, file)
                try:
                    df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')
                except UnicodeDecodeError:
                    df = pd.read_csv(file_path, encoding='cp1252', on_bad_lines='skip')
                all_issues.append(df)

    if not all_issues:
        raise ValueError("No Sprint data found! Ensure git clone occurred.")

    issues_df = pd.concat(all_issues, ignore_index=True)
    issues_df.columns = issues_df.columns.str.lower()
    
    sprints = []
    grouper = ['boardid', 'sprintid'] if ('boardid' in issues_df.columns and 'sprintid' in issues_df.columns) else [issues_df.index]

    for name, group in issues_df.groupby(grouper):
        total = len(group)
        if total < 3: continue
        
        blocked_ratio = (group['no_blockedby'] > 0).sum() / total if 'no_blockedby' in group.columns else 0
        blocking_ratio = (group['no_blocking'] > 0).sum() / total if 'no_blocking' in group.columns else 0
        scope_creep_rate = (group['no_des_change'] > 1).sum() / total if 'no_des_change' in group.columns else 0
        
        high_priority_ratio = 0.5
        if 'priority' in group.columns:
            high_priority_ratio = (group['priority'].astype(str).str.lower().isin(['blocker', 'critical', 'major'])).sum() / total
            
        avg_dependency_links = group['no_issuelink'].mean() / 10 if 'no_issuelink' in group.columns else 0.1
        
        bug_ratio = 0.2
        if 'type' in group.columns:
            bug_ratio = (group['type'].astype(str).str.lower() == 'bug').sum() / total
            
        churn_ratio = 0
        if 'no_priority_change' in group.columns and 'no_des_change' in group.columns:
            churn_ratio = (group['no_priority_change'].sum() + group['no_des_change'].sum()) / (total * 5)
            
        sprint_size_normalized = min(total, 30) / 30
        
        # 0 = High Risk (Failed Goals), 1 = Low Risk (Successful Goal Delivery)
        success_label = 1 if (blocked_ratio < 0.2 and churn_ratio < 0.5) else 0
        
        sprints.append({
            'blocked_ratio': blocked_ratio,
            'blocking_ratio': blocking_ratio,
            'scope_creep_rate': scope_creep_rate,
            'high_priority_ratio': high_priority_ratio,
            'avg_dependency_links': avg_dependency_links,
            'bug_ratio': bug_ratio,
            'churn_ratio': churn_ratio,
            'sprint_size_normalized': sprint_size_normalized,
            'success': success_label
        })
        
    sprint_df = pd.DataFrame(sprints).fillna(0)
    print(f"   -> Created {len(sprint_df)} robust sprint profiles.")
    return sprint_df


def load_effort_data(data_root=r'repo_cache/morakotch/storypoint/IEEE TSE2018/dataset'):
    print("\n[2/4] Loading and Engineering Task Effort Data...")
    all_issues = []
    
    if not os.path.exists(data_root):
        raise ValueError("No effort data found!")

    for file in os.listdir(data_root):
        if file.endswith('.csv'):
            file_path = os.path.join(data_root, file)
            try:
                df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='cp1252', on_bad_lines='skip')
            all_issues.append(df)

    effort_df = pd.concat(all_issues, ignore_index=True)
    effort_df.columns = effort_df.columns.str.lower()
    
    if 'storypoint' in effort_df.columns:
        effort_df.rename(columns={'storypoint': 'story_points'}, inplace=True)
        
    effort_df = effort_df.dropna(subset=['story_points'])
    effort_df = effort_df[(effort_df['story_points'] > 0) & (effort_df['story_points'] <= 40)]
    
    effort_df['title_length'] = effort_df['title'].fillna('').astype(str).str.len()
    effort_df['title_length_norm'] = np.clip(effort_df['title_length'] / 100, 0, 1)
    
    effort_df['desc_length'] = effort_df['description'].fillna('').astype(str).str.len()
    effort_df['desc_bucket'] = pd.cut(
        effort_df['desc_length'], bins=[-1, 0, 100, 500, float('inf')], labels=[0, 1, 2, 3]
    ).astype(float)
    
    effort_df['type_encoded'] = 2 
    effort_df['priority_encoded'] = 2
    
    features = ['type_encoded', 'priority_encoded', 'desc_bucket', 'title_length_norm', 'story_points']
    final_df = effort_df[features].copy().fillna(0)
    
    print(f"   -> Loaded {len(final_df)} highly-cleaned task records.")
    return final_df

# ═══════════════════════════════════════════════════════════════
# PART 2 — Optuna Bayesian Optimization (XGBoost + SMOTE)
# ═══════════════════════════════════════════════════════════════
def train_risk_model(df):
    print("\n[3/4] Optimizing Risk Classifier (SMOTE + XGBoost)...")
    
    features = ['blocked_ratio', 'blocking_ratio', 'scope_creep_rate', 'high_priority_ratio',
                'avg_dependency_links', 'bug_ratio', 'churn_ratio', 'sprint_size_normalized']
    X = df[features]
    y = df['success']
    
    preprocessor = ColumnTransformer(transformers=[
        ('num', SimpleImputer(strategy='median'), features)
    ])
    
    def objective(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 200),
            'max_depth': trial.suggest_int('max_depth', 3, 8),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'random_state': 42,
            'eval_metric': 'logloss'
        }
        
        # Leaking pre-processing? Not anymore: Pipeline encapsulates it per-fold!
        pipeline = ImbPipeline([
            ('prep', preprocessor),
            ('smote', SMOTE(random_state=42)),
            ('scaler', StandardScaler()),
            ('clf', XGBClassifier(**params))
        ])
        
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        scores = []
        for train_idx, valid_idx in cv.split(X, y):
            X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
            y_train, y_valid = y.iloc[train_idx], y.iloc[valid_idx]
            
            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_valid)
            scores.append(f1_score(y_valid, preds, average='macro'))
            
        return np.mean(scores)

    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=100, show_progress_bar=False) 
    
    best_params = study.best_params
    best_params['random_state'] = 42
    best_params['eval_metric'] = 'logloss'
    
    print(f"   -> Best CV F1-Score: {study.best_value:.4f}")
    
    # Train full model with best params
    final_pipeline = ImbPipeline([
        ('prep', preprocessor),
        ('smote', SMOTE(random_state=42)),
        ('scaler', StandardScaler()),
        ('clf', XGBClassifier(**best_params))
    ])
    final_pipeline.fit(X, y)
    
    joblib.dump(final_pipeline, 'models/risk_model.pkl')
    joblib.dump(features, 'models/risk_features.pkl')
    
    return study.best_value

def train_effort_model(df):
    print("\n[4/4] Optimizing Effort Regressor (XGBoost)...")
    
    features = ['type_encoded', 'priority_encoded', 'desc_bucket', 'title_length_norm']
    X = df[features]
    y = df['story_points']
    
    preprocessor = ColumnTransformer(transformers=[
        ('num', SimpleImputer(strategy='median'), features)
    ])
    
    def objective(trial):
        params = {
            'n_estimators': trial.suggest_int('n_estimators', 50, 200),
            'max_depth': trial.suggest_int('max_depth', 3, 8),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.2, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'random_state': 42
        }
        
        pipeline = ImbPipeline([
            ('prep', preprocessor),
            ('scaler', StandardScaler()),
            ('reg', XGBRegressor(**params))
        ])
        
        cv = KFold(n_splits=5, shuffle=True, random_state=42)
        scores = []
        for train_idx, valid_idx in cv.split(X, y):
            X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
            y_train, y_valid = y.iloc[train_idx], y.iloc[valid_idx]
            
            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_valid)
            scores.append(mean_absolute_error(y_valid, preds))
            
        return np.mean(scores)

    study = optuna.create_study(direction='minimize')
    study.optimize(objective, n_trials=100, show_progress_bar=False) 
    
    best_params = study.best_params
    best_params['random_state'] = 42
    
    print(f"   -> Best CV Mean Absolute Error: {study.best_value:.2f} points")
    
    # Final Fit
    final_pipeline = ImbPipeline([
        ('prep', preprocessor),
        ('scaler', StandardScaler()),
        ('reg', XGBRegressor(**best_params))
    ])
    final_pipeline.fit(X, y)
    
    joblib.dump(final_pipeline, 'models/effort_model.pkl')
    joblib.dump(features, 'models/effort_features.pkl')
    
    return study.best_value

if __name__ == '__main__':
    sprint_df = load_sprint_data()
    effort_df = load_effort_data()
    
    risk_score = train_risk_model(sprint_df)
    effort_mae = train_effort_model(effort_df)
    
    metrics = {
        'risk_model_macro_f1': round(risk_score, 4),
        'effort_model_mae': round(effort_mae, 4)
    }
    with open('models/metrics.json', 'w') as f:
        json.dump(metrics, f, indent=4)
        
    print("\n==================================================")
    print("SUCCESS: 100x ENTERPRISE ML PIPELINE COMPLETE")
    print(metrics)
    print("==================================================\n")
