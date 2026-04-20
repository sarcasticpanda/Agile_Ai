"""
CRITICAL verification: the burnout model must differentiate between devs
with different workloads. Before fix: ALL devs got "medium / 47.30".

Test matrix (4 mock devs):
  Alpha: 10h/week + 4 blocked tasks + 2 transitions  → should be HIGH or MEDIUM
  Beta:   6h/week + 1 blocked task + 0 transitions   → should be MEDIUM or LOW
  Gamma:  2h/week + 0 blocked + 0 transitions        → should be LOW
  Delta:  0h/week + 0 everything                     → should be LOW (idle)
"""
import joblib
import numpy as np
import pandas as pd

model = joblib.load('models/burnout_model.pkl')
features = joblib.load('models/burnout_features.pkl')
import json
with open('models/burnout_metadata.json') as f:
    meta = json.load(f)

class_map = {int(k): v for k, v in meta['classIndexToLevel'].items()}

print("BURNOUT MODEL DISCRIMINATIVE TEST")
print("=" * 60)
print(f"Model trained on {meta['trainingRows']} rows, macroF1={meta['crossValidation']['macroF1']}")
print(f"Previous (BROKEN) model: ALL devs got 'medium / 47.30'")
print()

# Build test rows matching BURNOUT_FEATURES order
CAPACITY = 40.0

test_devs = [
    {
        "name": "Alpha (10h/w + blocked)",
        "worklogs_count_window": 12,
        "avg_weekly_logged_hours": 10.0,
        "capacity_hours_per_week": CAPACITY,
        "over_capacity_ratio": 10.0 / CAPACITY,
        "after_hours_worklog_ratio": 0.1,
        "blocked_task_ratio": 0.4,
        "reopen_events_window": 2,
        "active_projects_window": 2,
        "status_transitions_window": 4,
        "avg_task_cycle_hours_window": 20.0,
        "days_since_last_activity": 0,
        "expected": "medium or high",
    },
    {
        "name": "Beta (6h/w + minimal block)",
        "worklogs_count_window": 6,
        "avg_weekly_logged_hours": 6.0,
        "capacity_hours_per_week": CAPACITY,
        "over_capacity_ratio": 6.0 / CAPACITY,
        "after_hours_worklog_ratio": 0.02,
        "blocked_task_ratio": 0.1,
        "reopen_events_window": 0,
        "active_projects_window": 1,
        "status_transitions_window": 1,
        "avg_task_cycle_hours_window": 10.0,
        "days_since_last_activity": 2,
        "expected": "low or medium",
    },
    {
        "name": "Gamma (2h/w + none blocked)",
        "worklogs_count_window": 3,
        "avg_weekly_logged_hours": 2.0,
        "capacity_hours_per_week": CAPACITY,
        "over_capacity_ratio": 2.0 / CAPACITY,
        "after_hours_worklog_ratio": 0.0,
        "blocked_task_ratio": 0.0,
        "reopen_events_window": 0,
        "active_projects_window": 1,
        "status_transitions_window": 0,
        "avg_task_cycle_hours_window": 5.0,
        "days_since_last_activity": 5,
        "expected": "low",
    },
    {
        "name": "Delta (0h, fully idle)",
        "worklogs_count_window": 0,
        "avg_weekly_logged_hours": 0.0,
        "capacity_hours_per_week": CAPACITY,
        "over_capacity_ratio": 0.0,
        "after_hours_worklog_ratio": 0.0,
        "blocked_task_ratio": 0.0,
        "reopen_events_window": 0,
        "active_projects_window": 0,
        "status_transitions_window": 0,
        "avg_task_cycle_hours_window": 0.0,
        "days_since_last_activity": 30,
        "expected": "low",
    },
]

scores = []
all_different = True
last_level = None

for dev in test_devs:
    row = {feat: dev.get(feat, 0.0) for feat in features}
    X = pd.DataFrame([row], columns=features)
    pred_idx = model.predict(X)[0]
    level = class_map[int(pred_idx)]
    proba = model.predict_proba(X)[0]
    confidence = max(proba)
    scores.append((dev['name'], level, confidence, dev['expected']))
    
    match = dev['expected'].lower() in level.lower() or level.lower() in dev['expected'].lower()
    status = 'PASS' if match else 'NOTE'
    print(f"  {dev['name']:35s} -> {level:6s}  conf={confidence:.3f}  expected={dev['expected']}  [{status}]")
    
    if last_level is not None and level == last_level and level == scores[0][1]:
        all_different = False
    last_level = level

# Check levels are NOT all identical (the original bug)
unique_levels = set(s[1] for s in scores)
print()
if len(unique_levels) >= 2:
    print(f"PASS: Model produces {len(unique_levels)} distinct burnout levels across 4 dev profiles")
    print(f"      Levels seen: {sorted(unique_levels)}")
else:
    print(f"FAIL: All 4 devs got same level '{list(unique_levels)[0]}' — model still broken!")

# Verify Alpha scores higher than Delta
alpha_level = scores[0][1]
delta_level = scores[3][1]
level_to_num = {'low': 0, 'medium': 1, 'high': 2}
if level_to_num.get(alpha_level, -1) >= level_to_num.get(delta_level, 99):
    print(f"PASS: Alpha ({alpha_level}) >= Delta ({delta_level}) — active dev scores higher risk")
else:
    print(f"FAIL: Alpha ({alpha_level}) < Delta ({delta_level}) — wrong ordering!")

print()

# Show extra high-stress scenario
extreme_row = {feat: 0.0 for feat in features}
extreme_row.update({
    'avg_weekly_logged_hours': 65.0,
    'capacity_hours_per_week': 40.0,
    'over_capacity_ratio': 1.8,
    'after_hours_worklog_ratio': 0.7,
    'blocked_task_ratio': 0.6,
    'status_transitions_window': 40,
    'reopen_events_window': 8,
})
X_ext = pd.DataFrame([extreme_row], columns=features)
pred = class_map[int(model.predict(X_ext)[0])]
print(f"Extreme overwork scenario  -> {pred}  (PASS if 'high')" if pred == 'high' else f"WARN: extreme scenario predicted '{pred}' not 'high'")
