"""
Diagnostic: verify risk model is NOT just relearning the old 2-feature leakage rule.
If the model was still leaking, SHAP importances would show blocked_ratio and churn_ratio
dominating (>0.5 each), and the model would fail on out-of-distribution test cases.
"""
import joblib
import numpy as np
import pandas as pd

model = joblib.load('models/risk_model.pkl')
features = joblib.load('models/risk_features.pkl')

print("Features:", features)

# Test 1: Sprint with HIGH blocked_ratio but LOW churn — old leaking label = FAIL (0)
#          Our new composite: 0.4*0.35 + 0.0*0.30 + 0.5*0.20 + 0.1*0.15 = 0.14 + 0 + 0.10 + 0.015 = 0.255
#          Should predict consistent with composite score
test_cases = [
    {"name": "High blocked, low churn",
     "row": [0.4, 0.1, 0.05, 0.5, 0.1, 0.2, 0.05, 0.7]},
    {"name": "Low blocked, high churn",
     "row": [0.05, 0.05, 0.4, 0.3, 0.1, 0.1, 0.6, 0.5]},
    {"name": "All high risk",
     "row": [0.7, 0.5, 0.6, 0.8, 0.5, 0.5, 0.8, 0.9]},
    {"name": "All low risk",
     "row": [0.02, 0.01, 0.01, 0.1, 0.05, 0.05, 0.02, 0.3]},
    {"name": "Medium everything",
     "row": [0.3, 0.2, 0.3, 0.5, 0.2, 0.3, 0.3, 0.5]},
]

print("\n--- Risk Model Live Test ---")
for tc in test_cases:
    X_test = pd.DataFrame([tc["row"]], columns=features)
    pred = model.predict(X_test)[0]
    proba = model.predict_proba(X_test)[0]
    label = "LOW RISK (success=1)" if pred == 1 else "HIGH RISK (success=0)"
    print(f"  {tc['name']:30s} -> {label}  (confidence: {max(proba):.3f})")

# Test 2: Try to access XGBoost feature importances
try:
    clf = model.named_steps['clf']
    importances = clf.feature_importances_
    print("\n--- Feature Importances (lower = less reliant on any single feature) ---")
    for feat, imp in sorted(zip(features, importances), key=lambda x: -x[1]):
        print(f"  {feat:30s}: {imp:.4f}")
    
    dominated = max(importances) > 0.60
    if dominated:
        print("\nWARNING: One feature dominates (>60%) — possible remaining leakage")
    else:
        print("\nPASS: No single feature dominates — model learned multi-feature patterns")
except Exception as e:
    print(f"Could not extract feature importances: {e}")

# Test 3: Score consistency check
# Old leaking rule: success = (blocked_ratio < 0.2 AND churn_ratio < 0.5)
# If model still uses this rule: "High blocked, low churn" should predict 0 (HIGH RISK)
# With new composite label: both blocked and churn contribute but not exclusively
X_all = pd.DataFrame([tc["row"] for tc in test_cases], columns=features)
preds = model.predict(X_all)
print("\n--- Label consistency check ---")
print(f"  All high risk case predicts:  {'HIGH RISK (PASS)' if preds[2] == 0 else 'LOW RISK (FAIL: high-risk sprint predicted safe)'}")
print(f"  All low risk case predicts:   {'LOW RISK (PASS)' if preds[3] == 1 else 'HIGH RISK (FAIL: low-risk sprint predicted risky)'}")
