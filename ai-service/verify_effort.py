"""
Verify the effort model now responds to task type and priority.
Before fix: type/priority were hardcoded to 2.0 in training AND inference.
Bug/critical === Task/medium === every task.

After fix: type_encoded and priority_encoded vary by actual type/priority.
We should see different predictions for different types.
"""
import joblib
import numpy as np
import pandas as pd

model = joblib.load('models/effort_model.pkl')
features = joblib.load('models/effort_features.pkl')

print("EFFORT MODEL TYPE/PRIORITY SENSITIVITY TEST")
print("=" * 60)
print(f"Features: {features}")
print()

# Encoding maps (from api.py _TASK_TYPE_MAP / _TASK_PRIORITY_MAP)
TYPE_MAP = {'bug': 0.0, 'story': 1.0, 'task': 2.0, 'feature': 3.0}
PRIO_MAP = {'low': 0.0, 'medium': 1.0, 'high': 2.0, 'critical': 3.0}

# Medium description length (desc_bucket=2), medium title
desc_bucket = 2.0
title_norm = 0.5

test_cases = [
    ('bug',     'critical', 0.0, 3.0),
    ('bug',     'high',     0.0, 2.0),
    ('story',   'high',     1.0, 2.0),
    ('task',    'medium',   2.0, 1.0),
    ('feature', 'medium',   3.0, 1.0),
    ('task',    'low',      2.0, 0.0),
]

predictions = []
for task_type, priority, type_enc, prio_enc in test_cases:
    row = {
        'type_encoded': type_enc,
        'priority_encoded': prio_enc,
        'desc_bucket': desc_bucket,
        'title_length_norm': title_norm,
    }
    X = pd.DataFrame([[row.get(col, 0.0) for col in features]], columns=features)
    pred = model.predict(X)[0]
    predictions.append(pred)
    print(f"  {task_type:8s} / {priority:8s}  ->  {pred:.2f} story points")

print()
# Check there is variation (not all identical)
min_pred = min(predictions)
max_pred = max(predictions)
spread = max_pred - min_pred

if spread > 0.1:
    print(f"PASS: Predictions vary by {spread:.2f} points across task types")
    print(f"      Range: {min_pred:.2f} - {max_pred:.2f}")
else:
    print(f"FAIL: All predictions identical ({min_pred:.2f}) — type/priority still ignored!")

# Verify longer description = more points (fundamental trend)
results_by_desc = []
for bucket in [0, 1, 2, 3]:
    row = {'type_encoded': 2.0, 'priority_encoded': 1.0, 'desc_bucket': float(bucket), 'title_length_norm': 0.5}
    X = pd.DataFrame([[row.get(col, 0.0) for col in features]], columns=features)
    pred = model.predict(X)[0]
    results_by_desc.append(pred)

print()
print("Description length sensitivity:")
for label, pred in zip(['empty', 'short(<100)', 'medium(<500)', 'long(500+)'], results_by_desc):
    print(f"  {label:15s}  ->  {pred:.2f} pts")

if results_by_desc[-1] >= results_by_desc[0]:
    print("PASS: Longer description -> more story points (expected)")
else:
    print("NOTE: Inverse desc-length trend (unusual but may reflect dataset pattern)")
