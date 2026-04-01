# AgileAI — Master Build Blueprint
# Version: 2.0 | Date: March 2026
# This file is the single source of truth for the entire application.
# Your coding agent reads this and implements exactly what is described.
# No guessing. No assumptions. Every edge case is covered here.

---

## SECTION 0 — ARCHITECTURE DECISIONS (READ FIRST)

### Duplicate File Problem — Fix This Immediately
Current state has duplicate pages that must be MERGED:
- SprintBoardPage.jsx + PmBoardPage.jsx → MERGE into one SharedBoardPage.jsx with role props
- BacklogPage.jsx + PmBacklogPage.jsx → MERGE into one BacklogPage.jsx with role props
- DashboardPage.jsx + PmDashboardPage.jsx → KEEP SEPARATE (content is fundamentally different)
- PMTeamView.jsx + PmTeamPage.jsx → MERGE into one TeamPage.jsx

### Role System Decision
- Admin: seeded in DB on first boot. Cannot self-register as admin.
- PM: Admin creates PM accounts only. No self-registration for PM.
- Developer: Can self-register BUT lands in "pending" state. PM OR Admin approves.
- Registration page: only shows Developer role option. Remove Admin and PM from dropdown.

### Project Visibility Rule
A user sees a project if ANY of these are true:
  1. They are the owner (created it)
  2. They are in the members array
  3. They have role=admin (admin sees all projects in system)

### Shared Component Rule
Extract these into shared components used by all roles:
  - StatsCard.jsx (used on all dashboards)
  - SharedKanbanBoard.jsx (used by PM and Dev with different permissions prop)
  - TaskRow.jsx (used in all backlog views)
  - SprintSidePanel.jsx (left panel in backlog views)

---

## SECTION 1 — DATABASE SCHEMA (FINAL)

### User Collection
```
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique, lowercase),
  password: String (hashed, required),
  role: String (enum: ['admin','pm','developer'], required),
  status: String (enum: ['active','pending','suspended'], default: 'active'),
  managedBy: ObjectId ref User (null for admin/pm, points to PM for developers),
  createdBy: ObjectId ref User (who created this account),
  avatar: String (url or null),
  lastLogin: Date,
  createdAt: Date
}
```
RULE: When role=developer and status=pending → they see PendingPage only.
RULE: When admin creates PM → status immediately 'active'.
RULE: When dev self-registers → status='pending' until PM/Admin approves.

### Organization Collection
```
{
  _id: ObjectId,
  name: String,
  createdBy: ObjectId ref User,
  members: [{ user: ObjectId ref User, role: String }],
  createdAt: Date
}
```
NOTE: For Phase 1 academic demo, treat entire app as one organization.
Skip multi-org complexity — one global org seeded on first boot.

