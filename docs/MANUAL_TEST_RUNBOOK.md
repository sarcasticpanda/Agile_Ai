# AgileAI Manual Test Runbook (Step-by-step)

This runbook is designed so you can run a full PM + Dev + Analytics + AI validation pass and log every issue cleanly.

## 0) Prereqs
- Node.js installed
- Python installed (for AI service)
- A MongoDB instance reachable by the backend (local MongoDB or Atlas)

You do **not** need MongoDB Compass for manual testing. Use it only if we need to inspect raw documents while debugging.

---

## 1) Start services (Windows PowerShell)

### 1A) Backend API (Terminal 1)
```powershell
cd .\Agile_Ai\agileai\server
npm install
npm run dev
```
Expected: API prints it is listening on the port from `Agile_Ai/agileai/.env` (typically `5001`).

### 1B) Frontend (Terminal 2)
Your backend `.env` should use `CLIENT_URL=http://localhost:5173` for default Vite runs.

**Option A (recommended): run Vite on default 5173**
```powershell
cd .\Agile_Ai\agileai\client
npm install
npm run dev
```

**Option B (custom port): if you run Vite on another port**
- Edit `Agile_Ai/agileai/.env` and set `CLIENT_URL` to that exact port (example `5175`)
- Then run:
```powershell
cd .\Agile_Ai\agileai\client
npm install
npm run dev -- --port 5175
```

Expected: Vite prints the UI URL. Open it in your browser.

### 1C) AI Service (Terminal 3)
If you want AI graphs (risk/burnout/effort) to be real, start the Python service.

Single-venv policy (from now on):
- Use only `Agile_Ai/ai-service/ai_env` for AI commands.
- Do not use root `.venv` for AI service.

Quick daily start (recommended):
If you are already inside `Agile_Ai/ai-service`, skip the `cd` line.

```powershell
cd .\Agile_Ai\ai-service
.\ai_env\Scripts\Activate.ps1
$env:MONGODB_URI = ((Get-Content ..\agileai\.env | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1) -replace '^MONGODB_URI=', '')
python -m uvicorn api:app --host 0.0.0.0 --port 8001
```

If activation fails, open a fresh terminal and run again.

First-time setup (run once per environment):

```powershell
cd .\Agile_Ai\ai-service
if (!(Test-Path .\ai_env)) { python -m venv ai_env }
.\ai_env\Scripts\Activate.ps1
pip install -r requirements.txt
```

Expected: `GET http://localhost:8001/health` returns `{ ok: true, ... }`.

If port 8001 is already in use:

```powershell
Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess

Get-Process -Id <PID>
Stop-Process -Id <PID> -Force

python -m uvicorn api:app --host 0.0.0.0 --port 8001
```

Alternative: run AI on another port and update backend env.

```powershell
python -m uvicorn api:app --host 0.0.0.0 --port 8002
```

Then set `AI_SERVICE_URL=http://localhost:8002` in `Agile_Ai/agileai/.env` and restart backend.

If the Assignee Capacity box is empty while creating a sprint task:
- It means no eligible developer members are available for that sprint context.
- Open Project Team and add at least one developer to the project.
- Ensure the active sprint includes developer members (or restart sprint after adding members).
- Reopen the Create Task modal.

---

## 2) Test accounts (use these for manual testing)

### Recommended NEW accounts (low collision)
Use these so you don’t collide with old seed users:

- PM: `pm.qa.20260420@agileai.com` / `PmQa1234!`
- Dev1: `dev.qa1.20260420@agileai.com` / `DevQa1234!`
- Dev2: `dev.qa2.20260420@agileai.com` / `DevQa1234!`
- Dev3: `dev.qa3.20260420@agileai.com` / `DevQa1234!`
- Dev4: `dev.qa4.20260420@agileai.com` / `DevQa1234!`

### If you need existing known users
These exist in scripts in the repo, but passwords may vary depending on what you last ran:
- `admin@agileai.com` / `Admin1234!` (from `register_users.ps1`)
- `pm@agileai.com` / `PM12345!` (from `register_users.ps1`) or `Pm1234!` (from `reset_passwords.mjs`)

Tip: if login fails for a known user, run `Agile_Ai/agileai/server/reset_passwords.mjs` to force a known password state.

---

## 3) The canonical scenario (the one we’ll validate graph-by-graph)

Create exactly one project and one sprint so the analytics are easy to reason about:

### 3A) Admin steps
1. Log in as Admin.
2. Create a project `QA Project 1`.
3. Add the PM + 4 Devs to the project/team.
4. Ensure PM has the right project permissions.

