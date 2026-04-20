import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pymongo import MongoClient


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _desc_bucket(desc: str) -> float:
    length = len(desc or "")
    if length == 0:
        return 0.0
    if length <= 100:
        return 1.0
    if length <= 500:
        return 2.0
    return 3.0


def _title_length_norm(title: str) -> float:
    return float(np.clip((len(title or "") / 100.0), 0.0, 1.0))


def _priority_is_high(priority: str) -> bool:
    # Grounded to this repo's enum: low/medium/high/critical
    return (priority or "").lower() in {"high", "critical"}


class PredictRiskRequest(BaseModel):
    sprintId: str = Field(..., min_length=1)


class EstimateEffortRequest(BaseModel):
    taskId: str = Field(..., min_length=1)


class InsightsRequest(BaseModel):
    sprintId: str = Field(..., min_length=1)


class PredictBurnoutRequest(BaseModel):
    userId: str = Field(..., min_length=1)


API_PORT = int(os.getenv("API_PORT", "8001"))
MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is required")

MODELS_DIR = os.getenv("MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))

RISK_MODEL_PATH = os.path.join(MODELS_DIR, "risk_model.pkl")
RISK_FEATURES_PATH = os.path.join(MODELS_DIR, "risk_features.pkl")
EFFORT_MODEL_PATH = os.path.join(MODELS_DIR, "effort_model.pkl")
EFFORT_FEATURES_PATH = os.path.join(MODELS_DIR, "effort_features.pkl")
BURNOUT_MODEL_PATH = os.path.join(MODELS_DIR, "burnout_model.pkl")
BURNOUT_FEATURES_PATH = os.path.join(MODELS_DIR, "burnout_features.pkl")
BURNOUT_METADATA_PATH = os.path.join(MODELS_DIR, "burnout_metadata.json")

risk_model = joblib.load(RISK_MODEL_PATH)
risk_features: List[str] = joblib.load(RISK_FEATURES_PATH)

effort_model = joblib.load(EFFORT_MODEL_PATH)
effort_features: List[str] = joblib.load(EFFORT_FEATURES_PATH)

risk_model_version = _sha256_file(RISK_MODEL_PATH)
effort_model_version = _sha256_file(EFFORT_MODEL_PATH)

burnout_model = None
burnout_features: List[str] = []
burnout_metadata: Dict[str, Any] = {}
burnout_model_version: Optional[str] = None

if os.path.exists(BURNOUT_MODEL_PATH) and os.path.exists(BURNOUT_FEATURES_PATH):
    burnout_model = joblib.load(BURNOUT_MODEL_PATH)
    burnout_features = joblib.load(BURNOUT_FEATURES_PATH)
    burnout_model_version = _sha256_file(BURNOUT_MODEL_PATH)

    if os.path.exists(BURNOUT_METADATA_PATH):
        with open(BURNOUT_METADATA_PATH, "r", encoding="utf-8") as f:
            burnout_metadata = json.load(f)

mongo = MongoClient(MONGODB_URI)
db = mongo.get_default_database()

sprints = db["sprints"]
tasks = db["tasks"]
users = db["users"]

app = FastAPI(title="AgileAI Inference Service", version="1.0.0")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "time": _utc_now_iso(),
        "models": {
            "risk": {"loaded": True, "version": risk_model_version[:12]},
            "effort": {"loaded": True, "version": effort_model_version[:12]},
            "burnout": {
                "loaded": burnout_model is not None,
                "version": burnout_model_version[:12] if burnout_model_version else None,
            },
        },
    }


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ObjectId")


