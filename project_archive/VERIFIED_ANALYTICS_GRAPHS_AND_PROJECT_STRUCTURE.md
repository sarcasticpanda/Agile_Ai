# Verified Analytics Graphs + Project Structure (Apr 19, 2026)

This document is a **code-verified** inventory of what graphs actually exist in the UI, what data each graph uses, where the data is computed, and what is currently missing/unused.

## 1) Where the graphs live (single source of truth)
All rendered analytics graphs are in:
- `agileai/client/src/pages/AnalyticsPage.jsx`

Recharts is only used on that page (no other dashboard pages render charts today).

## 2) Verified graph list (what is реально implemented)

### A) Admin overview mode (organization-wide)
These charts/widgets are rendered when the viewer is an **Admin** and is on `/analytics` without a specific project route param.

1) **Organization Performance** (Bar chart)
- UI: `ResponsiveContainer + BarChart`
- UI data variable: `orgPerformance`
- API call: `GET /api/analytics/overview`
- Backend route: `agileai/server/routes/analytics.routes.js` → `getOverview`
- Backend controller: `agileai/server/controllers/analyticsController.js` → `getOverview`
- Backend service: `agileai/server/services/analyticsService.js` → `calculateOverview(projectIds)`
- Payload shape: array rows like `{ label, sprint, planned, delivered }`
- Notes: empty when there are no completed sprints.

2) **Project Health** (progress bars, not Recharts)
- UI data variable: `projectHealth`
- API call: `GET /api/analytics/overview`
- Backend service path: `calculateOverview()`
- Payload shape: rows like `{ projectId, title, color, status, percent }`

3) **PM Analytics Scopes** (Admin-only cards)
- API call: `GET /api/analytics/overview/pms`
- Backend controller: `getOverviewPms`
- Purpose: allows Admin to “scope view” to a PM’s accessible projects.

### B) Project drill-down mode (PM + Admin scoped to a project)

4) **Risk Score by Sprint** (Line chart)
- UI: `ResponsiveContainer + LineChart`
- UI data variable: `sprintRiskData`
- Data sources:
  - `GET /api/sprints?projectId=...` (sprints list)
  - `GET /api/analytics/team/:projectId` (team burnout context)
- What is computed where:
  - **AI part**: `Sprint.aiRiskScore` is persisted on sprint documents (comes from AI refresh workflow).
  - **Pressure part (backend)**: team stats endpoint computes burnout scores from tasks/worklogs.
  - **Composite (frontend)**: `AnalyticsPage.jsx` computes `riskScore` as:
    - `pressureRisk = 0.7 * teamOverallBurnoutAvg + 0.3 * completionPenalty`
    - if `aiRiskScore` exists: `compositeRisk = 0.75 * aiRiskScore + 0.25 * pressureRisk`
    - otherwise: `compositeRisk = pressureRisk`
- Important: there is **no backend endpoint that directly returns sprintRiskData**; this chart is a mix of backend data + frontend composition.

5) **Rule-Based Delivery Outcome** (Bar chart)
- UI data variable: `sprintOutcomeData`
- Data sources:
  - Primary: `GET /api/analytics/velocity/:projectId`
  - Fallback: sprint tasks/points from `GET /api/sprints?projectId=...` when there’s no velocity history
- What it really is: **deterministic rules**, not AI. The tooltip explicitly shows which rule path was used.

6) **Member Effort + Burnout** (Dual-axis Bar chart)
- UI data variable: `memberEffortBurnoutData`
- API call: `GET /api/analytics/team/:projectId`
- Backend service: `calculateTeamStats(projectId, { sprintId? })`
- What is computed:
  - Effort credit: computed from tasks in project/sprint and assignment/worklog logic.
  - Burnout scores:
    - `projectBurnoutScore`, `globalBurnoutScore`, `overallBurnoutScore` computed in backend.
  - AI burnout prediction cache:
    - `User.aiBurnoutRiskScore` / history comes from AI refresh service.

7) **Sprint Burndown** (Line chart)
- API call: `GET /api/analytics/burndown/:sprintId`
- Backend service: `calculateBurndown(sprintId)`
- Payload: `{ sprintId, totalStoryPoints, data:[{date, ideal, actual}] }`

8) **Velocity Trends** (Bar chart)
- API call: `GET /api/analytics/velocity/:projectId`
- Backend service: `calculateVelocity(projectId)`
- Payload: `{ averageVelocity, data:[{sprintName, planned, completed}], hasHistory, liveSprint }`

9) **Member Effort + Burnout Snapshot** (cards)
- Data source: same as Team Stats (no chart).

## 3) Verified “not implemented / not wired” items

1) **No Pie charts are rendered**
- `AnalyticsPage.jsx` imports `PieChart` and `Pie`, but there is **no `<PieChart>` usage** in the JSX.

2) **Completion stats endpoint exists but is not used by the UI**
- Backend route: `GET /api/analytics/completion/:sprintId`
- Client API function: `analyticsApi.getCompletionStats(sprintId)`
- Current UI: no page calls it, so there is no “Completion by Type” chart today.

## 4) Runtime verification (proves endpoints are real)
On Apr 19, 2026 I started the backend locally and made authenticated requests to the same endpoints used by the graphs.

Results (counts only):
- `GET /api/projects` returned 8 projects
- `GET /api/analytics/overview` returned:
  - `stats` with keys: blockers, completionChangePct, completionRate, cycleTimeDays, totalVelocity, velocityChangePct
  - `orgPerformance` rows: 2
  - `projectHealth` rows: 4
- For the first project tested:
  - `GET /api/sprints?projectId=...` returned 2 sprints
  - `GET /api/analytics/velocity/:projectId` returned `hasHistory=true`, `data` rows: 1, and a non-null `liveSprint`
  - `GET /api/analytics/team/:projectId` returned 3 team stat rows
  - `GET /api/analytics/burndown/:sprintId` returned `totalStoryPoints=10` and 32 data rows

## 5) Project structure (workspace-verified)

### Top level
```
Agile_Ai/
  agileai/                  # Main MERN app (client + server)
  ai-service/               # Python AI microservice (FastAPI + XGBoost + Optuna)
  docs/                     # Diagrams + documents
  models/                   # (empty in this workspace)
  .git/                     # git metadata
  .vite/                    # Vite cache/artifacts
  README.md
  AGILEAI_MASTER_BLUEPRINT.md
  VIVA_DOCUMENTATION.md
  PROJECT_STATUS_REPORT.md
  progress.txt
  ... (other docs)
```

### Main app
```
agileai/
  client/
    src/
      api/
      components/
      hooks/
      pages/
      store/
      utils/
  server/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
  docker-compose.yml
  .env / .env.example
  register_users.ps1
  test_roles.ps1
  .planning/
  .agile/
```

### AI service
```
ai-service/
  api.py
  train_models.py
  train_burnout_model.py
  retrain_candidates.py
  requirements.txt
  models/
    risk_model.pkl
    effort_model.pkl
    burnout_model.pkl
    metrics.json
    burnout_metadata.json
  data_exports/
  repo_cache/
  ai_env/                   # local virtualenv (generated, large)
```

## 6) One real issue that can make the Burnout graph look “wrong”
In `agileai/server/services/analyticsService.js`, `calculateTeamStats()` currently maps a missing `User.aiBurnoutRiskScore` to `0` (number). The UI treats any finite number as “AI present”, so “AI fallback” can’t trigger.

If you’re seeing `Burnout (AI preferred)` show `0.0` for everyone, this is the likely cause. (I can patch this to preserve `null` so the UI can truly fall back.)
