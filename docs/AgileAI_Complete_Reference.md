# AgileAI — Complete Reference Guide
> For presentation use. Covers AI models, chart calculations, tech stack, and website flow.

---

## SECTION 1 — AI Architecture (All Models)

---

### Dataset Used

**Morakotch JIRA Academic Dataset (IEEE TSE 2017 / 2018)**

Real-world JIRA tickets from 5 major open-source projects:

| Project | Type |
|---|---|
| Apache | Open-source framework |
| JBoss | Java application server |
| JIRA | Issue tracker itself |
| MongoDB | NoSQL database |
| Spring | Java framework |

- **For Risk Model:** `IEEE TSE2017/` — sprint-level issue data with priorities, blockers, links, types
- **For Effort Model:** `IEEE TSE2018/` — task-level issue data with actual story points assigned

---

### Model 1: Sprint Risk Classifier

**Purpose:** Predict how risky a sprint is — will it likely succeed or fail?

**Algorithm:** `XGBClassifier` (XGBoost Classification)

**Class imbalance fix:** `SMOTE` (Synthetic Minority Over-sampling Technique)
> Sprints rarely fail in clean data — SMOTE creates synthetic "fail" samples so the model doesn't just always predict "success"

**Hyperparameter tuning:** `Optuna` (Bayesian optimization — 100 trials)
> Instead of randomly guessing settings like max_depth=5, Optuna intelligently searches for the best combination using past trial results

**Training metric:** Macro F1-Score (penalizes wrong predictions on both classes equally)

**Cross-validation:** 5-fold Stratified KFold
> Data split 5 times — each fold trains on 80% and tests on 20%, class ratio stays balanced

**Pipeline:** `[Impute missing → SMOTE → StandardScaler → XGBoost]`

**Features used (10 total):**

| Feature | What it Means |
|---|---|
| `blocked_ratio` | % of tasks blocked by another task |
| `blocking_ratio` | % of tasks blocking others |
| `scope_creep_rate` | % of tasks added AFTER sprint started |
| `high_priority_ratio` | % of tasks marked Critical/Major/Blocker |
| `avg_dependency_links` | Average number of issue links per task (normalized) |
| `bug_ratio` | % of tasks that are bug-type |
| `churn_ratio` | How many priority + description changes happened (volatility) |
| `sprint_size_normalized` | Sprint size capped at 30, normalized to 0–1 |
| `avg_team_burnout_score` | Average burnout score of all assignees in sprint |
| `max_dev_burnout_score` | Highest burnout score of any one developer |

**Label (Target) creation:**
> Composite risk score = `blocked_ratio × 0.35 + scope_creep × 0.30 + high_priority × 0.20 + churn × 0.15`
> Sprints below 40th percentile → `success=1`, above → `success=0`

**Output → Risk Score (0–100):**
```
risk_score = (1 - success_probability) × 100
```
- < 34 → Low Risk
- 34–67 → Medium Risk
- > 67 → High Risk

---

### Model 2: Task Effort Estimator (Story Points)

**Purpose:** When a PM creates a task, automatically predict how many story points it should take

**Algorithm:** `XGBRegressor` (XGBoost Regression)

**Hyperparameter tuning:** `Optuna` (100 trials, minimizing MAE)

**Training metric:** MAE — Mean Absolute Error
> e.g. "on average, my prediction is off by 1.2 story points"

**Cross-validation:** 5-fold KFold

**Pipeline:** `[Impute missing → StandardScaler → XGBoost]`

**Features used (4 total):**

| Feature | What it Means |
|---|---|
| `type_encoded` | Bug=0, Story=1, Task=2, Feature=3 |
| `priority_encoded` | Low=0, Medium=1, High=2, Critical=3 |
| `desc_bucket` | Empty=0, Short(≤100 chars)=1, Medium(≤500)=2, Long=3 |
| `title_length_norm` | Title character count divided by 100, capped at 1.0 |

**Output:**
- Predicted Story Points (e.g., `3.7 SP`)
- Also calculates `aiEstimatedHours` = predicted SP × median(actual hours/SP) from project history

---

### Model 3: Developer Burnout Risk Classifier

**Purpose:** Predict whether a developer is at risk of burnout based on recent work activity