### 3B) PM steps (Backlog + Sprint setup)
Create backlog tasks with known point values:
- T1: `API Auth Fix` (8 pts) — assigned to Dev1
- T2: `UI Bug Fix` (5 pts) — assigned to Dev2
- T3: `Shared Refactor Task` (13 pts) — shared between Dev3 + Dev4
- T4: `Small chore` (3 pts) — unassigned

Add T1–T4 into Sprint `Sprint QA-1` and start the sprint.

### 3C) Dev steps (work + status movement)
Perform these actions in the order below (and observe PM board + analytics after each):
1. Dev1 moves T1 ToDo -> InProgress.
2. Dev2 moves T2 ToDo -> InProgress.
3. Dev3 + Dev4 both interact with T3:
   - set it as shared (multiple assignees) and set contributionPercent (e.g., 50/50)
   - each logs some work time (worklog/timer)
4. Complete T2 first (move to Done).
5. Complete T3 next.
6. Complete T1 last.

---

## 4) What each graph MUST do (expected behavior)

### Board / Backlog correctness (PM + Dev)
- PM board and Dev boards show the same tasks in the same columns after socket updates.
- No full page reload should be required to see updated status.

### Burndown
- When a task hits Done, remaining points should drop by that task’s points.
- Shared task must only count once (not double-count for each assignee).

### Velocity
- After sprint completion, completed points should equal total points done.
- Shared task must only count once.

### Member Effort (team stats)
- Dev effort credit should reflect shared attribution:
  - If contributionPercent is 50/50 on the 13pt shared task, each dev should receive ~6.5 points credit.

### Risk Score by Sprint (AI)
- Sprint risk should react to:
  - High WIP / tasks stuck in progress
  - late completion / unfinished sprint scope
  - completion improvements should reduce risk

### Burnout (AI)
- Burnout should react to:
  - workload concentration on a single dev
  - high worklog hours / sustained effort

---

## 5) How to log bugs so we can fix them fast
For every issue, record:
- Page URL
- Role used (Admin/PM/Dev)
- Action performed
- Expected result vs Actual result
- Browser console errors (copy/paste)
- Network call that failed (endpoint + status)

Use the template in `docs/PHASE0_BASELINE_CONTRACT.md`.

---

## 6) Understand task logs, AI effort and analytics mapping

### A) Worklog modal options (when stopping a timer)
- `Auto Timer`: uses the active session start time to now. Best default for normal dev flow.
- `Enter Hours`: override with manual duration (for corrections).
- `Time Range`: explicit start/end (for backfilling exact slots).
- `Activity Type`: implementation/testing/debugging/etc classification.
- `Outcome`:
  - `Progress`: normal forward movement.
  - `Blocked`: could not continue due to blocker.
  - `Hand-off to teammate`: work moved to another contributor.
  - `Completed work item`: session completed the item.
- `Status After Stop`: optional status transition applied together with stop-log.
- `Progress Delta (%)`: optional numeric progress signal for PM context.
- `What did you work on?`: required description, shown to PM on the same task.

### B) Task detail panels and what they mean
- `Lifecycle Dates`: milestone timestamps.
  - `Created`, `Assigned`, `Started` are first-time milestones.
  - `Completed` is latest completion timestamp.
  - `Last Reopened` is latest done -> active transition.
- `Status History`: timeline of state transitions and actor.
- `Active Work Sessions`: currently running timers.
- `Work Logs`: persisted session records (manual or timer).
- `Contribution Summary`: per-user aggregate of logged hours on that task.

### C) How values channel into analytics and AI
- Burndown and Velocity: primarily driven by story points and task status/done timing.
- Team stats and burnout context: use worklogs, blocked/overdue load, and capacity.
- AI Effort Estimate:
  - `Predicted Story Points`: model estimate for complexity.
  - `Estimated Hours`: converted from predicted points using hours-per-point baseline.
  - `Baseline: X hrs/pt (n=Y)`: conversion baseline and sample count used.
  - `n=0` means no project history samples yet, so hours stay `Pending` (no static default baseline is injected).

### E) No-static-fallback policy
- No hardcoded default `4.0 hrs/pt` baseline for AI effort conversion.
- No hardcoded default `40 hrs/wk` capacity in analytics burnout calculations.
- Missing capacity/workday context now stays `Pending` instead of converting to synthetic values.

### D) Recommended simple dev workflow
1. Dev clicks `Start Work` (or moves task to In Progress).
2. Timer runs while working.
3. Dev clicks `Stop & Save Log`, keeps `Auto Timer`, fills description and outcome.
4. PM sees per-dev time and notes on the same task (including shared tasks).

---

## 7) Additional Dev Credentials (for extended testing)
- Dev5: `dev.qa5.20260423@agileai.com` / `DevQa1234!`
- Dev6: `dev.qa6.20260423@agileai.com` / `DevQa1234!`
