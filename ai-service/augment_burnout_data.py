"""
Augment the real MongoDB export with synthetic burnout data points.
This covers scenarios that never occurred in a small 4-dev test db:
  - Sustained overwork (over_capacity > 1.5)
  - Night owl patterns (after_hours > 0.5)
  - Workaholic + blocked combo
  - Idle developer (all zeros)
Total target: 200+ rows before feeding to train_burnout_model.py
"""
import pandas as pd
import numpy as np
import json
import glob
import os
from pathlib import Path

rng = np.random.default_rng(seed=42)

# === Load the exported real MongoDB data ===
export_dir = Path('data_exports')
files = sorted(export_dir.glob('burnout_features_unlabeled_*.csv'), key=lambda p: p.stat().st_mtime)
if not files:
    raise FileNotFoundError("No burnout export CSV found. Run: node export_training_data.mjs")

real_df = pd.read_csv(files[-1])
print(f"Real exported rows: {len(real_df)}")

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


def make_synthetic(n, **kwargs) -> pd.DataFrame:
    """Generate n rows with given feature distributions."""
    rows = []
    for _ in range(n):
        row = {
            'user_id': 'synthetic',
            'email': 'synthetic@test.com',
            'role': 'developer',
            'timezone': 'UTC',
            'window_days': 30,
        }
        for feat in BURNOUT_FEATURES:
            lo, hi = kwargs.get(feat, (0.0, 0.1))
            row[feat] = float(rng.uniform(lo, hi))
        # burnout_label: string label injected directly
        row['burnout_label'] = kwargs.get('_label', 'low')
        rows.append(row)
    return pd.DataFrame(rows)


scenarios = [
    # HIGH burnout scenarios
    dict(n=40, _label='high',
         worklogs_count_window=(20, 60),
         avg_weekly_logged_hours=(45, 70),
         capacity_hours_per_week=(40, 45),
         over_capacity_ratio=(1.2, 2.0),
         after_hours_worklog_ratio=(0.3, 0.8),
         blocked_task_ratio=(0.3, 0.8),
         reopen_events_window=(3, 10),
         active_projects_window=(3, 6),
         status_transitions_window=(20, 80),
         avg_task_cycle_hours_window=(48, 120),
         days_since_last_activity=(0, 2)),

    # HIGH - night owl overworker
    dict(n=25, _label='high',
         worklogs_count_window=(15, 40),
         avg_weekly_logged_hours=(50, 80),
         capacity_hours_per_week=(40, 45),
         over_capacity_ratio=(1.5, 2.5),
         after_hours_worklog_ratio=(0.5, 1.0),
         blocked_task_ratio=(0.0, 0.3),
         reopen_events_window=(1, 5),
         active_projects_window=(2, 5),
         status_transitions_window=(10, 40),
         avg_task_cycle_hours_window=(30, 100),
         days_since_last_activity=(0, 1)),

    # MEDIUM burnout scenarios
    dict(n=50, _label='medium',
         worklogs_count_window=(8, 20),
         avg_weekly_logged_hours=(35, 48),
         capacity_hours_per_week=(40, 45),
         over_capacity_ratio=(0.8, 1.2),
         after_hours_worklog_ratio=(0.1, 0.3),
         blocked_task_ratio=(0.1, 0.4),
         reopen_events_window=(1, 4),
         active_projects_window=(2, 4),
         status_transitions_window=(5, 25),
         avg_task_cycle_hours_window=(15, 60),
         days_since_last_activity=(0, 7)),

    # LOW burnout scenarios
    dict(n=50, _label='low',
         worklogs_count_window=(2, 12),
         avg_weekly_logged_hours=(10, 35),
         capacity_hours_per_week=(40, 45),
         over_capacity_ratio=(0.0, 0.8),
         after_hours_worklog_ratio=(0.0, 0.1),
         blocked_task_ratio=(0.0, 0.15),
         reopen_events_window=(0, 2),
         active_projects_window=(1, 3),
         status_transitions_window=(0, 10),
         avg_task_cycle_hours_window=(5, 30),
         days_since_last_activity=(2, 15)),

    # LOW - fully idle
    dict(n=20, _label='low',
         worklogs_count_window=(0, 3),
         avg_weekly_logged_hours=(0, 5),
         capacity_hours_per_week=(40, 45),
         over_capacity_ratio=(0.0, 0.15),
         after_hours_worklog_ratio=(0.0, 0.02),
         blocked_task_ratio=(0.0, 0.05),
         reopen_events_window=(0, 1),
         active_projects_window=(0, 2),
         status_transitions_window=(0, 3),
         avg_task_cycle_hours_window=(0, 5),
         days_since_last_activity=(10, 30)),
]

synthetic_dfs = []
for sc in scenarios:
    n = sc.pop('n')
    label = sc.pop('_label')
    df = make_synthetic(n, _label=label, **{k: v for k, v in sc.items()})
    synthetic_dfs.append(df)

synthetic_df = pd.concat(synthetic_dfs, ignore_index=True)
print(f"Synthetic rows: {len(synthetic_df)}")
print(f"Synthetic label distribution:\n{synthetic_df['burnout_label'].value_counts()}")

# Merge real + synthetic
# Keep real rows as-is; append synthetic
cols_needed = ['user_id', 'email', 'role', 'timezone', 'window_days'] + BURNOUT_FEATURES + ['burnout_label']

# Ensure real_df has all needed columns
for c in cols_needed:
    if c not in real_df.columns:
        real_df[c] = 0.0

combined = pd.concat([real_df[cols_needed], synthetic_df[cols_needed]], ignore_index=True)
print(f"\nCombined total rows: {len(combined)}")
print(f"Label distribution:\n{combined['burnout_label'].value_counts()}")

out_path = export_dir / 'burnout_features_augmented.csv'
combined.to_csv(out_path, index=False)
print(f"\nSaved to: {out_path}")
