# Herald Config

report_after_each_task: true
report_location: brain/progress.md
report_format: |
  ## [TIMESTAMP] Task Complete: [TASK_NAME]
  - Files changed: [FILES]
  - What was broken: [BEFORE]
  - What was fixed: [AFTER]
  - Verified by: [HOW]
  - Next task: [NEXT]
```

---

## Step 3 — The Master Overnight Prompt

Now paste this into Antigravity as your main session prompt:

---

> You are a senior full-stack engineer fixing the AgileAI MERN application overnight. The app is 57% complete and needs to reach production-ready Phase 1 by morning.
>
> **Read these files before you do anything else:**
> - `brain/project_context.md` — full project context
> - `brain/bug_list.md` — ordered list of exactly what to fix
> - `brain/api_contracts.md` — exact API field names
> - `agileai_master_report.md` — full audit of current state
>
> **Rules you must follow:**
> 1. Fix bugs in the exact order listed in `brain/bug_list.md` — P0 first, then P1
> 2. Before fixing any bug, read the actual file first — do not assume what the code looks like
> 3. After every single fix, verify it works before moving to the next bug — open the browser and confirm
> 4. Write a Herald report entry to `brain/progress.md` after each fix
> 5. Do not touch `.env`, `server/init_db.js`, or MongoDB connection
> 6. Do not change port — backend is 5001, frontend is 5173
> 7. If a fix fails after 3 attempts, log it in `brain/blockers.md` and move to the next bug
>
> **Start now. Read the brain files, then fix Bug 1 (Sprint creation 400 error).**

---

## Step 4 — Verification Prompts (Run These After Each Bug)

After Bug 1 is fixed, send this:

> **@Ralph verify Bug 1**: Log into the app as Admin. Go to any project. Click Backlog. Click the [+] Sprint button. Fill in title "Sprint 1", start date April 1 2026, end date April 14 2026. Click Save. Confirm the sprint appears in the left sidebar without a 400 error. Screenshot the result and log pass/fail to `brain/progress.md`.

After Bug 2:

> **@Ralph verify Bug 2**: While in the Backlog, click "New Issue". Fill in title "Login Screen", type Story, priority High, story points 5. Click Save. Confirm the task appears in the backlog list under the correct sprint section. Log pass/fail to `brain/progress.md`.

After Bug 3:

> **@Ralph verify Bug 3**: Click "Sprint Board" in the sidebar. Confirm the Kanban board loads showing To Do, In Progress, and Done columns. Log pass/fail.

After Bug 4:

> **@Ralph verify Bug 4**: Log in as Admin. Go to the project you created. Click "Manage Members". Add freshpm3@test.com as a member. Log out. Log in as PM. Confirm the project now appears on the Projects page. Log pass/fail.

---

## Step 5 — The Kanban Fix Prompt (Bug 6, the hardest one)

This one needs a dedicated focused prompt because dnd-kit is tricky:

> Read `client/src/pages/SprintBoardPage.jsx` completely before touching it.
>
> The Sprint Board needs working drag-and-drop between columns using dnd-kit. Here is exactly how to implement it:
>
> 1. Import from dnd-kit: `DndContext, closestCenter, DragOverlay, useDraggable, useDroppable` from `@dnd-kit/core`
> 2. Each task card gets `useDraggable({ id: task._id })`
> 3. Each column (To Do, In Progress, Review, Done) gets `useDroppable({ id: columnStatus })` where columnStatus is the string 'todo', 'inprogress', 'review', 'done'
> 4. On `onDragEnd` event: call `PATCH /api/tasks/:id/status` with the new status
> 5. After the mutation succeeds, call `queryClient.invalidateQueries(['tasks', sprintId])` to refresh the board
> 6. Show optimistic UI — move the card immediately, revert if API fails
>
> After implementing, verify: drag a task card from To Do to In Progress — it should move instantly and stay there after page refresh.

---

## Step 6 — Analytics Real Data Prompt (Bug 7)

> Read `client/src/pages/AnalyticsPage.jsx` completely.
>
> Currently analytics shows hardcoded values. Replace with real API calls:
>
> 1. Add a sprint selector dropdown at top of page — calls `GET /api/sprints?projectId=X` to list sprints
> 2. Burndown chart: when a sprint is selected, call `GET /api/analytics/burndown/:sprintId` — replace the hardcoded chart data with the response
> 3. Velocity chart: call `GET /api/analytics/velocity/:projectId` — replace hardcoded 42pts with real value
> 4. If no sprint is selected, show an empty state: "Select a sprint to view analytics"
> 5. If the analytics endpoints return 404 or empty data, show "No sprint data available yet — start a sprint to see analytics"
>
> Use React Query: `useQuery(['burndown', sprintId], () => api.getBurndown(sprintId), { enabled: !!sprintId })`

---

## Step 7 — End of Night Verification Prompt

When everything is done (or around 6am), run this final prompt:

> **Full production readiness check.** Do a complete walkthrough as all 3 roles and verify each item:
>
> **As Admin:**
> - Can log in ✓
> - Can create a project ✓
> - Can create a sprint inside the project ✓
> - Can create tasks in the backlog ✓
> - Can add PM as project member ✓
> - Can view Admin Panel with user list ✓
> - Can view Sprint Board ✓
> - Can view Analytics ✓
>
> **As PM (after being added to Admin's project):**
> - Can see the project on Projects page ✓
> - Can create sprints ✓
> - Can move tasks to sprint ✓
> - Cannot see Admin Panel ✓
> - Can view Sprint Board ✓
>
> **As Developer:**
> - Can see assigned projects ✓
> - Can drag task cards on Sprint Board ✓
> - Cannot see Create Sprint button ✓
> - Cannot access /admin ✓
>
> For any item that fails, log it in `brain/blockers.md` with the exact error. Do not try to fix at this stage — just document. Then generate a final `brain/final_report.md` with the complete status of every feature.

---

## The Complete Overnight Schedule

Here is the realistic timeline so you know what to expect:
```
11:00 PM  — Set up brain files (you do this, 15 min)
11:15 PM  — Load plugins, paste master prompt
11:30 PM  — Agent fixes Bug 1 (Sprint 400 error)
11:45 PM  — Agent fixes Bug 2 (Task 400 error)
12:15 AM  — Agent fixes Bug 3 (Sprint Board route)
01:00 AM  — Agent fixes Bug 4 (Add Member UI)
02:30 AM  — Agent fixes Bug 5 (Task slide-over)
04:00 AM  — Agent fixes Bug 6 (Kanban drag-drop)
05:30 AM  — Agent fixes Bug 7 (Analytics real data)
06:30 AM  — Final verification walkthrough
07:00 AM  — Phase 1 complete. Sleep.