### Project Collection
```
{
  _id: ObjectId,
  title: String (required),
  description: String,
  color: String (hex, default '#4F46E5'),
  status: String (enum: ['planning','active','archived'], default: 'active'),
  owner: ObjectId ref User (required),
  members: [{
    user: ObjectId ref User,
    role: String (enum: ['pm','developer','viewer']),
    addedAt: Date,
    addedBy: ObjectId ref User
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Sprint Collection
```
{
  _id: ObjectId,
  project: ObjectId ref Project (required),
  title: String (required),
  goal: String,
  startDate: Date (required),
  endDate: Date (required),
  status: String (enum: ['planning','active','completed'], default: 'planning'),
  velocity: Number (computed on complete, null until then),
  totalStoryPoints: Number (computed from tasks),
  completedStoryPoints: Number (computed from done tasks),
  startedAt: Date (when status changed to active),
  completedAt: Date (when status changed to completed),
  createdBy: ObjectId ref User,
  createdAt: Date,
  // AI FIELDS — populated by Python service in Phase 2
  aiRiskScore: Number (0-100, null until Phase 2),
  aiRiskLevel: String (enum: ['low','medium','high'], null until Phase 2),
  aiRiskFactors: [{
    factor: String,
    impact: Number,
    direction: String (enum: ['positive','negative'])
  }],
  aiLastAnalyzed: Date
}
```

### Task Collection
```
{
  _id: ObjectId,
  project: ObjectId ref Project (required),
  sprint: ObjectId ref Sprint (null = in backlog),
  title: String (required),
  description: String,
  type: String (enum: ['story','bug','task','epic'], default: 'task'),
  status: String (enum: ['todo','inprogress','review','done'], default: 'todo'),
  priority: String (enum: ['low','medium','high','critical'], default: 'medium'),
  assignee: ObjectId ref User (null = unassigned),
  reporter: ObjectId ref User (required = who created it),
  storyPoints: Number (1-13, null if not estimated),
  estimatedHours: Number (null if not set),
  actualHours: Number (computed from worklogs),
  labels: [String],
  dueDate: Date,
  order: Number (for kanban column ordering),
  blockedBy: [ObjectId ref Task],
  isBlocked: Boolean (computed: blockedBy.length > 0),
  lastActivityAt: Date (updated on any change),
  statusHistory: [{
    from: String,
    to: String,
    changedBy: ObjectId ref User,
    changedAt: Date
  }],
  comments: [{
    _id: ObjectId,
    author: ObjectId ref User,
    text: String,
    createdAt: Date,
    editedAt: Date
  }],
  worklogs: [{
    _id: ObjectId,
    user: ObjectId ref User,
    hours: Number,
    date: Date,
    description: String,
    createdAt: Date
  }],
  // AI FIELD — populated by Python service
  aiEstimatedHours: Number (null until Phase 2),
  aiEstimateConfidence: Number (0-1, null until Phase 2),
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Collection
```
{
  _id: ObjectId,
  recipient: ObjectId ref User (required),
  type: String (enum: [
    'task_assigned',
    'task_status_changed',
    'sprint_started',
    'sprint_completed',
    'sprint_risk_alert',
    'comment_added',
    'member_added_to_project',
    'developer_approved',
    'account_created'
  ]),
  title: String,
  message: String,
  read: Boolean (default false),
  link: String (frontend route to navigate to on click),
  metadata: Mixed (extra data: taskId, sprintId, projectId etc),
  createdAt: Date
}
```

### AuditLog Collection
```
{
  _id: ObjectId,
  actor: ObjectId ref User,
  action: String,
  resource: String,
  resourceId: ObjectId,
  before: Mixed,
  after: Mixed,
  ip: String,
  createdAt: Date
}
```

---

## SECTION 2 — BACKEND API (COMPLETE ENDPOINT LIST)

### Auth Routes — /api/auth
```
POST /api/auth/register
  Body: { name, email, password }
  Note: role is ALWAYS set to 'developer' regardless of what body sends
        status is ALWAYS set to 'pending'
  Returns: { success, message: 'Account created. Awaiting approval.' }
  No token returned — they cannot log in yet

POST /api/auth/login
  Body: { email, password }
  Logic: if status='pending' → return 403 with message 'Account pending approval'
         if status='suspended' → return 403 with message 'Account suspended'
         if credentials wrong → return 401
         if ok → return JWT + user object
  Returns: { success, data: { token, user: { _id, name, email, role, status, avatar } } }

GET /api/auth/me
  Headers: Authorization Bearer token
  Returns: { success, data: { user } }

PATCH /api/auth/me
  Headers: Authorization Bearer token
  Body: { name, avatar }
  Returns: { success, data: { user } }

POST /api/auth/change-password
  Headers: Authorization Bearer token
  Body: { currentPassword, newPassword }
  Returns: { success, message: 'Password updated' }

POST /api/auth/logout
  Headers: Authorization Bearer token
  Action: add token to blacklist in memory (or just let client clear it)
  Returns: { success }
```

### Admin Routes — /api/admin [requireRole('admin')]
```
GET /api/admin/users
  Query: ?role=&status=&search=
  Returns: { success, data: [users with populated managedBy] }

POST /api/admin/create-pm
  Body: { name, email, password }
  Action: creates user with role='pm', status='active'
          sends notification to new PM
  Returns: { success, data: { user } }

PATCH /api/admin/users/:id/role
  Body: { role }
  Validation: cannot demote last admin, cannot promote pending user
  Action: updates role, logs to AuditLog
  Returns: { success, data: { user } }

PATCH /api/admin/users/:id/status
  Body: { status } — 'active' or 'suspended'
  Action: updates status, logs to AuditLog
  Returns: { success, data: { user } }

DELETE /api/admin/users/:id
  Validation: cannot delete self, cannot delete last admin
  Action: removes from all project members, unassigns tasks,
          logs to AuditLog, deletes user
  Returns: { success }

GET /api/admin/teams
  Returns: all PMs with their developers nested:
  { success, data: [{
    pm: { _id, name, email },
    developers: [{ _id, name, email, status, activeTasksCount }],
    projectsCount: Number
  }] }

PATCH /api/admin/users/:id/approve
  Body: { managedBy: pmId (optional) }
  Action: sets status='active', sets managedBy if provided
          sends notification to developer
  Returns: { success, data: { user } }

GET /api/admin/pending-users
  Returns: all users with status='pending'

GET /api/admin/stats
  Returns: { totalUsers, totalPMs, totalDevelopers, pendingApprovals,
             totalProjects, activeProjects, totalSprints, activeSprints }

GET /api/admin/audit-logs
  Query: ?page=&limit=&userId=&action=
  Returns: paginated audit logs

GET /api/admin/all-projects
  Returns: every project in system with owner and member details
```

### PM Routes — /api/pm [requireRole('pm','admin')]
```
POST /api/pm/create-developer
  Body: { name, email, password, projectId (optional) }
  Action: creates user with role='developer', status='active',
          managedBy=req.user._id
          if projectId provided, adds as member to that project
          sends notification to new developer
  Returns: { success, data: { user } }

GET /api/pm/my-developers
  Returns: developers where managedBy = req.user._id
  Includes: each dev's active tasks count, current sprint

GET /api/pm/pending-developers
  Returns: pending developers assigned to this PM (managedBy = req.user._id)

PATCH /api/pm/developers/:id/release
  Action: sets managedBy=null on developer
  Returns: { success }

PATCH /api/pm/developers/:id/approve
  Body: { projectId (optional) }
  Action: sets status='active', sends notification
  Returns: { success, data: { user } }
```

### Project Routes — /api/projects [requireAuth]
```
GET /api/projects
  Logic: if admin → return ALL projects
         if pm/dev → return projects where owner=user OR members.user=user
  Returns: { success, data: [projects] }

POST /api/projects
  RequireRole: pm, admin
  Body: { title, description, color, status }
  Action: creates project with owner=req.user._id,
          automatically adds creator as member with role='pm'
  Returns: { success, data: { project } }

GET /api/projects/:id
  Authorization: must be member OR admin
  Returns: { success, data: { project with populated members } }

PATCH /api/projects/:id
  RequireRole: pm (must be owner or member with pm role), admin
  Body: { title, description, color, status }
  Returns: { success, data: { project } }

DELETE /api/projects/:id
  RequireRole: admin only
  Action: also deletes all sprints and tasks in project
  Returns: { success }

POST /api/projects/:id/members
  RequireRole: pm (must be project owner), admin
  Body: { userId, role }
  Action: adds to members array, sends notification to added user
  Returns: { success, data: { project } }

DELETE /api/projects/:id/members/:userId
  RequireRole: pm (must be project owner), admin
  Action: removes from members array
  Returns: { success }

GET /api/projects/:id/members
  Authorization: must be project member OR admin
  Returns: { success, data: [members with user details] }
```

### Sprint Routes — /api/sprints [requireAuth]
```
GET /api/sprints
  Query: ?projectId= (required)
  Authorization: must be project member OR admin
  Returns: { success, data: [sprints with task counts] }

POST /api/sprints
  RequireRole: pm, admin
  Body: { projectId, title, goal, startDate, endDate }
  Validation: startDate must be before endDate
              only one sprint can be 'active' per project at a time
              convert startDate/endDate strings to Date objects
  Returns: { success, data: { sprint } }

GET /api/sprints/:id
  Authorization: must be project member OR admin
  Returns: { success, data: { sprint with tasks } }

PATCH /api/sprints/:id
  RequireRole: pm (must be project member), admin
  Body: { title, goal, startDate, endDate }
  Validation: cannot edit active or completed sprint dates
  Returns: { success, data: { sprint } }

DELETE /api/sprints/:id
  RequireRole: pm (must be project owner or admin)
  Validation: cannot delete active sprint
  Action: moves all tasks back to backlog (sprint=null)
  Returns: { success }

POST /api/sprints/:id/start
  RequireRole: pm, admin
  Validation: sprint must be 'planning' status
              no other sprint for this project can be 'active'
              sprint must have at least 1 task
  Action: sets status='active', startedAt=now
          computes totalStoryPoints from tasks
          sends Socket.io event 'sprint:started' to project room
          triggers AI risk calculation if Phase 2 active
          creates notification for all project members
  Returns: { success, data: { sprint } }

POST /api/sprints/:id/complete
  RequireRole: pm, admin
  Validation: sprint must be 'active' status
  Action: sets status='completed', completedAt=now
          computes velocity = completedStoryPoints / totalStoryPoints * 100
          moves all non-done tasks back to backlog (sprint=null, status='todo')
          sends Socket.io event 'sprint:completed'
          creates notification for all project members
  Returns: { success, data: { sprint } }
```

### Task Routes — /api/tasks [requireAuth]
```
GET /api/tasks
  Query: ?projectId=&sprintId=&assignee=&status=&type=
  Note: sprintId=null means backlog tasks
  Authorization: must be project member OR admin
  Returns: { success, data: [tasks] }

POST /api/tasks
  RequireRole: any authenticated member of project
  Body: { projectId, title, description, type, priority, storyPoints,
          estimatedHours, assignee, dueDate, labels, sprintId (optional) }
  Validation: sprintId sprint must belong to same project
  Action: sets reporter=req.user._id
          sets lastActivityAt=now
          if assignee set: create task_assigned notification
  Returns: { success, data: { task } }

GET /api/tasks/:id
  Authorization: must be project member OR admin
  Returns: { success, data: { task with populated assignee, reporter, comments.author } }

PATCH /api/tasks/:id
  Authorization: pm/admin OR developer (if assignee = req.user)
  Body: any task fields to update
  Action: update lastActivityAt
          if status changed: add to statusHistory, send Socket.io 'task:updated'
          if assignee changed: create task_assigned notification
  Returns: { success, data: { task } }

PATCH /api/tasks/:id/status
  Authorization: pm/admin OR developer (if assignee = req.user)
  Body: { status }
  Validation: valid status values only
  Action: append to statusHistory
          update lastActivityAt
          recompute sprint.completedStoryPoints
          send Socket.io 'task:status_changed' to project room
  Returns: { success, data: { task } }

PATCH /api/tasks/:id/sprint
  RequireRole: pm, admin
  Body: { sprintId } (null = move to backlog)
  Validation: sprint must belong to same project
              cannot move to completed sprint
  Returns: { success, data: { task } }

DELETE /api/tasks/:id
  RequireRole: pm, admin
  Returns: { success }

POST /api/tasks/:id/comment
  RequireRole: any project member
  Body: { text }
  Action: push to comments array
          create comment_added notification for assignee (if not same person)
          send Socket.io 'task:comment_added'
  Returns: { success, data: { comment } }

DELETE /api/tasks/:id/comment/:commentId
  Authorization: comment author OR pm OR admin
  Returns: { success }

POST /api/tasks/:id/worklog
  RequireRole: developer (if assignee), pm, admin
  Body: { hours, date, description }
  Validation: hours must be > 0 and <= 24
              date cannot be in future
  Action: push to worklogs, recompute actualHours = sum of all worklogs
  Returns: { success, data: { worklog } }

DELETE /api/tasks/:id/worklog/:worklogId
  Authorization: worklog creator OR admin
  Returns: { success }
```

### Analytics Routes — /api/analytics [requireAuth]
```
GET /api/analytics/burndown/:sprintId
  Authorization: project member OR admin
  Logic: 
    For each day from sprint.startDate to today:
      idealRemaining = totalPoints * (daysLeft / totalDays)
      actualRemaining = sum of storyPoints for tasks NOT in 'done'
  Returns: {
    success,
    data: {
      labels: ['Day 1', 'Day 2', ...],
      ideal: [totalPoints, ..., 0],
      actual: [totalPoints, ..., currentRemaining],
      totalPoints: Number,
      completedPoints: Number,
      remainingPoints: Number,
      completionPercentage: Number,
      daysRemaining: Number,
      projectedCompletion: 'on_track' | 'at_risk' | 'behind'
    }
  }

GET /api/analytics/velocity/:projectId
  Authorization: project member OR admin
  Query: ?limit=6 (last N completed sprints)
  Returns: {
    success,
    data: {
      sprints: [{ name, committed, completed, velocity }],
      averageVelocity: Number,
      trend: 'improving' | 'declining' | 'stable'
    }
  }

GET /api/analytics/team/:projectId
  RequireRole: pm, admin
  Returns: {
    success,
    data: [{
      user: { _id, name, avatar },
      tasksAssigned: Number,
      tasksCompleted: Number,
      storyPointsDelivered: Number,
      averageHoursPerPoint: Number,
      onTimeRate: Number (percentage of tasks done before dueDate)
    }]
  }

GET /api/analytics/sprint-health/:sprintId
  Authorization: project member OR admin
  Returns: {
    success,
    data: {
      completionRate: Number,
      blockedTasksCount: Number,
      idleTasksCount: Number (no activity > 3 days),
      scopeCreepCount: Number (tasks added after sprint started),
      velocityVsAverage: Number (% difference from team average),
      daysElapsed: Number,
      daysRemaining: Number,
      healthScore: Number (0-100, computed from above metrics),
      healthLabel: 'Healthy' | 'At Risk' | 'Critical'
    }
  }

GET /api/analytics/developer/:userId
  Authorization: developer (own data only) OR pm (their team) OR admin
  Query: ?sprintId=
  Returns: {
    success,
    data: {
      tasksCompleted: Number,
      storyPointsDelivered: Number,
      totalHoursLogged: Number,
      averageHoursPerPoint: Number,
      tasksByStatus: { todo, inprogress, review, done }
    }
  }
```

### Notification Routes — /api/notifications [requireAuth]
```
GET /api/notifications
  Returns current user's notifications, newest first, limit 50
  Returns: { success, data: [notifications], unreadCount: Number }

PATCH /api/notifications/:id/read
  Returns: { success }

POST /api/notifications/read-all
  Action: marks all current user notifications as read
  Returns: { success }

DELETE /api/notifications/:id
  Authorization: recipient only
  Returns: { success }
```

### AI Routes — /api/ai [requireAuth] [stubs in Phase 1, real in Phase 2]
```
POST /api/ai/predict-risk
  Body: { sprintId }
  Phase 1: return { success, data: { riskScore: null, riskLevel: null, message: 'Phase 2' } }
  Phase 2: call Python service, store result in sprint.aiRiskScore etc, return it

POST /api/ai/estimate-effort
  Body: { taskId }
  Phase 1: return { success, data: { predictedHours: null, message: 'Phase 2' } }
  Phase 2: call Python service, store in task.aiEstimatedHours, return it

GET /api/ai/insights/:sprintId
  Phase 1: return { success, data: null, message: 'Phase 2' }
  Phase 2: return stored aiRiskScore, aiRiskFactors, SHAP values

GET /api/ai/sprint-summary/:sprintId
  Returns autopsy data after sprint completes
  Phase 1: return null
  Phase 2: call Python for analysis
```

---

## SECTION 3 — FRONTEND: COMPLETE PAGE SPECIFICATIONS

### 3.0 — App Router Structure (App.jsx)
```
Public routes (no auth needed):
  /login              → AuthPage (login tab default)
  /register           → AuthPage (register tab)

Protected routes (requireAuth):
  /pending            → PendingApprovalPage (only for status=pending users)

  /dashboard          → RoleBasedDashboard (renders Admin/PM/Dev version)
  /projects           → ProjectsPage (Admin + PM only, Dev redirected to /my-tasks)
  /projects/:id/backlog → BacklogPage (Admin + PM full, Dev read-only)
  /projects/:id/board   → SharedBoardPage (all roles, different permissions)
  /analytics          → AnalyticsPage (Admin + PM only)
  /team               → TeamPage (Admin + PM only)
  /my-tasks           → MyTasksPage (Developer only)
  /worklog            → WorklogPage (Developer only)
  /ai-insights        → AIInsightsPage (Admin + PM only)
  /notifications      → NotificationsPage (all roles)
  /profile            → ProfilePage (all roles)
  /settings           → SettingsPage (all roles)
  /admin              → AdminPanelPage (Admin only)

Redirect rules:
  / → /dashboard
  Developer visits /projects → redirect to /my-tasks
  Developer visits /analytics → redirect to /my-tasks
  Developer visits /admin → redirect to /dashboard
  Non-admin visits /admin → redirect to /dashboard
  Pending user visits any protected route → redirect to /pending
  Logged-in user visits /login → redirect to /dashboard
```

### 3.1 — AUTH PAGE (/login and /register)

**Layout:** Split screen. Left half: dark indigo gradient with logo and tagline. Right half: white card with form.

**Login Tab:**
- Email input (floating label)
- Password input with show/hide toggle
- "Remember me" checkbox
- Login button (full width, indigo)
- "Forgot password?" link (show message "Contact admin to reset password")
- "Don't have an account? Register" link

**Register Tab:**
- Full Name input
- Email input
- Password input (show/hide, min 8 chars)
- Confirm Password input
- Role selector: ONLY shows "Developer" — remove Admin and PM options
- Register button
- After submit: show success screen "Account created. An admin or PM will approve your account."
- Do NOT redirect to dashboard — stay on this confirmation screen

**Edge cases:**
- Email already exists → show "Email already registered"
- Password mismatch → show inline error before submit
- All server errors → show toast notification

---

### 3.2 — PENDING APPROVAL PAGE (/pending)

**Who sees this:** Any user with status='pending' after login

**Content:**
- Large hourglass or clock icon
- Heading: "Your account is pending approval"
- Subtext: "A Project Manager or Admin will approve your account. Check back soon."
- Your email displayed
- Logout button
- Auto-poll every 60 seconds: GET /api/auth/me — if status changed to 'active', redirect to /dashboard

---

### 3.3 — ADMIN DASHBOARD (/dashboard when role=admin)

**Layout:** Dark sidebar + white content area

**Sidebar items (Admin only):**
```
  [Dashboard icon] Dashboard         → /dashboard
  [Users icon] User Management       → /admin
  [Team icon] Team Hierarchy         → /admin/teams
  [Folder icon] All Projects         → /projects
  [Chart icon] Analytics             → /analytics
  [Bell icon] Notifications          → /notifications  (badge with unread count)
  [Gear icon] Settings               → /settings
  [Person icon] Profile              → /profile
  Bottom: user avatar, name, "Admin" badge, logout button
```

**Dashboard Stats Row (4 cards):**
```
  Card 1: Total Users (number) — click → /admin
  Card 2: Active PMs (number) — click → /admin/teams
  Card 3: Active Projects (number) — click → /projects
  Card 4: Pending Approvals (number, red if >0) — click → /admin?tab=pending
```

**Main Content — Project Managers section:**
- Heading "Project Managers" + count
- PM cards in a grid (2 columns):
  Each PM card shows:
  - Avatar circle with initials
  - Name, email
  - "X projects" and "X developers"
  - [View Team] button → navigates to /admin/teams?pmId=X
  - [···] dropdown: [Edit Role], [Suspend], [Delete]
- Empty state if no PMs: "No Project Managers yet. Create one to get started."
- Bottom: [+ Create PM Account] button → opens CreateAccountModal

**Main Content — Recent Activity feed (right sidebar):**
- Last 10 audit log entries shown as timeline
- Each entry: avatar, "User X changed Y" text, timestamp
- "View all activity" link → /admin/audit-logs (future)

**AI Risk Overview Card (bottom):**
- Phase 1: shows "AI Intelligence coming in Phase 2"
- Phase 2: shows system-wide average sprint risk score

---

### 3.4 — ADMIN PANEL PAGE (/admin) [Admin only]

**Tab 1: All Users**
- Search bar (searches name + email)
- Filter dropdown: All Roles / Admin / PM / Developer
- Filter dropdown: All Status / Active / Pending / Suspended
- Table columns: Avatar | Name | Email | Role | Managed By | Status | Actions
- Actions per row:
  - [Change Role ▼] dropdown: Admin, PM, Developer
    - On select: confirm dialog "Change X to Y?" → PATCH /api/admin/users/:id/role
    - Cannot demote last admin (show error)
  - [Suspend/Activate] toggle button
    - Suspended users cannot login (show "Account suspended" on login attempt)
  - [Delete] button → confirm dialog → DELETE /api/admin/users/:id
- Pagination: 20 per page
- Empty state: "No users found matching your search"

**Tab 2: Pending Approvals**
- List of users with status='pending'
- Each row: Avatar, Name, Email, "Applied X days ago"
- Actions: [Approve] button → opens ApproveUserModal
  - ApproveUserModal: "Assign to PM" dropdown (optional), [Approve] button
  - On approve: PATCH /api/admin/users/:id/approve + optional managedBy
- [Reject/Delete] button → confirm dialog
- Empty state: "No pending approvals"

**Tab 3: Create PM Account**
- Form: Full Name, Email, Password, "Generate Password" button
- [Create Project Manager] button → POST /api/admin/create-pm
- Success: show "Account created. Credentials can be shared with the PM."
- Show the generated password with copy button

**Tab 4: Audit Logs**
- Table: Actor | Action | Resource | Timestamp
- Filter by user, action type
- Export as CSV button (future)

---

### 3.5 — ADMIN TEAMS PAGE (/admin/teams) [Admin only]

**Layout:** Full width, accordion-style

**Each PM Row (expanded):**
```
PM Avatar | PM Name | PM Email | "X Projects" | "Y Developers" | [Manage ▼]
  Manage dropdown: [Add Developer to this PM] [View PM's Projects] [Change PM Role]

  Expanded developer list (indented):
    Dev Avatar | Dev Name | Dev Email | Status dot | "X active tasks" | "Sprint Name"
    Actions: [Reassign to different PM ▼] [Change to PM] [Suspend] [Remove from Team]
```

**"Add Developer" modal (opened from PM row):**
- Search existing approved developers without a PM
- Shows: Name, Email, Current Status
- [Assign to this PM] button
- OR [Create New Developer Account] tab

**Empty state:** "No Project Managers yet. Create one in User Management."

---

### 3.6 — PM DASHBOARD (/dashboard when role=pm)

**Layout:** PMLayout sidebar + white content area

**Sidebar items (PM only):**
```
  [Dashboard] Dashboard          → /dashboard
  [Folder] My Projects           → /projects
  [List] Backlog                 → /projects (select project first, then backlog)
  [Kanban] Sprint Board          → /projects (select project first, then board)
  [Chart] Analytics              → /analytics
  [People] My Team               → /team
  [Brain] AI Insights            → /ai-insights
  [Bell] Notifications           → /notifications (with badge)
  [Person] Profile               → /profile
  Bottom: avatar, name, "Project Manager" badge, logout
```

**Project Selector (top of sidebar or top of content):**
- Dropdown showing all projects this PM has access to
- Selected project stored in Zustand projectStore.activeProjectId
- All pages (Backlog, Board, Analytics) use this activeProjectId
- If no project selected → show "Select a project to get started"

**Dashboard Stats Row (4 cards):**
```
  Card 1: My Projects (number from API)
  Card 2: Active Sprint (name or "None")
  Card 3: Sprint Health (computed from /api/analytics/sprint-health/:sprintId)
           Shows: "Healthy" green, "At Risk" orange, "Critical" red
           If no active sprint: "N/A"
  Card 4: Team Velocity (from /api/analytics/velocity/:projectId averageVelocity)
           Shows: "42 pts avg"
           If no completed sprints: "N/A"
```

**My Team Section:**
- Horizontal row of developer mini-cards
- Each card: avatar, name, "X tasks active" (from active sprint), small progress bar
- [View Tasks] button → /projects/:id/board filtered by this developer
- Last "card": dashed border "+ Add Developer" button → opens AddDeveloperModal
- Empty state: "No developers on your team yet. Add your first developer."

**Active Sprint Card:**
- Sprint name, goal text, date range
- Progress bar: completedStoryPoints / totalStoryPoints %
- "X of Y tasks done"
- [View Board] button → /projects/:projectId/board
- [View Analytics] button → /analytics
- AI Risk Badge (Phase 1: hidden, Phase 2: LOW/MEDIUM/HIGH colored badge)
- If no active sprint: "No active sprint. Go to Backlog to start one."

**Pending Developer Approvals (if any):**
- Small alert banner: "X developers waiting for approval"
- [Review Now] → /team?tab=pending

---

### 3.7 — PM PROJECTS PAGE (/projects when role=pm)

**Top Bar:**
- "My Projects" heading
- Grid/List toggle
- [+ New Project] button → opens CreateProjectModal

**CreateProjectModal:**
- Title (required)
- Description (optional)
- Color picker (6 preset colors + custom)
- Status: Active / Planning
- [Create Project] → POST /api/projects
- On success: navigate to /projects/:id/backlog

**Project Cards (Grid):**
- Color strip at top
- Status badge (Active/Planning/Archived)
- Title, description (truncated to 2 lines)
- "X members" with small avatars
- "Last updated X days ago"
- [Open Backlog] button → /projects/:id/backlog
- [···] dropdown: [Edit Project] [Manage Members] [Archive] [Delete]

**Manage Members Modal:**
- Current members list with their role and remove button
- "Add Member" section: search by email, select role (PM/Developer), [Add]
- Note: can only add users who are in the system

**Empty state:** "No projects yet. Create your first project."

---

### 3.8 — BACKLOG PAGE (/projects/:projectId/backlog)

**This is ONE component used by both PM and Admin (Dev is read-only)**

**Layout:** Two columns — Sprint Panel left (280px) + Task Panel right (remaining)

**Left Column — Sprint Panel:**
```
Header: "Sprints" text + [+] icon button (PM/Admin only)
  → clicking [+] opens CreateSprintModal

Sprint List items (each sprint):
  Sprint name (bold)
  Date range (small gray text)
  Status badge: Planning/Active/Completed
  Issue count
  Progress bar (completed/total story points)
  [Sprint Board →] link

When sprint selected (clicked):
  If status='planning': [Start Sprint ▶] button (PM/Admin only)
  If status='active': [Complete Sprint ✓] button (PM/Admin only) — shown in red
  If status='completed': [View Results] link

"Main Backlog" item at top of list (always shown, always first)

Bottom section: "AI Sprint Insights" card
  Phase 1: lock icon, "Available after Phase 2 setup"
  Phase 2: shows risk score for selected sprint if active
```

**CreateSprintModal:**
- Sprint Title (required, e.g. "Sprint 3 — Auth & Onboarding")
- Sprint Goal (optional)
- Start Date (date picker)
- End Date (date picker)
- Validation: end > start, no overlap with active sprint
- [Create Sprint] → POST /api/sprints
  Body: { projectId, title, goal, startDate: new Date(startDate).toISOString(), endDate: ... }

**Right Column — Task Panel:**
```
Header row:
  Selected sprint/backlog name (bold)
  Issue count
  [Filter ▼] button — filter by type, priority, assignee
  [Sort ▼] button — sort by priority, date created, story points
  [+ New Issue] button (all roles can create issues)

Task Table:
  Columns: # | Type icon | Title | Priority pill | Assignee avatar | Points
  Row hover: shows [···] 3-dot menu
  Row click: opens TaskDetailSlideOver (from right side)

3-dot menu options:
  [Edit Task] → opens TaskDetailSlideOver in edit mode
  [Move to Sprint ▶] → submenu of available sprints (PM/Admin only)
  [Move to Backlog] (if in sprint, PM/Admin only)
  [Delete Task] (PM/Admin only, confirm dialog)

Empty state for backlog: "No issues yet. Create your first issue."
Empty state for sprint: "No issues in this sprint. Drag from backlog or create new."
```

**Task Detail Slide-Over (right side drawer, 480px wide):**
Opens when any task row is clicked. Does not navigate away.
```
Header:
  Task ID (e.g. #AGI-23)
  Task type icon
  [Close ×] button

Body (two columns):
  Left (wider):
    Title (inline editable — click to edit)
    Description (markdown textarea — click to edit)
    Comments section:
      List of comments (avatar, name, text, timestamp)
      "Add comment" input with [Post] button

  Right (narrower, 200px):
    Status dropdown (updates on change via PATCH)
    Priority dropdown (updates on change)
    Assignee dropdown (list of project members)
    Story Points input (1,2,3,5,8,13)
    Estimated Hours input
    Actual Hours (computed, shown as read-only)
    Due Date picker
    Sprint assignment (PM/Admin only)
    Labels input (comma separated)
    Created by, Created at (read-only)

Work Log section (bottom):
  "Log Work" button → expands inline form
  Form: Hours (number), Date (date picker), Description (optional)
  [Save Worklog] → POST /api/tasks/:id/worklog
  Worklog list: shows date, hours, description, logged by
  Delete icon on own worklogs
```

**Dev-specific restrictions in Backlog:**
- Cannot click [+] to create sprint
- Cannot see [Start Sprint] or [Complete Sprint]
- Cannot move tasks between sprints (no sprint assignment in task detail)
- CAN create issues (+ New Issue) — assigned to themselves by default
- CAN click task rows to open detail
- CAN add comments
- CAN log work (only on tasks assigned to them)

---

### 3.9 — SPRINT BOARD PAGE (/projects/:projectId/board)

**This is ONE SharedBoardPage component with role-based permissions prop**

**Top Bar:**
- Sprint selector dropdown (shows active sprint, can switch to view others)
- Sprint dates text
- Member avatars (people in sprint)
- Task count
- [+ Add Task] button (PM/Admin only)
- [Complete Sprint] button (PM/Admin only, red, only when sprint is active)
- AI Risk Badge (Phase 2): small colored pill "RISK: 67%" with info icon

**Kanban Columns (4):**
- To Do | In Progress | Review | Done
- Column header: name + task count
- Cards are draggable

**Task Card:**
```
  Left colored border (by priority: critical=red, high=orange, medium=yellow, low=gray)
  Task title
  Type badge (Story/Bug/Task)
  Bottom row: story points badge | assignee avatar | due date (red if overdue)
  Click card → opens TaskDetailSlideOver
```

**Drag and Drop Rules:**
- PM/Admin: can drag any card to any column
- Developer: can ONLY drag cards where assignee = themselves
- Dragging updates PATCH /api/tasks/:id/status
- After success: queryClient.invalidateQueries(['tasks', sprintId])
- After success: Socket.io emits 'task:status_changed' to project room

**Empty state:** "No active sprint. Go to Backlog to start a sprint."

**Developer restrictions:**
- Cannot see [Complete Sprint] button
- Cannot see [+ Add Task] button
- Can drag only own tasks
- Can click any card to view (read-only for other devs' tasks)
- Can edit only own tasks in slide-over

---

### 3.10 — ANALYTICS PAGE (/analytics) [PM + Admin only]

**Dev redirect:** Developer visiting /analytics → redirect to /my-tasks

**Top Section:**
- Project selector (if admin — see all projects dropdown)
- Sprint selector (shows sprints for selected project)
- Date range note: "Showing Sprint 3 (Apr 1–14)"

**Stats Row (2 cards for selected sprint):**
```
  Card 1: Burndown Rate
    Large % number (completedStoryPoints/totalStoryPoints * 100)
    Trend arrow: up (green) if better than last sprint, down (red) if worse
    Subtitle: "vs X% last sprint"
    
  Card 2: Average Velocity
    Large number (avg story points per sprint)
    Subtitle: "last 5 sprints average"
    Trend: "Improving ↑" or "Declining ↓" or "Stable →"
```

**Charts Row:**
```
  Chart 1 (left): Active Sprint Burndown
    Line chart using Recharts LineChart
    X axis: days (Day 1, Day 2, ...)
    Y axis: story points remaining
    Two lines:
      - Ideal line (dashed, gray): straight decline from total to 0
      - Actual line (solid, indigo): real remaining points per day
    Legend, tooltips on hover
    Data from: GET /api/analytics/burndown/:sprintId
    Empty state: "Select an active sprint to view burndown"
    
  Chart 2 (right): Historical Velocity
    Bar chart using Recharts BarChart
    X axis: sprint names
    Y axis: story points
    Two bars per sprint:
      - Committed (light indigo): totalStoryPoints when sprint started
      - Completed (dark indigo): completedStoryPoints
    Data from: GET /api/analytics/velocity/:projectId
    Empty state: "Complete at least 2 sprints to see velocity trends"
```

**Team Performance Table (below charts):**
```
  Heading: "Team Performance — Sprint 3"
  Columns: Developer | Tasks Assigned | Tasks Done | Story Pts | Avg Hours/Pt | On-Time %
  Data from: GET /api/analytics/team/:projectId
  Highlight row with worst on-time rate in light red
  Highlight row with best velocity in light green
```

**Sprint Health Panel (right sidebar):**
```
  Health Score: big circle gauge 0-100
    0-40: red (Critical)
    41-70: orange (At Risk)
    71-100: green (Healthy)
  
  Breakdown metrics:
    Blocked Tasks: X (red if > 0)
    Idle Tasks (no activity 3+ days): X (orange if > 2)
    Scope Creep: X tasks added after start (yellow if > 0)
    Velocity vs Average: +X% or -X% (green if positive, red if negative)
  
  Data from: GET /api/analytics/sprint-health/:sprintId
  
  Phase 2 addition: "AI Risk Score" section with SHAP factors
```

---

### 3.11 — PM TEAM PAGE (/team) [PM + Admin only]

**PM view (sees only their team):**
```
Header: "My Team" + [+ Add Developer] button + [Create Developer Account] button

Pending Approvals tab (shows if pending > 0):
  List of pending developers
  Each row: Name, Email, "Applied X days ago"
  [Approve] button → PATCH /api/pm/developers/:id/approve
  [Reject] button → DELETE (with confirm)

Active Team tab:
  Developer grid (3 columns):
  Each developer card:
    Avatar circle (initials, random color per user)
    Name (bold)
    Email (small gray)
    Status dot: green=active, gray=inactive
    "X Active Tasks" count
    "Sprint X" current sprint name (or "Not in sprint")
    Progress bar: tasks done / tasks total in current sprint
    
    Action buttons row:
      [View Tasks] → navigates to board filtered by this developer
      [···] dropdown:
        [View Profile] → opens DeveloperProfileModal
        [Change Project Assignment] → opens reassign modal
        [Release Developer] → removes managedBy, confirm dialog
    
  Empty state: "No developers on your team. Add your first developer."

Add Developer Modal (two tabs):
  Tab 1: Create New Account
    Full Name, Email, Password (with generate button + copy)
    Assign to Project dropdown (PM's projects)
    [Create Developer Account] → POST /api/pm/create-developer
    
  Tab 2: Approve Pending Developer
    Search/list of pending developers in system
    [Approve & Add to Team] button
```

**Admin view of /team:** Shows all PMs and all developers globally. Same as Admin Teams page but accessed via /team route for admins.

---

### 3.12 — DEVELOPER: MY TASKS PAGE (/my-tasks) [Developer only]

**This is the developer's main working page**

**Top Section:**
- "My Tasks" heading
- Project selector (shows projects they are a member of)
- Sprint selector (shows active sprint for selected project)
- Stats row: My Tasks (total assigned) | In Progress | Done This Sprint

**Task List:**
```
  Grouped by status: In Progress first, then To Do, then Review, then Done
  
  Each task row:
    Priority colored dot (left)
    Type icon (Story/Bug/Task)
    Task title
    Sprint name badge
    Story points badge
    [Update Status ▼] dropdown: To Do, In Progress, Review, Done
      → calls PATCH /api/tasks/:id/status immediately on select
    [Log Work] button → inline form expands below
    [View Details] → opens TaskDetailSlideOver
```

**Blocked Tasks Alert (if any):**
- Red banner: "You have X blocked tasks. Click to view."
- Shows blocked tasks highlighted

**Log Work Inline Form:**
```
  Hours: number input
  Date: date picker (default today)
  Note: text input
  [Save] → POST /api/tasks/:id/worklog
  [Cancel]
```

**Empty state:** "No tasks assigned to you in this sprint."

---

### 3.13 — DEVELOPER: SPRINT BOARD (/projects/:projectId/board when role=developer)

Same SharedBoardPage component but with:
- Can only drag own cards
- Cannot see Complete Sprint button
- Cannot add tasks
- Can click any card to view (read-only for others)
- Can edit/log work on own tasks only

---

### 3.14 — DEVELOPER: WORK LOG PAGE (/worklog) [Developer only]

**Layout:** Simple list + summary

**Stats Row:**
- Hours This Sprint: sum of all worklogs in current sprint
- Hours This Week: sum of worklogs for last 7 days
- Avg Hours/Task: totalHours / completedTasks

**Work Log Table:**
```
  Columns: Date | Task Name | Project | Sprint | Hours | Notes | Actions
  Group by: week (collapsible)
  Row actions: [Edit] [Delete]
  
  [+ Log Work] button at top right:
    Modal: Select Task (dropdown of assigned tasks), Hours, Date, Description
    → POST /api/tasks/:taskId/worklog
```

**Empty state:** "No work logged yet. Start logging your hours."

---

### 3.15 — NOTIFICATIONS PAGE (/notifications) [All roles]

**Layout:**
```
  Header: "Notifications" + [Mark all read] button + unread count badge

  Filter tabs: All | Unread | Task | Sprint | Team

  Notification list (newest first):
    Each item:
      Icon (colored by type: blue=info, red=risk, green=success, orange=warning)
      Title (bold if unread)
      Message text
      Timestamp (relative: "2 hours ago")
      [Mark read] on hover
      Click → navigate to notification.link, mark as read

    Grouped: Today | Yesterday | This Week | Older

  Empty state: "You're all caught up! No notifications."
```

**Real-time:** Socket.io listener for 'notification:new' — adds to list and increments badge without page reload

---

### 3.16 — PROFILE PAGE (/profile) [All roles]

```
  Avatar section:
    Large avatar circle with initials or photo
    [Change Avatar] button → file upload (image only, max 2MB)
    
  Personal Info form:
    Full Name (editable)
    Email (read-only — contact admin to change)
    Role (read-only badge)
    Member Since (read-only)
    [Save Changes] → PATCH /api/auth/me
    
  Change Password section:
    Current Password
    New Password (min 8 chars)
    Confirm New Password
    [Update Password] → POST /api/auth/change-password
    
  Notification Preferences:
    Toggle: Email notifications (UI only, not functional in Phase 1)
    Toggle: Sprint alerts
    Toggle: Task assignments
    
  Danger Zone (bottom, red outlined section):
    "Deactivate Account" → shows message "Contact your admin to deactivate your account"
    (Do not allow self-deactivation — must go through admin)
```

---

### 3.17 — AI INSIGHTS PAGE (/ai-insights) [Admin + PM only]

**Phase 1 (current):**
```
  Clean placeholder — do NOT show N/A or broken data
  
  Layout:
    Header: "AI Sprint Intelligence"
    
    Status banner (amber): "AI Intelligence Layer — Phase 2"
    Subtitle: "Sprint data is being collected. AI predictions will activate once Phase 2 is deployed."
    
    Preview cards (grayed out, locked appearance):
      [Lock icon] Sprint Risk Score — "Predicts sprint failure probability"
      [Lock icon] Effort Estimator — "Predicts task completion time"
      [Lock icon] SHAP Explanations — "Explains why risk is high in plain English"
      [Lock icon] Sprint Autopsy — "Post-sprint AI analysis"
    
    Progress indicator: "X sprints completed — AI trains on 10+ sprints"
    Shows actual count from DB so PM can see progress toward AI activation
```

**Phase 2 (what to build later):**
```
  Sprint selector (same as analytics page)
  
  Hero Card: Sprint Risk Score
    Large radial gauge 0-100 (green=low, orange=medium, red=high)
    Risk level label: LOW / MEDIUM / HIGH
    Confidence: "87% confident"
    Last analyzed: "2 hours ago" + [Refresh] button
    
  SHAP Factors Card:
    "Why this risk?" heading
    Horizontal bar chart showing top 5 factors:
      Factor name | Impact bar | +X% or -X%
    E.g.:
      Blocked tasks        ████████ +34%
      Velocity drop        ██████   +28%
      Scope creep          ████     +18%
      Idle tasks           ███      +12%
      Overrun estimates    ██       +8%
    
  Effort Estimation Card:
    Table of tasks in sprint:
    Columns: Task | Estimated Pts | AI Predicted Hours | Actual Hours | Variance
    Highlight rows where variance > 50% in red
    
  Sprint Health Timeline:
    Line chart showing risk score progression day by day through the sprint
    
  Recommendations Card:
    3 actionable bullets from AI:
    "• Unblock task #47 (API Integration) — blocking 3 other tasks"
    "• Consider removing Story X to reduce scope by 8 points"
    "• Assign idle task #52 to developer B who has capacity"
```

---

### 3.18 — SETTINGS PAGE (/settings) [All roles]

```
  Three sections:
  
  Account Settings:
    (Points to Profile page — "Manage your account details in Profile")
    
  Appearance:
    Theme toggle: Light / Dark (Tailwind dark mode)
    Language: English (only option for now)
    
  About:
    App version
    "AgileAI Phase 1 — Jira Core"
    Phase 2 progress note
```

---

## SECTION 4 — REAL-TIME (SOCKET.IO) EVENT SPECIFICATION

### Server-side rooms
```
  Project room: 'project:{projectId}'
  User room: 'user:{userId}'
  
  On socket connect:
    - Authenticate via JWT token sent in socket handshake auth
    - Join all project rooms for projects user is a member of
    - Join own user room 'user:{userId}'
```

### Events emitted by server
```
  sprint:started
    Room: project:{projectId}
    Payload: { sprintId, sprintName, projectId }
    
  sprint:completed
    Room: project:{projectId}
    Payload: { sprintId, velocity, completionRate }
    
  task:status_changed
    Room: project:{projectId}
    Payload: { taskId, newStatus, changedBy: { name } }
    
  task:updated
    Room: project:{projectId}
    Payload: { taskId, changes }
    
  task:comment_added
    Room: project:{projectId}
    Payload: { taskId, comment: { author: { name }, text } }
    
  notification:new
    Room: user:{userId}
    Payload: { notification object }
    
  sprint:risk_updated (Phase 2 only)
    Room: project:{projectId}
    Payload: { sprintId, riskScore, riskLevel, riskFactors }
```

### Events listened to by client
```
  On 'sprint:started' → invalidate sprint query, show toast "Sprint started!"
  On 'sprint:completed' → invalidate sprint query, show toast
  On 'task:status_changed' → invalidate tasks query (updates board without reload)
  On 'task:updated' → invalidate specific task query
  On 'notification:new' → add to notification list, increment bell badge, show toast
  On 'sprint:risk_updated' → update risk badge on board/backlog header
```

---

## SECTION 5 — STATE MANAGEMENT SPECIFICATION

### authStore (Zustand with persist)
```javascript
{
  user: null,          // { _id, name, email, role, status, avatar }
  token: null,         // JWT string
  isAuthenticated: computed from token !== null,
  
  login: (userData, token) => set(user, token),
  logout: () => {
    set(user: null, token: null)
    localStorage.removeItem('auth-storage')
    navigate('/login')
  },
  updateUser: (updates) => set(user: {...user, ...updates})
}
persist config: { name: 'auth-storage', storage: localStorage }
```

### projectStore (Zustand with persist)
```javascript
{
  activeProjectId: null,
  activeSprintId: null,
  
  setActiveProject: (id) => set(activeProjectId: id),
  setActiveSprint: (id) => set(activeSprintId: id),
  clearProject: () => set(activeProjectId: null, activeSprintId: null)
}
persist config: { name: 'project-storage' }
```

### uiStore (Zustand, no persist)
```javascript
{
  sidebarOpen: true,
  selectedTask: null,
  slideOverOpen: false,
  toasts: [],
  
  toggleSidebar: () => set(prev),
  openTask: (task) => set(selectedTask: task, slideOverOpen: true),
  closeTask: () => set(selectedTask: null, slideOverOpen: false),
  addToast: (toast) => ...,
  removeToast: (id) => ...
}
```

### toastStore (Zustand)
```javascript
Toasts appear bottom-right
Types: success (green), error (red), warning (orange), info (blue)
Auto-dismiss after 4 seconds
Max 3 toasts visible at once
```

### Axios Instance (axiosInstance.js)
```javascript
baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api'

Request interceptor:
  - Get token from authStore
  - Add header: Authorization: 'Bearer ' + token

Response interceptor:
  - On 401: call authStore.logout() → redirects to /login
  - On 500: show error toast "Server error. Please try again."
  - On network error: show error toast "Connection error. Check your server."
```

### React Query Configuration
```javascript
queryClient config:
  staleTime: 30 seconds (data considered fresh for 30s)
  cacheTime: 5 minutes
  retry: 1 (retry failed queries once)
  refetchOnWindowFocus: false (don't refetch when tab regains focus)

Query keys convention:
  ['projects'] — all projects
  ['project', projectId] — single project
  ['sprints', projectId] — sprints for a project
  ['tasks', sprintId] — tasks for a sprint
  ['tasks', 'backlog', projectId] — backlog tasks
  ['analytics', 'burndown', sprintId]
  ['analytics', 'velocity', projectId]
  ['notifications'] — current user notifications
  ['team', 'my-developers'] — PM's developers
  ['admin', 'users'] — all users (admin only)

After every mutation, invalidate:
  Create sprint → invalidate ['sprints', projectId]
  Create task → invalidate ['tasks', sprintId || 'backlog', projectId]
  Update task status → invalidate ['tasks', sprintId], ['analytics', 'burndown', sprintId]
  Start sprint → invalidate ['sprints', projectId], ['analytics', ...]
  Complete sprint → invalidate ['sprints', projectId], ['analytics', 'velocity', projectId]
  Add member → invalidate ['project', projectId]
```

---

## SECTION 6 — ML MODEL SPECIFICATION (PHASE 2 BLUEPRINT)

### Model 1: Sprint Risk Classifier

**Algorithm:** RandomForestClassifier from scikit-learn
**Why:** handles small datasets (50-500 sprints), gives feature importance natively, no hyperparameter obsession needed

**Input features (8 values, pulled from DB):**
```
feature_1: velocity_ratio
  = (current points completed so far) / (avg completed points at same day in last 3 sprints)
  collected from: sprint.completedStoryPoints, historical sprint data
  
feature_2: commitment_ratio
  = sprint.totalStoryPoints / team_average_velocity
  collected from: sprint at creation time
  
feature_3: completion_rate_at_day_N
  = sprint.completedStoryPoints / sprint.totalStoryPoints
  collected from: sprint + tasks status counts
  
feature_4: blocked_ratio
  = count(tasks where isBlocked=true) / sprint.totalTasks
  collected from: tasks collection
  
feature_5: idle_ratio
  = count(tasks where lastActivityAt < now - 3days AND status != 'done') / totalTasks
  collected from: tasks.lastActivityAt
  
feature_6: scope_creep_rate
  = count(tasks added after sprint.startedAt) / original task count
  collected from: tasks.createdAt vs sprint.startedAt
  
feature_7: velocity_delta
  = (last_sprint_velocity - avg_of_3_sprints_before) / avg_of_3_sprints_before
  collected from: completed sprints in same project
  
feature_8: days_elapsed_ratio
  = days since sprint start / total sprint days
  collected from: sprint.startedAt and sprint.endDate
```

**Output:**
```
riskLevel: 'low' | 'medium' | 'high'
riskScore: 0-100 (from predict_proba, multiply by 100)
confidence: 0-1
```

**Training data:**
```
Row = one sprint snapshot at a specific day
Label (y) = did_sprint_succeed: 1 if completedStoryPoints >= 0.8 * totalStoryPoints, else 0

For demo/academic: generate 500 synthetic rows with numpy
  - 60% labeled 0 (failure), 40% labeled 1 (success) — realistic ratio
  - Failure patterns: high blocked_ratio, low velocity_ratio, high scope_creep
  - Success patterns: stable velocity, low blocked, low idle

train_model.py runs this generation and saves model as risk_model.pkl
```

**SHAP Integration:**
```python
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(feature_vector)
# Returns importance per feature
# Convert to human-readable:
feature_names = ['velocity_ratio', 'commitment_ratio', ...]
factors = sorted(zip(feature_names, shap_values[1]), key=lambda x: abs(x[1]), reverse=True)[:5]
```

**Where it shows in UI:**
```
  BacklogPage: risk badge on sprint cards when sprint is active
  SprintBoardPage: risk pill in top bar header
  AIInsightsPage: full risk breakdown with SHAP bars
  Dashboard (PM): Sprint Health card shows health derived from risk score
  Notifications: "Risk Alert — Sprint risk jumped to 74%" notification
```

**When it runs:**
```
  On sprint start: calculate initial risk, store in sprint.aiRiskScore
  Every 6 hours during active sprint: cron job recalculates
  On task status change: recalculate immediately (async, don't block the request)
  On task added/removed from sprint: recalculate
```

### Model 2: Task Effort Estimator

**Algorithm:** GradientBoostingRegressor from scikit-learn (or XGBRegressor from xgboost)
**Why:** best for regression on small tabular datasets, no tuning required

**Input features (6 values):**
```
feature_1: story_points (the PM's estimate)
  
feature_2: task_type_encoded
  story=0, bug=1, task=2, epic=3
  
feature_3: priority_encoded
  low=0, medium=1, high=2, critical=3
  
feature_4: assignee_avg_hours_per_point
  = avg(actualHours / storyPoints) for all completed tasks by this developer
  collected from: tasks.worklogs + tasks.storyPoints for assignee
  default if new developer: team_average_hours_per_point
  
feature_5: description_length_bucket
  0 = no description
  1 = short (< 100 chars)
  2 = medium (100-500 chars)
  3 = long (500+ chars)
  (longer descriptions correlate with underestimated complexity)
  
feature_6: blocked_dependency_count
  = len(task.blockedBy)
```

**Output:**
```
predictedHours: float (e.g. 8.5)
confidenceInterval: [min_hours, max_hours] (e.g. [6, 12])
```

**Where it shows in UI:**
```
  BacklogPage TaskDetailSlideOver:
    "AI Estimate: ~8.5 hours" shown next to Estimated Hours field
    Shown as suggestion, PM/Dev can override
    
  AIInsightsPage Effort Table:
    Columns: Task | Your Estimate | AI Prediction | Variance
    Red highlight on high variance rows
    
  Sprint Planning (when creating sprint):
    Total sprint: "Your team estimated X story points. AI estimates Y total hours."
```

---

## SECTION 7 — EDGE CASES AND VALIDATION RULES

### Authentication Edge Cases
```
  Self-registration as Admin → BLOCKED: remove Admin from role dropdown
  Self-registration as PM → BLOCKED: remove PM from role dropdown
  Pending user tries to login → 403 with clear message
  Suspended user tries to login → 403 with clear message
  Expired JWT → 401 → client calls logout() → redirect to /login
  Multiple tabs: if one tab logs out → other tabs should also log out
    Solution: listen to localStorage 'storage' event in App.jsx
```

### Project/Sprint Edge Cases
```
  Creating sprint with end date before start date → validation error: "End date must be after start date"
  Starting sprint when another sprint already active → 400: "Another sprint is already active for this project"
  Starting sprint with 0 tasks → 400: "Add at least one task before starting sprint"
  Completing sprint → all non-done tasks auto-move to backlog with status reset to 'todo'
  Deleting project with active sprint → BLOCK: "Complete or cancel the active sprint first"
  PM leaving a project (removed from members) → their created sprints stay, their tasks stay
  Developer removed from project → their tasks get unassigned (assignee=null)
```

### Task Edge Cases
```
  Task assigned to user not in project → validation: "Assignee must be a project member"
  Moving task to sprint in different project → BLOCK: impossible by design
  Task in completed sprint → cannot change status (show read-only badge)
  Logging 0 hours → validation error: "Hours must be greater than 0"
  Logging hours on task not assigned to you (Developer role) → BLOCK: "You can only log work on your assigned tasks"
  PM can log work on any task
  Story points: must be 1, 2, 3, 5, 8, or 13 (Fibonacci) — use a select not free input
```

### Role/Permission Edge Cases
```
  Admin tries to delete themselves → BLOCK: "Cannot delete your own account"
  Last admin tries to demote themselves → BLOCK: "System must have at least one admin"
  PM tries to access another PM's team members → BLOCK: only see own managedBy
  Developer tries to change sprint → BLOCK: 403 from backend
  Direct URL access to /admin by non-admin → redirect to /dashboard
  All permission checks happen on BACKEND too — frontend hiding is not enough
```

### Data Consistency Edge Cases
```
  Sprint completedStoryPoints: recompute EVERY time a task status changes
    → On task status PATCH: sum all tasks in sprint where status='done', storyPoints sum
    → Update sprint.completedStoryPoints in same transaction

  Task actualHours: recompute EVERY time worklog is added/deleted
    → On worklog POST/DELETE: sum all worklogs for this task
    → Update task.actualHours in same transaction

  Sprint velocity: set ONLY on sprint complete
    → velocity = completedStoryPoints / totalStoryPoints * 100 (percentage)
    OR velocity = completedStoryPoints (raw points — more standard Agile)
    → Recommendation: use raw story points as velocity for analytics accuracy
```

### UI State Edge Cases
```
  User navigates to /projects/:id/backlog for a project they're not a member of
    → 403 from API → show "You don't have access to this project"
    
  Active project deleted while user is viewing it
    → Socket event or next API call returns 404 → redirect to /projects
    
  Sprint started by PM while developer is viewing backlog
    → Socket 'sprint:started' event → show toast "Sprint started! Refreshing..."
    → invalidate queries
    
  Board loaded with no active sprint
    → Show: "No active sprint. Ask your PM to start a sprint."
    
  Network error during drag-drop
    → Revert card to original column (optimistic rollback)
    → Show error toast "Failed to update task. Please try again."
    
  Two people editing same task simultaneously
    → Last write wins (acceptable for Phase 1 — no conflict resolution needed)
```

---

## SECTION 8 — WHAT TO REMOVE (CLEANUP LIST)

### Remove from codebase entirely:
```
  BacklogPage.jsx (old version) → replaced by updated unified version
  SprintBoardPage.jsx (old version) → replaced by SharedBoardPage.jsx
  PMTeamView.jsx → merged into TeamPage.jsx
  Any hardcoded chart data → replace with API calls
  alert() calls anywhere → replace with toastStore
  console.log in production controllers → remove all
  Any route that shows same content for Developer as PM (see duplicate analysis above)
```

### Remove from UI (wrong place):
```
  AI Risk card on Developer dashboard → Developer should not see AI data
  AI Analytics Panel on Developer dashboard → remove entirely
  "Analytics & Reports" quick link on Developer dashboard → remove
  Register page role dropdown options: Admin, PM → remove, keep only Developer
  Admin self-registration path → must be blocked at backend level
```

---

## SECTION 9 — COMPLETE FILE STRUCTURE (TARGET STATE)

```
agileai/
  client/src/
    pages/
      AuthPage.jsx
      PendingPage.jsx
      DashboardPage.jsx           ← RoleBasedDashboard — renders one of three below
      dashboards/
        AdminDashboard.jsx
        PMDashboard.jsx
        DeveloperDashboard.jsx
      admin/
        AdminPanelPage.jsx        ← tabs: Users, Pending, Create PM, Audit
        AdminTeamsPage.jsx        ← PM hierarchy view
      projects/
        ProjectsPage.jsx          ← PM + Admin, dev redirected
        BacklogPage.jsx           ← shared, dev read-only
      board/
        SharedBoardPage.jsx       ← one component, role prop controls permissions
      analytics/
        AnalyticsPage.jsx         ← PM + Admin only
      team/
        TeamPage.jsx              ← PM sees own team, Admin sees all
      developer/
        MyTasksPage.jsx           ← Developer only
        WorklogPage.jsx           ← Developer only
      AIInsightsPage.jsx
      NotificationsPage.jsx
      ProfilePage.jsx
      SettingsPage.jsx
    
    components/
      layout/
        AdminLayout.jsx
        PMLayout.jsx
        DeveloperLayout.jsx
        RoleBasedLayout.jsx       ← renders correct layout based on role
        Navbar.jsx
      kanban/
        SharedKanbanBoard.jsx     ← one component used by PM and Dev
        KanbanColumn.jsx
        TaskCard.jsx
      task/
        TaskDetailSlideOver.jsx   ← right-side drawer for task details
        TaskRow.jsx               ← row in backlog table, shared
      charts/
        BurndownChart.jsx
        VelocityChart.jsx
        SprintHealthGauge.jsx
        TeamPerformanceTable.jsx
      modals/
        CreateProjectModal.jsx
        CreateSprintModal.jsx
        CreateIssueModal.jsx
        CreateAccountModal.jsx    ← used by Admin (create PM) and PM (create Dev)
        ManageMembersModal.jsx
        ApproveUserModal.jsx
        TaskDetailModal.jsx
      ui/
        StatsCard.jsx             ← shared stat card used on all dashboards
        Badge.jsx
        Button.jsx
        Input.jsx
        Select.jsx
        Avatar.jsx
        Spinner.jsx
        Toast.jsx
        Modal.jsx
        EmptyState.jsx
        RoleBadge.jsx
    
    store/
      authStore.js
      projectStore.js
      uiStore.js
      toastStore.js
    
    api/
      axiosInstance.js
      auth.api.js
      projects.api.js
      sprints.api.js
      tasks.api.js
      analytics.api.js
      admin.api.js
      pm.api.js
      notifications.api.js
      ai.api.js
    
    hooks/
      useAuth.js
      useProject.js
      useSprint.js
      useTask.js
      useSocket.js
      useNotifications.js
      useAI.js
    
    utils/
      roleUtils.js              ← isAdmin(), isPM(), isDeveloper() helpers
      dateUtils.js              ← formatDate, daysAgo, etc
      statusColors.js           ← priority and status color maps
      storyPointOptions.js      ← [1,2,3,5,8,13]
    
    App.jsx                     ← all routes defined here
    main.jsx
  
  server/
    controllers/
      authController.js
      adminController.js
      pmController.js
      projectController.js
      sprintController.js
      taskController.js
      analyticsController.js
      notificationController.js
      aiController.js           ← stubs in Phase 1
    routes/
      auth.routes.js
      admin.routes.js
      pm.routes.js
      project.routes.js
      sprint.routes.js
      task.routes.js
      analytics.routes.js
      notification.routes.js
      ai.routes.js
    models/
      User.model.js
      Organization.model.js
      Project.model.js
      Sprint.model.js
      Task.model.js
      Notification.model.js
      AuditLog.model.js
    middleware/
      auth.middleware.js
      rbac.middleware.js
      errorHandler.middleware.js
    services/
      socketService.js
      notificationService.js
      analyticsService.js
      aiProxy.service.js        ← Phase 1 returns null, Phase 2 calls Python
    utils/
      generateToken.js
      apiResponse.js            ← standard { success, data, message } wrapper
      seedAdmin.js              ← run once on startup to create default admin
    server.js
  
  ai-service/                   ← Phase 2, Python FastAPI
    main.py
    routers/
      risk.py
      effort.py
    models/
      risk_model.pkl
      effort_model.pkl
    train_models.py
    generate_training_data.py
  
  PRD.md                        ← Ralph Loop task list
  prompt.md
  progress.txt
  docker-compose.yml
  .env.example
```

---

## SECTION 10 — IMPLEMENTATION PRIORITY ORDER

**Follow this exact order. Do not skip ahead.**

```
PHASE 0 — Fix Critical Bugs (do these first before any new features):
  [1] Fix sprint creation 400 → change field name in BacklogPage.jsx
  [2] Fix task creation 400 → match field names to taskController
  [3] Fix Sprint Board route in App.jsx
  [4] Fix project visibility → PM and Dev see projects they're members of

PHASE 1A — Role Management (makes app actually usable):
  [5] Remove Admin/PM from self-registration dropdown
  [6] Set new registrations to status='pending' 
  [7] Add PendingPage for pending users
  [8] Admin create PM endpoint + UI in Admin Panel
  [9] PM create Developer endpoint + UI in Team Page
  [10] Admin approve pending developers
  [11] Admin/PM change user roles with confirmation
  [12] Fix Admin Panel role change to persist to database

PHASE 1B — Core Jira Features:
  [13] Task detail slide-over (click task → opens from right)
  [14] Kanban drag and drop (dnd-kit, PATCH status on drop)
  [15] Move task from backlog to sprint (drag or button in task detail)
  [16] Start Sprint button wired correctly
  [17] Complete Sprint button wired correctly

PHASE 1C — Real Data:
  [18] Analytics burndown chart from real API
  [19] Analytics velocity chart from real API
  [20] Sprint health score computed and shown
  [21] Team performance table from real data
  [22] Notification bell wired with Socket.io

PHASE 1D — Polish:
  [23] All dead buttons wired or removed (see dead button list in SECTION 0)
  [24] Empty states on all pages
  [25] Loading spinners on all API calls
  [26] Error toasts on all failures
  [27] Profile page save working
  [28] Settings page theme toggle

PHASE 2 — AI Integration:
  [29] Python FastAPI service setup
  [30] Synthetic training data generation
  [31] Model 1 training (RandomForestClassifier)
  [32] Model 2 training (GradientBoostingRegressor)
  [33] SHAP integration
  [34] /api/ai/predict-risk endpoint real implementation
  [35] /api/ai/estimate-effort endpoint real implementation
  [36] AIInsightsPage full implementation
  [37] Risk badge on Sprint Board and Backlog
  [38] Risk alert notifications via Socket.io
  [39] Effort estimate shown in TaskDetailSlideOver
  [40] Sprint Autopsy after sprint completes
```

---

## SECTION 11 — SEED DATA (FOR DEMO/TESTING)

Run this script on first boot to populate the DB with demo data:

```javascript
// seedAdmin.js — run in server.js on startup if users collection is empty

const adminUser = {
  name: 'System Admin',
  email: 'admin@agileai.com',
  password: bcrypt.hashSync('Admin@123', 10),
  role: 'admin',
  status: 'active',
  createdAt: new Date()
}

// Print credentials to console on first run
console.log('Default admin created: admin@agileai.com / Admin@123')
console.log('CHANGE THIS PASSWORD IMMEDIATELY after first login')
```

---

## END OF BLUEPRINT

This document covers:
- Every page for every role
- Every API endpoint with validation
- Every edge case
- Database schema with all fields
- Real-time socket events
- State management patterns
- ML model specification with exact features
- File structure target state
- Implementation order

Follow Section 10 priority order exactly.
Do not build Phase 2 until Phase 1D is complete.
