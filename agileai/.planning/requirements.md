# AgileAI — Phase 1 Requirements (Jira Core)

## Milestone Goal
Complete all Jira-core features so that all 3 roles (Admin, PM, Developer)
can do their full workflow without hitting errors or broken pages.

## Acceptance Criteria for Phase 1 COMPLETE

### Admin
- [ ] Can log in and see role-specific dashboard
- [ ] Can create a project (title, description, color)
- [ ] Can add a PM as a project member (by email)
- [ ] Can add a Developer as a project member (by email)
- [ ] Can create a sprint inside a project
- [ ] Can create backlog tasks
- [ ] Can move tasks into a sprint
- [ ] Can start a sprint
- [ ] Can see Sprint Board with Kanban columns
- [ ] Can drag tasks between Kanban columns
- [ ] Can click a task to see its full detail
- [ ] Can see Analytics with real sprint data (not hardcoded)
- [ ] Can manage users in Admin Panel (change role, suspend, activate)
- [ ] Can see all projects they own or are member of

### PM (after Admin adds them to a project)
- [ ] Can see shared projects on Projects page
- [ ] Can create sprints (Admin's project they joined)
- [ ] Can create and assign backlog tasks
- [ ] Can start a sprint
- [ ] Can see Sprint Board
- [ ] Can drag tasks between columns
- [ ] Cannot see Admin Panel
- [ ] Cannot see /admin (redirected)
- [ ] Can see Analytics for their project

### Developer (after Admin adds them to a project)
- [ ] Can see shared projects
- [ ] Can see Sprint Board with their assigned tasks
- [ ] Can drag their own tasks between columns
- [ ] Cannot create sprints (no [+] button)
- [ ] Cannot see Admin Panel
- [ ] Can see Backlog (read-only sprint list, can create tasks)

## Out of Scope for Phase 1
- AI risk prediction (Phase 2)
- Effort estimation (Phase 2)
- Sprint Autopsy reports (Phase 2)
- Email notifications
- Real-time collaborative updates (can be basic)
- Mobile responsive design