**Algorithm:** `XGBClassifier`

**Training data:** Exported from MongoDB — real user activity telemetry (worklogs, task statuses, timestamps)

**Label generation (no pre-labelled burnout data exists, so this heuristic is used):**
```
fatigue_score =
    0.34 × over_capacity_ratio
  + 0.18 × after_hours_worklog_ratio
  + 0.14 × blocked_task_ratio
  + 0.10 × reopen_events
  + 0.10 × status_transitions
  + 0.08 × avg_cycle_hours
  + 0.06 × inactivity_days
```
> Bottom 45% → `low (0)`, middle 30% → `medium (1)`, top 25% → `high (2)`

**Features used (11 total):**

| Feature | What it Means |
|---|---|
| `worklogs_count_window` | Number of time logs in last 30 days |
| `avg_weekly_logged_hours` | Average hours logged per week |
| `capacity_hours_per_week` | Developer's stated weekly capacity |
| `over_capacity_ratio` | logged ÷ capacity (>1 means overloaded) |
| `after_hours_worklog_ratio` | % of worklogs outside their work hours |
| `blocked_task_ratio` | % of their tasks that are blocked |
| `reopen_events_window` | How many tasks were reopened (quality churn) |
| `active_projects_window` | How many different projects they're working on |
| `status_transitions_window` | How often they moved tasks between statuses |
| `avg_task_cycle_hours_window` | Average time to complete a task (start→done) |
| `days_since_last_activity` | Days since their last recorded action |

**Output:**
- `burnoutRiskScore`: 0–100 weighted score
- `burnoutRiskLevel`: low / medium / high
- Formula: `score = P(medium) × 0.6 + P(high) × 1.0` → multiply by 100

---

### SHAP / Explainability (Risk Factors)

Instead of raw SHAP, the system uses a **counterfactual approach** — same result, simpler to implement inside a pipeline:

**How it works:**
1. Take current sprint's actual features (e.g., `blocked_ratio = 0.4`)
2. For EACH feature, replace it with the **median value** from training data
3. Measure how much the risk score **changes**
4. A big change = that feature is the main driver of risk

**Example:**
```json
{ "factor": "blocked_ratio", "impact": 22.5, "direction": "negative" }
```
> "If blocked_ratio was at median instead of 0.4, risk score drops 22.5 points — blocked tasks are the biggest risk driver"

Returns **Top 5 risk factors** per sprint.

---

## SECTION 2 — Chart Calculations (Detailed)

---

### Chart: Member Effort + Burnout Snapshot

#### "Completed Work (Pts)" — How it's calculated

**No AI. Pure math from MongoDB.**

For each developer:
1. Find all tasks with `status = "done"` in the project/sprint
2. Calculate their **proportional share** of each task using this priority:

| Priority | Rule |
|---|---|
| 1st — Worklogs | `developer_hours ÷ total_task_hours × story_points` |
| 2nd — Subtasks | Use that subtask's own story points |
| 3rd — Multiple assignees | Use `contributionPercent`, or split equally |
| 4th — Sole assignee | 100% of story points |

**Story Points source:**
- First: manual story points (if set by PM)
- Fallback: AI estimated story points (`aiEstimatedStoryPoints`)

**Completed Pts = sum of proportional story points across all Done tasks**

---

#### "Open Work (Pts)" — How it's calculated

Same logic as above but for tasks **not yet Done** (To Do / In Progress / Blocked).

---

#### "Burnout Risk (%)" — How it's calculated

**Two-layer system:**

**Layer 1 — Real-Time Formula (always runs):**

| Component | What it measures | Weight |
|---|---|---|
| `weightedActiveLoad × 30` | How many tasks active, weighted by ownership | 35% |
| `weeklyLoggedHours × 2.5` | Hours logged in last 2 weeks | part of load |
| `blockedRatio × 70` | % active tasks that are blocked | 35% |
| `overdueRatio × 70` | % active tasks past due date | 30% |

> If `capacityHoursPerWeek` is set on the user, formula switches to capacity-aware mode: `logged ÷ capacity × 100 × 0.45`

**Layer 2 — AI Model Score (if Python service is running):**

**Final score priority:**

