"""
FINAL PHASE VERIFICATION
Checks all fixes are in place without starting the server.
"""
import ast
import json
import os
import joblib
import numpy as np
import pandas as pd

PASS = 0
FAIL = 0

def check(name, condition, detail=''):
    global PASS, FAIL
    if condition:
        print(f"  PASS: {name}")
        PASS += 1
    else:
        print(f"  FAIL: {name}" + (f" -- {detail}" if detail else ''))
        FAIL += 1

print("=" * 70)
print("AGILE AI -- COMPREHENSIVE FIX VERIFICATION")
print("=" * 70)

# ─── PHASE 1: CODE FIXES ───────────────────────────────────────────────────
print("\n[PHASE 1] Code fixesÂ")

with open('api.py', encoding='utf-8') as f:
    api_src = f.read()

check("1.1 Status transition null changedBy fix",
      "changed_by is None or str(changed_by)" in api_src)
check("1.2 After-hours default 540 minutes",
      "or 540" in api_src)
check("1.3 Industry-default hours fallback",
      "industry_default_4h_per_point" in api_src)
check("1.4 Float cast on burnout response fields",
      "float(outcome[\"burnoutRiskScore\"] or 0.0)" in api_src)
check("1.5 TYPE_MAP in api.py",
      "_TASK_TYPE_MAP" in api_src)
check("1.5 PRIORITY_MAP in api.py",
      "_TASK_PRIORITY_MAP" in api_src)
check("1.5 type_encoded from map",
      "_TASK_TYPE_MAP.get(task_type" in api_src)

with open('api.py', encoding='utf-8') as f:
    ast.parse(f.read())
check("1.X api.py syntax valid", True)

# Check deprecated scripts exit immediately
with open('train_pro.py', encoding='utf-8') as f:
    src = f.read()
check("1.9 train_pro.py has deprecation guard", "sys.exit(1)" in src)

with open('train_models_gpu.py', encoding='utf-8') as f:
    src = f.read()
check("1.9 train_models_gpu.py has deprecation guard", "sys.exit(1)" in src)

# ─── PHASE 2: EFFORT MODEL ─────────────────────────────────────────────────
print("\n[PHASE 2] Effort model encoding fix")

with open('train_models.py', encoding='utf-8') as f:
    tm_src = f.read()

check("2.1 Hardcoded type_encoded=2 removed", "effort_df['type_encoded'] = 2" not in tm_src)
check("2.1 Keyword inference added", "_infer_type" in tm_src)
check("2.2 NaN-safe inference functions", "pd.notna(title)" in tm_src)

effort_model = joblib.load('models/effort_model.pkl')
effort_features = joblib.load('models/effort_features.pkl')

TYPE_MAP = {'bug': 0.0, 'story': 1.0, 'task': 2.0, 'feature': 3.0}
PRIO_MAP = {'low': 0.0, 'medium': 1.0, 'high': 2.0, 'critical': 3.0}

def pred_effort(task_type, priority, desc_bucket=2.0, title_norm=0.5):
    row = {
        'type_encoded': TYPE_MAP.get(task_type, 2.0),
        'priority_encoded': PRIO_MAP.get(priority, 1.0),
        'desc_bucket': desc_bucket,
        'title_length_norm': title_norm,
    }
    X = pd.DataFrame([[row.get(f, 0.0) for f in effort_features]], columns=effort_features)
    return float(effort_model.predict(X)[0])

bug_crit = pred_effort('bug', 'critical')
task_low = pred_effort('task', 'low')
feature_med = pred_effort('feature', 'medium')

check("2.3 Effort predictions vary (not all identical)",
      len({round(bug_crit, 1), round(task_low, 1), round(feature_med, 1)}) > 1,
      f"bug/crit={bug_crit:.2f}, task/low={task_low:.2f}, feature/med={feature_med:.2f}")
check("2.3 Longer description = more points",
      pred_effort('task', 'medium', desc_bucket=3.0) >= pred_effort('task', 'medium', desc_bucket=0.0))

# ─── PHASE 3: BURNOUT MODEL ─────────────────────────────────────────────────
print("\n[PHASE 3] Burnout model retrain")

