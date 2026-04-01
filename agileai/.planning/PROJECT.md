# AgileAI — GSD Project Context

## What This Is
A MERN stack Jira-clone with AI sprint risk prediction.
Three user roles: Admin, PM (Project Manager), Developer.
The AI part (Phase 2) predicts sprint failure probability in real-time with
explainable reasons (SHAP-style), so PMs can act before a sprint goes wrong.

## Current Status
Phase 1 (Jira core): ~57% complete.
Phase 2 (Python AI): not started.

## Tech Stack
- Frontend: React 18 + Vite — runs on port 5173
- Backend: Node.js + Express — runs on port 5001
- Database: MongoDB — database name: agileai
- State management: Zustand (authStore, uiStore)
- Server state: React Query v5 (@tanstack/react-query)
- Styling: Tailwind CSS (custom design system)
- Auth: JWT stored in localStorage

## Directory Structure
```
agileai/
├── client/                   ← Vite React app
│   └── src/
│       ├── App.jsx           ← Routes config
│       ├── store/authStore.js← Zustand auth state
│       ├── api/              ← Axios API functions
│       ├── hooks/            ← React Query hooks (useTask, useSprint, etc.)
│       ├── pages/            ← All page components
│       └── components/       ← Shared UI components
├── server/                   ← Express API
│   ├── server.js             ← Entry point
│   ├── controllers/          ← Business logic
│   ├── models/               ← Mongoose schemas
│   ├── routes/               ← API route definitions
│   └── middleware/           ← Auth, rate limiting
└── .planning/                ← GSD planning files (this folder)
```

## DO NOT TOUCH
- server/.env (MongoDB URI, JWT secret, PORT=5001)
- server/init_db.js
- Any MongoDB connection code
- Port numbers (5001 backend, 5173 frontend)

## Verified Working (Do Not Break These)
- User registration and login (all 3 roles)
- JWT authentication middleware
- Dashboard with role-based UI per role
- Admin Panel (/admin) — admin-only access
- Role-based sidebar (shield icon admin-only)
- New Project button hidden from Developer
- Project creation (Admin + PM can create)
- Backlog page loads

## Test Accounts
- Admin:     freshadmin@test.com / Test1234!
- PM:        freshpm3@test.com / Test1234!
- Developer: freshdev@test.com / Test1234!

## API Base URL
Frontend calls: http://localhost:5001/api
Auth header:    Authorization: Bearer <jwt_token>

## Critical API Contracts

### Sprints
POST /api/sprints
Body: { title, goal, startDate, endDate, projectId }   ← NOTE: projectId NOT project

### Tasks
POST /api/tasks
Body: { title, type, status, priority, storyPoints, projectId, sprintId }

### Project Members
POST /api/projects/:id/members
Body: { email, role }