| Priority | Condition | Score Used |
|---|---|---|
| 1st | AI ran recently + global context available | `AI × 0.6 + Global Formula × 0.4` |
| 2nd | AI ran recently, no context | AI score only |
| 3rd | AI score is stale | Real-time formula |
| 4th | AI never ran | Real-time formula only |

---

### Chart: Velocity Trends

**No AI. Pure math from MongoDB.**

| Data Point | Source |
|---|---|
| `Planned` | `sprint.committedPoints` (locked at sprint start). Falls back to sum of all task SPs |
| `Delivered` | Sum of story points of tasks with `status = "done"` in that sprint |

**Avg Velocity = `sum of delivered points across completed sprints ÷ number of sprints`**

For the active sprint — same calculation shown live, updates as developers complete tasks.

---

### Chart: Risk Score by Sprint

**Uses XGBoost Classifier (Model 1).**

Live: Calls Python FastAPI `/predict-risk` with the sprint's 10 computed features → returns 0–100 score.

On dashboard: Synthetic dummy data mapped to real sprint names (for presentation, since ML needs long-term telemetry to build meaningful history).

---

### Chart: Rule-Based Delivery Outcome

**No AI. Deterministic rule:**

```
Pass = Delivered Points ÷ Planned Points ≥ 80%
Fail = Delivered Points ÷ Planned Points < 80%
```

When a sprint is selected → shows only that sprint's result.
Pass/Fail summary updates dynamically.

---

## SECTION 3 — AI vs. Math Quick Reference

| Feature / Chart | What's Used | Based On |
|---|---|---|
| Completed Work (Pts) | ❌ No AI — Pure math | MongoDB task data + story points |
| Open Work (Pts) | ❌ No AI — Pure math | MongoDB task data + story points |
| Burnout Risk % | ✅ XGBoost (if fresh) or Formula fallback | User worklogs + task states |
| Risk Score by Sprint | ✅ XGBoost Classifier | 10 sprint-level features from task metadata |
| Rule-Based Delivery Outcome | ❌ No AI — Deterministic Rule | Delivered ÷ Planned ≥ 80% → Pass |
| Velocity Trends | ❌ No AI — Pure math | Done tasks' story points vs. committed points |
| Story Point Estimation | ✅ XGBoost Regressor | Task title, description, type, priority |
| Risk Explainability (factors) | Counterfactual (SHAP-style) | Swap each feature to median → measure impact |

---

## SECTION 4 — Tech Stack

### Frontend
| Tech | Why |
|---|---|
| React.js | Builds the entire dashboard UI |
| Recharts | Draws all charts and graphs |
| Tailwind CSS | Styling and layout |
| Socket.io (client) | Real-time updates (Kanban syncs live) |

### Backend
| Tech | Why |
|---|---|
| Node.js + Express.js | Main application server, handles all API requests |
| MongoDB | Database — stores projects, tasks, sprints, users, logs |
| Mongoose | Connects Node.js to MongoDB |
| Socket.io (server) | Sends live updates to the browser |
| JWT | Login authentication |

### AI Service
| Tech | Why |
|---|---|
| Python | Language for all ML code |
| FastAPI | Lightweight Python API that Node.js calls |
| XGBoost | The actual ML models (risk, effort, burnout) |
| Optuna | Auto-finds best model hyperparameters |
| SMOTE | Fixes class imbalance in training data |
| Scikit-learn | Preprocessing, pipelines, cross-validation |
| Pandas / NumPy | Data loading and number crunching |
| Joblib | Saves and loads trained models |

### How They Connect
```
Browser (React)
     ↕ API calls
Node.js/Express Server
     ↕ Database queries        ↕ AI prediction requests
MongoDB                   Python FastAPI (AI Service)
                               ↕ Loads trained models
                          XGBoost .pkl files
```

---

## SECTION 5 — Complete Website Flow

### Login
```
User opens site → Enter email + password
       ↓
Node.js checks credentials in MongoDB
       ↓
Returns JWT token (saved in browser)
       ↓
Role checked: Admin / Project Manager / Developer
       ↓
Redirected to their specific dashboard
```

---