def _fetch_task(task_id: str) -> Dict[str, Any]:
    doc = tasks.find_one({"_id": _oid(task_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return doc


def _fetch_sprint(sprint_id: str) -> Dict[str, Any]:
    doc = sprints.find_one({"_id": _oid(sprint_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return doc


def _fetch_user(user_id: str) -> Dict[str, Any]:
    doc = users.find_one({"_id": _oid(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return doc


def _as_utc_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_local_time_to_minutes(hhmm: Optional[str]) -> Optional[int]:
    if not hhmm or not isinstance(hhmm, str):
        return None

    parts = hhmm.split(":")
    if len(parts) != 2:
        return None

    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except Exception:
        return None

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return (hour * 60) + minute


def _hours_between_dates(from_date: Any, to_date: Any) -> Optional[float]:
    a = _as_utc_datetime(from_date)
    b = _as_utc_datetime(to_date)
    if a is None or b is None:
        return None
    delta_hours = (b - a).total_seconds() / 3600.0
    if delta_hours <= 0:
        return 0.0
    return float(delta_hours)


# Maps match train_models.py encoding (fixed — was all hardcoded to 2)
_TASK_TYPE_MAP: Dict[str, float] = {
    "bug": 0.0,
    "story": 1.0,
    "task": 2.0,
    "feature": 3.0,
    "chore": 2.0,
    "epic": 3.0,
    "improvement": 2.0,
    "sub-task": 1.0,
}
_TASK_PRIORITY_MAP: Dict[str, float] = {
    "low": 0.0,
    "medium": 1.0,
    "high": 2.0,
    "critical": 3.0,
    "blocker": 3.0,
    "major": 2.0,
    "minor": 1.0,
    "trivial": 0.0,
}


def _effort_feature_row(task_doc: Dict[str, Any]) -> pd.DataFrame:
    title = task_doc.get("title", "") or ""
    description = task_doc.get("description", "") or ""
    task_type = (task_doc.get("type") or "task").lower().strip()
    priority = (task_doc.get("priority") or "medium").lower().strip()

    row = {
        "type_encoded": _TASK_TYPE_MAP.get(task_type, 2.0),
        "priority_encoded": _TASK_PRIORITY_MAP.get(priority, 1.0),
        "desc_bucket": _desc_bucket(description),
        "title_length_norm": _title_length_norm(title),
    }

    return pd.DataFrame([[row.get(col, 0.0) for col in effort_features]], columns=effort_features)


def _compute_hours_per_point(project_id: ObjectId, max_docs: int = 500) -> Dict[str, Any]:
    cursor = (
        tasks.find(
            {
                "project": project_id,
                "storyPoints": {"$gt": 0},
                "actualHours": {"$gt": 0},
            },
            {"storyPoints": 1, "actualHours": 1, "completedAt": 1},
        )
        .sort("completedAt", -1)
        .limit(max_docs)
    )

    ratios: List[float] = []
    for doc in cursor:
        sp = doc.get("storyPoints")
        ah = doc.get("actualHours")
        if not sp or not ah:
            continue
        try:
            ratio = float(ah) / float(sp)
        except Exception:
            continue
        if np.isfinite(ratio) and ratio > 0:
            ratios.append(ratio)

    if len(ratios) < 10:
        if len(ratios) >= 3:
            # Use limited project history as rough estimate
            return {
                "hoursPerPoint": float(np.median(np.array(ratios, dtype=float))),
                "sampleCount": len(ratios),
                "reason": "limited_project_history",
            }
        # Fall back to industry-standard 4h per story point
        return {
            "hoursPerPoint": 4.0,
            "sampleCount": len(ratios),
            "reason": "industry_default_4h_per_point",
        }

    return {
        "hoursPerPoint": float(np.median(np.array(ratios, dtype=float))),
        "sampleCount": len(ratios),
        "reason": "median_actualHours_per_storyPoint",
    }


def _risk_feature_row(sprint_doc: Dict[str, Any], sprint_tasks: List[Dict[str, Any]]) -> pd.DataFrame:
    total = len(sprint_tasks)
    if total <= 0:
        # match train_models defaulting behavior: empty sprints shouldn't be predicted
        raise HTTPException(status_code=400, detail="Sprint has no tasks")

    blocked_count = 0
    bug_count = 0
    high_priority_count = 0
    total_blocked_by_links = 0

    # reverse dependency: tasks that are referenced by others' blockedBy
    blockers: set = set()

    total_churn = 0
    started_at = sprint_doc.get("startedAt")

    scope_creep_count = 0

    for t in sprint_tasks:
        blocked_by = t.get("blockedBy") or []
        total_blocked_by_links += len(blocked_by)

        if len(blocked_by) > 0:
            blocked_count += 1

        for b in blocked_by:
            blockers.add(str(b))

        if (t.get("type") or "").lower() == "bug":
            bug_count += 1

        if _priority_is_high(t.get("priority")):
            high_priority_count += 1

        cc = t.get("changeCounters") or {}
        total_churn += int(cc.get("priorityChanges") or 0)
        total_churn += int(cc.get("descriptionChanges") or 0)

        added_to_sprint_at = t.get("addedToSprintAt")
        if started_at and added_to_sprint_at and added_to_sprint_at > started_at:
            scope_creep_count += 1

    blocked_ratio = blocked_count / total
    blocking_ratio = len(blockers) / total
    scope_creep_rate = scope_creep_count / total
    high_priority_ratio = high_priority_count / total

    avg_dependency_links = (total_blocked_by_links / total) / 10.0
    bug_ratio = bug_count / total

    churn_ratio = total_churn / (total * 5)

    sprint_size_normalized = min(total, 30) / 30

    assignee_ids = set()
    for t in sprint_tasks:
        assignee = t.get("assignee")
        if assignee:
            assignee_ids.add(_oid(str(assignee)) if isinstance(assignee, str) else assignee)

    avg_team_burnout_score = 0.0
    max_dev_burnout_score = 0.0
    
    if assignee_ids:
        user_list = list(users.find({"_id": {"$in": list(assignee_ids)}}))
        burnouts = []
        for u in user_list:
            b = u.get("aiBurnoutRiskScore")
            if b is not None:
                burnouts.append(float(b))
                
        if burnouts:
            avg_team_burnout_score = sum(burnouts) / len(burnouts)
            max_dev_burnout_score = max(burnouts)

    row = {
        "blocked_ratio": float(blocked_ratio),
        "blocking_ratio": float(blocking_ratio),
        "scope_creep_rate": float(scope_creep_rate),
        "high_priority_ratio": float(high_priority_ratio),
        "avg_dependency_links": float(avg_dependency_links),
        "bug_ratio": float(bug_ratio),
        "churn_ratio": float(churn_ratio),
        "sprint_size_normalized": float(sprint_size_normalized),
        "avg_team_burnout_score": float(avg_team_burnout_score),
        "max_dev_burnout_score": float(max_dev_burnout_score),
    }

    return pd.DataFrame([[row.get(col, 0.0) for col in risk_features]], columns=risk_features)


def _risk_score_from_success_proba(success_proba: float) -> float:
    # train_models.py: success=1 is "low risk"; success=0 is "high risk"
    risk_proba = 1.0 - float(success_proba)
    return float(np.clip(risk_proba * 100.0, 0.0, 100.0))


def _risk_level(score_0_100: float) -> str:
    if score_0_100 < 34.0:
        return "low"
    if score_0_100 < 67.0:
        return "medium"
    return "high"


def _risk_medians_from_pipeline() -> Optional[Dict[str, float]]:
    try:
        prep = risk_model.named_steps["prep"]
        imputer = prep.named_transformers_["num"]
        stats = list(imputer.statistics_)
        return {risk_features[i]: float(stats[i]) for i in range(len(risk_features))}
    except Exception:
        return None


def _risk_factors_counterfactual(X: pd.DataFrame) -> List[Dict[str, Any]]:
    medians = _risk_medians_from_pipeline()
    if not medians:
        return []

    success_proba = float(risk_model.predict_proba(X)[0][1])
    base_score = _risk_score_from_success_proba(success_proba)

    factors: List[Dict[str, Any]] = []
    for feat in risk_features:
        X_cf = X.copy()
        X_cf.loc[X_cf.index[0], feat] = medians.get(feat, X_cf.loc[X_cf.index[0], feat])
        cf_success = float(risk_model.predict_proba(X_cf)[0][1])
        cf_score = _risk_score_from_success_proba(cf_success)

        delta = base_score - cf_score
        direction = "negative" if delta > 0 else "positive"

        factors.append(
            {
                "factor": feat,
                "impact": float(abs(delta)),
                "direction": direction,
            }
        )

    factors.sort(key=lambda f: f["impact"], reverse=True)
    return factors[:5]


def _burnout_window_days() -> int:
    raw = burnout_metadata.get("windowDays", 30)
    try:
        value = int(raw)
    except Exception:
        return 30
    return max(1, min(value, 180))


def _burnout_class_index_to_level_map(prob_size: int) -> Dict[int, str]:
    from_meta = burnout_metadata.get("classIndexToLevel", {})
    mapping: Dict[int, str] = {}
    if isinstance(from_meta, dict):
        for key, value in from_meta.items():
            try:
                idx = int(key)
                mapping[idx] = str(value)
            except Exception:
                continue

    if mapping:
        return mapping

    if prob_size == 2:
        return {0: "low", 1: "high"}
    if prob_size == 3:
        return {0: "low", 1: "medium", 2: "high"}
    return {idx: "medium" for idx in range(prob_size)}


def _burnout_feature_row(user_doc: Dict[str, Any], user_tasks: List[Dict[str, Any]]) -> pd.DataFrame:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=_burnout_window_days())
    user_id_str = str(user_doc.get("_id"))

    recent_tasks: List[Dict[str, Any]] = []
    for task in user_tasks:
        updated = _as_utc_datetime(task.get("updatedAt"))
        if updated is not None and updated >= window_start:
            recent_tasks.append(task)

    worklogs: List[Dict[str, Any]] = []
    for task in user_tasks:
        for wl in task.get("worklogs") or []:
            worklog_user = wl.get("user")
            if worklog_user is not None and str(worklog_user) != user_id_str:
                continue

            date_val = _as_utc_datetime(wl.get("date") or wl.get("createdAt"))
            if date_val is None or date_val < window_start:
                continue
            worklogs.append(
                {
                    "date": date_val,
                    "hours": float(max(0.0, float(wl.get("hours") or 0.0))),
                }
            )

    total_logged_hours = float(sum(w["hours"] for w in worklogs))
    avg_weekly_logged_hours = total_logged_hours / (_burnout_window_days() / 7.0)
    capacity_hours_per_week = max(1.0, float(user_doc.get("capacityHoursPerWeek") or 40.0))

    # Default 09:00 (540 min) / 18:00 (1080 min) when user hasn't set their hours
    work_day_start = _parse_local_time_to_minutes(user_doc.get("workDayStartLocal")) or 540
    work_day_end = _parse_local_time_to_minutes(user_doc.get("workDayEndLocal")) or 1080

    after_hours_worklog_ratio = 0.0
    if worklogs:
        after_hours_count = 0
        for wl in worklogs:
            minutes_utc = (wl["date"].hour * 60) + wl["date"].minute
            if minutes_utc < work_day_start or minutes_utc > work_day_end:
                after_hours_count += 1
        after_hours_worklog_ratio = after_hours_count / len(worklogs)

    blocked_task_ratio = 0.0
    if recent_tasks:
        blocked_count = 0
        for task in recent_tasks:
            blocked_by = task.get("blockedBy") or []
            if task.get("isBlocked") or len(blocked_by) > 0:
                blocked_count += 1
        blocked_task_ratio = blocked_count / len(recent_tasks)

    open_recent_tasks = [
        task for task in recent_tasks if str(task.get("status") or "").lower() != "done"
    ]

    overdue_open_task_ratio = 0.0
    if open_recent_tasks:
        overdue_open_count = 0
        for task in open_recent_tasks:
            due_date = _as_utc_datetime(task.get("dueDate"))
            if due_date is not None and due_date < now:
                overdue_open_count += 1
        overdue_open_task_ratio = overdue_open_count / len(open_recent_tasks)

    reopen_events_window = 0
    for task in user_tasks:
        reopened = _as_utc_datetime(task.get("reopenedAt"))
        if reopened is not None and reopened >= window_start:
            reopen_events_window += 1

    active_projects_window = len({str(task.get("project")) for task in recent_tasks if task.get("project")})

    status_transitions_window = 0
    for task in recent_tasks:
        for change in task.get("statusHistory") or []:
            changed_by = change.get("changedBy")
            # FIX: skip if changedBy is null/missing OR if it's a different user
            # Previously: null changedBy leaked to ALL co-assignees on shared tasks
            if changed_by is None or str(changed_by) != user_id_str:
                continue

            changed_at = _as_utc_datetime(change.get("changedAt"))
            if changed_at is not None and changed_at >= window_start:
                status_transitions_window += 1

    cycles = []
    for task in recent_tasks:
        cycle = _hours_between_dates(task.get("startedAt"), task.get("completedAt"))
        if cycle is not None:
            cycles.append(cycle)
    avg_task_cycle_hours_window = float(np.mean(cycles)) if cycles else 0.0

    most_recent_activity = None
    for task in recent_tasks:
        last_activity = _as_utc_datetime(task.get("lastActivityAt") or task.get("updatedAt"))
        if last_activity is None:
            continue
        if most_recent_activity is None or last_activity > most_recent_activity:
            most_recent_activity = last_activity

    if most_recent_activity is None:
        days_since_last_activity = 0.0
    else:
        days_since_last_activity = float((now - most_recent_activity).total_seconds() / 86400.0)

    row = {
        "worklogs_count_window": float(len(worklogs)),
        "avg_weekly_logged_hours": float(avg_weekly_logged_hours),
        "capacity_hours_per_week": float(capacity_hours_per_week),
        "over_capacity_ratio": float(avg_weekly_logged_hours / capacity_hours_per_week),
        "after_hours_worklog_ratio": float(after_hours_worklog_ratio),
        "blocked_task_ratio": float(blocked_task_ratio),
        "overdue_open_task_ratio": float(overdue_open_task_ratio),
        "reopen_events_window": float(reopen_events_window),
        "active_projects_window": float(active_projects_window),
        "status_transitions_window": float(status_transitions_window),
        "avg_task_cycle_hours_window": float(avg_task_cycle_hours_window),
        "days_since_last_activity": float(days_since_last_activity),
    }

    return pd.DataFrame([[row.get(col, 0.0) for col in burnout_features]], columns=burnout_features)


def _burnout_score_and_level(
    probabilities: np.ndarray, class_index_to_level: Dict[int, str]
) -> Dict[str, Any]:
    level_weight = {
        "low": 0.0,
        "medium": 0.6,
        "high": 1.0,
    }

    risk_score = 0.0
    probs_by_level: Dict[str, float] = {"low": 0.0, "medium": 0.0, "high": 0.0}
    for idx, p in enumerate(probabilities):
        level = class_index_to_level.get(idx, "medium")
        probs_by_level[level] = probs_by_level.get(level, 0.0) + float(p)
        risk_score += float(p) * level_weight.get(level, 0.6)

    top_idx = int(np.argmax(probabilities))
    level = class_index_to_level.get(top_idx, "medium")
    confidence = float(np.max(probabilities))

    return {
        "burnoutRiskScore": float(np.clip(risk_score * 100.0, 0.0, 100.0)),
        "burnoutRiskLevel": level,
        "burnoutConfidence": confidence,
        "probabilitiesByLevel": probs_by_level,
    }


def _overdue_open_task_ratio(user_tasks: List[Dict[str, Any]]) -> float:
    now = datetime.now(timezone.utc)
    open_tasks = [task for task in user_tasks if str(task.get("status") or "").lower() != "done"]
    if not open_tasks:
        return 0.0

    overdue_count = 0
    for task in open_tasks:
        due = _as_utc_datetime(task.get("dueDate"))
        if due is not None and due < now:
            overdue_count += 1

    return float(overdue_count / len(open_tasks))


@app.post("/estimate-effort")
def estimate_effort(req: EstimateEffortRequest) -> Dict[str, Any]:
    task_doc = _fetch_task(req.taskId)

    X = _effort_feature_row(task_doc)
    pred = float(effort_model.predict(X)[0])

    project_id = task_doc.get("project")
    hours_info = None
    if isinstance(project_id, ObjectId):
        hours_info = _compute_hours_per_point(project_id)
    else:
        hours_info = {"hoursPerPoint": None, "sampleCount": 0, "reason": "missing_project"}

    hours_estimate = None
    if hours_info.get("hoursPerPoint") is not None:
        hours_estimate = float(pred * float(hours_info["hoursPerPoint"]))

    return {
        "ok": True,
        "taskId": req.taskId,
        "predictedStoryPoints": pred,
        "aiEstimatedHours": hours_estimate,
        "hoursPerPointBaseline": hours_info.get("hoursPerPoint"),
        "hoursPerPointSampleCount": hours_info.get("sampleCount"),
        "hoursDerivationReason": hours_info.get("reason"),
        "modelVersion": effort_model_version,
        "featureVersion": "effort_v1_train_models_py",
        "computedAt": _utc_now_iso(),
    }


@app.post("/predict-risk")
def predict_risk(req: PredictRiskRequest) -> Dict[str, Any]:
    sprint_doc = _fetch_sprint(req.sprintId)

    sprint_tasks = list(tasks.find({"sprint": _oid(req.sprintId)}))

    X = _risk_feature_row(sprint_doc, sprint_tasks)
    success_proba = float(risk_model.predict_proba(X)[0][1])
    risk_score = _risk_score_from_success_proba(success_proba)

    factors = _risk_factors_counterfactual(X)

    return {
        "ok": True,
        "sprintId": req.sprintId,
        "riskScore": risk_score,
        "riskLevel": _risk_level(risk_score),
        "riskFactors": factors,
        "features": {col: float(X.iloc[0][col]) for col in X.columns},
        "modelVersion": risk_model_version,
        "featureVersion": "risk_v1_train_models_py",
        "computedAt": _utc_now_iso(),
    }


@app.post("/predict-burnout")
def predict_burnout(req: PredictBurnoutRequest) -> Dict[str, Any]:
    if burnout_model is None or not burnout_features:
        raise HTTPException(status_code=503, detail="Burnout model is not loaded")

    user_doc = _fetch_user(req.userId)
    user_oid = _oid(req.userId)
    user_tasks = list(
        tasks.find(
            {
                "$or": [
                    {"assignee": user_oid},
                    {"assignees.user": user_oid},
                    {"subtasks.assignee": user_oid},
                ]
            },
            {
                "assignee": 1,
                "assignees.user": 1,
                "subtasks.assignee": 1,
                "project": 1,
                "status": 1,
                "dueDate": 1,
                "isBlocked": 1,
                "blockedBy": 1,
                "reopenedAt": 1,
                "statusHistory": 1,
                "startedAt": 1,
                "completedAt": 1,
                "lastActivityAt": 1,
                "updatedAt": 1,
                "worklogs": 1,
            },
        )
    )

    X = _burnout_feature_row(user_doc, user_tasks)

    if hasattr(burnout_model, "predict_proba"):
        probabilities = np.array(burnout_model.predict_proba(X)[0], dtype=float)
    else:
        pred = int(burnout_model.predict(X)[0])
        probabilities = np.zeros(shape=(max(1, pred + 1),), dtype=float)
        probabilities[pred] = 1.0

    class_idx_to_level = _burnout_class_index_to_level_map(probabilities.shape[0])
    outcome = _burnout_score_and_level(probabilities, class_idx_to_level)

    overdue_ratio = _overdue_open_task_ratio(user_tasks)
    overdue_penalty = min(20.0, overdue_ratio * 30.0)
    adjusted_score = float(np.clip(outcome["burnoutRiskScore"] + overdue_penalty, 0.0, 100.0))

    adjusted_level = "low"
    if adjusted_score >= 67.0:
        adjusted_level = "high"
    elif adjusted_score >= 34.0:
        adjusted_level = "medium"

    outcome["burnoutRiskScore"] = adjusted_score
    outcome["burnoutRiskLevel"] = adjusted_level

    return {
        "ok": True,
        "userId": req.userId,
        "burnoutRiskScore": float(outcome["burnoutRiskScore"] or 0.0),
        "burnoutRiskLevel": outcome["burnoutRiskLevel"],
        "burnoutConfidence": float(outcome["burnoutConfidence"] or 0.0),
        "probabilitiesByLevel": outcome["probabilitiesByLevel"],
        "overdueOpenTaskRatio": float(overdue_ratio or 0.0),
        "overduePenaltyApplied": float(overdue_penalty or 0.0),
        "features": {col: float(X.iloc[0][col] if X.iloc[0][col] is not None else 0.0) for col in X.columns},
        "modelVersion": burnout_model_version,
        "featureVersion": burnout_metadata.get("featureVersion", "burnout_v1_mongo_export"),
        "windowDays": _burnout_window_days(),
        "computedAt": _utc_now_iso(),
    }


@app.post("/insights")
def insights(req: InsightsRequest) -> Dict[str, Any]:
    # Minimal v1: return the risk payload + a small grounded summary
    payload = predict_risk(PredictRiskRequest(sprintId=req.sprintId))

    level = payload.get("riskLevel")
    top_factors = [f.get("factor") for f in payload.get("riskFactors", [])]

    summary = {
        "riskLevel": level,
        "topDrivers": top_factors,
        "note": "v1 insights are derived from the risk model features only",
    }

    return {**payload, "summary": summary}