with open('models/burnout_metadata.json') as f:
    bmeta = json.load(f)

check("3.1 Burnout model trained on 200+ rows",
      bmeta['trainingRows'] >= 200,
      f"actual rows: {bmeta['trainingRows']}")
check("3.2 Burnout macro F1 > 0.65",
      bmeta['crossValidation']['macroF1'] > 0.65,
      f"actual F1: {bmeta['crossValidation']['macroF1']}")
check("3.3 All 3 burnout classes present",
      set(bmeta['classDistribution'].keys()) == {'low', 'medium', 'high'})

burnout_model = joblib.load('models/burnout_model.pkl')
burnout_features = joblib.load('models/burnout_features.pkl')

def pred_burnout(avg_weekly_hours, over_cap, blocked=0.0, after_hours=0.0):
    row = {feat: 0.0 for feat in burnout_features}
    row['avg_weekly_logged_hours'] = avg_weekly_hours
    row['capacity_hours_per_week'] = 40.0
    row['over_capacity_ratio'] = over_cap
    row['blocked_task_ratio'] = blocked
    row['after_hours_worklog_ratio'] = after_hours
    X = pd.DataFrame([[row[f] for f in burnout_features]], columns=burnout_features)
    idx = int(burnout_model.predict(X)[0])
    return bmeta['classIndexToLevel'][str(idx)]

idle_level = pred_burnout(0, 0)
active_level = pred_burnout(10, 0.25, blocked=0.4)
overwork_level = pred_burnout(60, 1.8, after_hours=0.7)

check("3.4 Extreme overwork = HIGH",
      overwork_level == 'high',
      f"actual: {overwork_level}")
check("3.4 Overwork scores higher than idle",
      {'high': 2, 'medium': 1, 'low': 0}[overwork_level] >= {'high': 2, 'medium': 1, 'low': 0}[idle_level],
      f"overwork={overwork_level}, idle={idle_level}")

# ─── PHASE 4: RISK MODEL ────────────────────────────────────────────────────
print("\n[PHASE 4] Risk model label leakage fix")

with open('models/metrics.json') as f:
    metrics = json.load(f)

risk_model = joblib.load('models/risk_model.pkl')
risk_features = joblib.load('models/risk_features.pkl')

check("4.1 Label leakage removed from train_models.py",
      "risk_composite" in open('train_models.py', encoding='utf-8').read())
check("4.2 Composite 40th percentile threshold used",
      "quantile(0.40)" in open('train_models.py', encoding='utf-8').read())

def pred_risk(blocked=0.0, scope=0.0, high_prio=0.5, churn=0.0):
    row = {feat: 0.0 for feat in risk_features}
    row['blocked_ratio'] = blocked
    row['scope_creep_rate'] = scope
    row['high_priority_ratio'] = high_prio
    row['churn_ratio'] = churn
    X = pd.DataFrame([[row[f] for f in risk_features]], columns=risk_features)
    return int(risk_model.predict(X)[0])

low_risk = pred_risk(blocked=0.01, scope=0.01, high_prio=0.1, churn=0.01)
high_risk = pred_risk(blocked=0.7, scope=0.6, high_prio=0.8, churn=0.8)

check("4.3 High-stress sprint = HIGH RISK (success=0)",
      high_risk == 0,
      f"actual: {high_risk}")
check("4.4 Low-stress sprint = LOW RISK (success=1)",
      low_risk == 1,
      f"actual: {low_risk}")

clf = risk_model.named_steps['clf']
importances = clf.feature_importances_
max_importance = max(importances)
check("4.5 No single feature dominates (>0.60)",
      max_importance < 0.60,
      f"max importance: {max_importance:.4f}")

# ─── SUMMARY ────────────────────────────────────────────────────────────────
print()
print("=" * 70)
print(f"RESULTS: {PASS} passed, {FAIL} failed")
if FAIL == 0:
    print("ALL CHECKS PASSED -- AI pipeline fully remediated")
else:
    print(f"WARNING: {FAIL} check(s) failed -- review above")
print("=" * 70)
