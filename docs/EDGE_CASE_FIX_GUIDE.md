# Edge Case Fix Guide (April 21, 2026)

This guide records the one-pass hardening changes for blocker dependencies, task lifecycle consistency, and status transition integrity.

## 1) Blocker Validation Rules

Applied at backend update/create boundaries to avoid UI-only protection gaps.

### Rules enforced
- No self-blocking: a task cannot include itself in `blockedBy`.
- No circular dependencies: if adding blocker links creates a graph path back to the current task, request is rejected.
- Same project only: all blocker tasks must belong to the same project as the task.
- Existence check: every blocker ID must map to an existing task.
- ObjectId integrity: invalid task IDs in `blockedBy` are rejected.

### API behavior
- Endpoint: `PATCH /tasks/:id` with `{ blockedBy: [...] }`
- Invalid dependency payload now returns `400` with explicit reason.

## 2) Timer Reopen Lifecycle Consistency

When a timer is started on a previously done task:
- status changes to `inprogress`
- `reopenedAt` is stamped
- `completedAt` is cleared

This prevents stale completed timestamps from leaking into burndown calculations.

## 3) Status-Bypass Closure

### Backend constraints
- Developers cannot move tasks directly to `review`, `done`, or `todo` via status endpoint.
- Developers must use timer stop flow for non-inprogress transitions.

### UI constraints
- Task detail status selector is disabled for developer role with explicit guidance text.
- Shared board drag for developers now allows only `inprogress`, and only if the developer has an active timer on that task.
- Drag errors now surface backend response messages for quick diagnosis.

## 4) Analytics Safety Adjustment

Burndown completion resolution now requires the task's current status to be `done` before using completion timestamps.

This ensures reopened tasks are not counted as completed due to legacy stale fields.

## 5) Quick Smoke Validation

Run this sequence after backend + frontend are up.

### A) Dependency graph checks
1. Try setting task A blocked by itself -> expect `400`.
2. Set A blocked by B, then set B blocked by A -> expect `400` circular dependency.
3. Try setting blocker from another project -> expect `400`.
4. Try setting a non-existent blocker ID -> expect `400`.

### B) Reopen lifecycle checks
1. Mark task done.
2. Start timer on same task.
3. Verify task becomes `inprogress`, `completedAt` clears, `reopenedAt` updates.
4. Verify burndown no longer counts this task as done until it is done again.

### C) Status bypass checks
1. Developer opens task detail -> status select should be disabled.
2. Developer drags task to review/done on board -> blocked with guidance.
3. Developer drags todo -> inprogress without timer -> blocked.
4. Developer starts timer then drags to inprogress -> allowed.
5. Developer stops timer with status in stop modal -> transition succeeds.

## 6) Files Changed (this pass)
- `agileai/server/controllers/taskController.js`
- `agileai/server/services/analyticsService.js`
- `agileai/client/src/pages/TaskDetailPage.jsx`
- `agileai/client/src/pages/SharedBoardPage.jsx`
- `docs/EDGE_CASE_FIX_GUIDE.md`