### Role 1: ADMIN
```
Admin Dashboard
│
├── See ALL projects across the system
├── Create/manage users (assign roles)
├── Global Analytics
│    ├── See all PMs and their project performance
│    ├── Org-level velocity & completion rate
│    └── Project health status (On Track / At Risk / Critical)
└── Drill into any PM's project for detailed analytics
```

---

### Role 2: PROJECT MANAGER
```
PM Dashboard
│
├── MY PROJECTS
│    ├── Create new project
│    ├── Add team members (developers)
│    └── View project overview
│
├── SPRINT MANAGEMENT
│    ├── Create a sprint (set start/end dates)
│    ├── Add tasks to sprint
│    ├── Start sprint → locks committed points
│    ├── Monitor sprint progress live
│    └── Complete sprint → logs velocity data
│
├── TASK MANAGEMENT
│    ├── Create tasks (title, description, type, priority)
│    │    └── AI auto-estimates story points instantly
│    ├── Assign to developer(s)
│    ├── Set due dates, story points
│    └── Move tasks on Kanban board
│
├── KANBAN BOARD
│    ├── Columns: To Do → In Progress → Done
│    ├── Drag and drop tasks between columns
│    ├── PM can move any task (full access)
│    └── Live sync via Socket.io
│
└── ANALYTICS (for their project)
     ├── Risk Score by Sprint → XGBoost prediction
     ├── Rule-Based Delivery Outcome → Pass/Fail
     ├── Velocity Trends → Planned vs Delivered
     └── Member Effort + Burnout → Per developer
```

---

### Role 3: DEVELOPER
```
Developer Dashboard
│
├── MY TASKS (filtered to only their assigned tasks)
│
├── KANBAN BOARD (limited access)
│    ├── Can see all tasks in sprint
│    ├── Can ONLY move their own tasks
│    ├── Move to In Progress → logs "startedAt"
│    ├── Move to Done → logs "completedAt"
│    │    └── Triggers analytics recalculation
│    └── Can log work hours (worklogs) on tasks
│
└── ANALYTICS (view only)
     └── See their own effort and burnout stats
```

---

### When AI Runs

| Event | AI Action |
|---|---|
| PM creates a task | Effort model estimates story points (XGBoost Regressor, instant) |
| Sprint selected on Analytics | Risk model runs for that sprint (XGBoost Classifier → Risk Score 0–100) |
| Developer logs hours or moves task | Burnout model refreshes for that user |
| Analytics page loads | All 3 models run if AI service is up. Falls back to formula if down |

---

### Real-Time Flow (Socket.io)
```
Developer drags task to Done
        ↓
Browser sends update to Node.js
        ↓
MongoDB updates status + logs completedAt
        ↓
Socket.io broadcasts to ALL connected users
        ↓
PM's Kanban updates live (no refresh needed)
        ↓
Analytics recalculates Completed Points
```

---

### Analytics Page Full Flow
```
PM opens Analytics → selects project
        ↓
Node.js fetches: sprints, tasks, team members from MongoDB
        ↓
analyticsService.js calculates:
  • Completed story points per member
  • Open work per member
  • Burnout formula score (real-time)
        ↓
Simultaneously calls Python FastAPI:
  • /predict-risk    → Risk score for selected sprint
  • /predict-burnout → AI burnout per developer
        ↓
All data sent back to React → Recharts renders charts
```

---

### One-Line Summary

> **React frontend, Node.js + Express backend, MongoDB database, and a separate Python FastAPI AI service running 3 XGBoost models — all connected together. AI is used for sprint risk prediction, task effort estimation, and developer burnout detection. Everything else is transparent math from the database.**

---

### Key Points for Faculty Questions

- **Why dummy data on 3 charts?** XGBoost models need long-term historical sprint telemetry to produce meaningful trends. Since the system is newly deployed, we synthesize realistic dummy data mapped to actual sprint names. Real data will populate these charts as the project runs over time.
- **Why XGBoost?** It handles small datasets well, is interpretable, and outperforms linear models on tabular Agile data.
- **Why Optuna?** Manual hyperparameter tuning is inefficient. Optuna uses Bayesian optimization to find the best model configuration in 100 trials.
- **Why SMOTE?** Sprint failures are rare in clean data. Without SMOTE, the model would always predict "success" and achieve 90%+ accuracy by doing nothing useful.
