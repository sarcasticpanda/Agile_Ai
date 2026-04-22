# AgileAI — AI-Augmented Project Management Platform

> **An enterprise-grade Agile project management system that integrates Machine Learning to predict sprint failures and estimate task effort — built on the MERN stack with a Python AI microservice.**

---

## 📋 Table of Contents

1. [What Is AgileAI?](#what-is-agileai)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [User Roles & Access Control](#user-roles--access-control)
5. [AI & Machine Learning](#ai--machine-learning)
6. [Datasets Used](#datasets-used)
7. [Analytics Dashboard](#analytics-dashboard)
8. [Project Structure](#project-structure)
9. [Quick Start](#quick-start)
10. [Running with Docker](#running-with-docker)
11. [Environment Variables](#environment-variables)
12. [Admin Credentials](#admin-credentials)

---

## What Is AgileAI?

AgileAI is a next-generation Agile project management platform. Unlike standard tools such as Trello or Jira, AgileAI integrates two trained XGBoost machine learning models to:

1. **Predict Sprint Failure** — Before a sprint begins, the AI evaluates its structural composition (blocked tasks, priority distribution, scope churn) and outputs a Risk Score (0–100) with a risk level (Low / Medium / High).
2. **Estimate Task Effort** — Based on the task title, description complexity, type, and priority, the AI predicts how many Story Points a task requires.

The platform is built with a strict **3-role RBAC system** (Admin → PM → Developer), real-time WebSocket collaboration, and a fully interactive analytics dashboard featuring Burndown Charts, Velocity Trends, Member Burnout Risk, and Rule-Based Sprint Delivery Outcomes.

---

## Key Features

| Feature | Description |
|---|---|
| **Role-Based Access Control** | 3-tier hierarchy: Admin, Project Manager, Developer — each with distinct permissions |
| **Sprint Management** | Create, start, and complete sprints with automatic AI risk evaluation on start |
| **Kanban Board** | Drag-and-drop task board shared across roles with permission-aware actions |
| **Backlog Management** | Full CRUD for tasks with sprint assignment, story points, and priority control |
| **AI Sprint Risk Prediction** | XGBoost Classifier predicts sprint failure probability — Macro F1: **0.9995** |
| **AI Task Effort Estimation** | XGBoost Regressor predicts story points — MAE: **3.53 pts** |
| **AI Burnout Detection** | XGBoost Classifier detects developer burnout risk — Macro F1: **0.9884** |
| **Burndown Charts** | Ideal vs. actual story point progress over sprint duration |
| **Velocity Trends** | Bar chart of planned vs. delivered points across completed sprints |
| **Member Effort + Burnout Chart** | Dual-axis bar chart per developer: effort (pts) vs. burnout risk (%) |
| **Sprint Risk Score Chart** | Multi-line time-series chart tracking risk across sprint lifecycle |
| **Rule-Based Delivery Outcome** | Deterministic pass/fail per sprint using 80% delivery threshold |
| **Real-Time Updates** | Socket.io WebSockets for live board and task state sync |
| **Audit Logs** | Complete admin-facing action log for all user and system events |
| **Notifications** | In-app notifications for task assignment, sprint events, approvals |
| **Developer Free Pool** | Pending-state registration; developers are approved and "adopted" by PMs |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI framework (Vite-based) |
| Vite | 5.x | Build tool and dev server |
| Tailwind CSS | 3.x | Utility-first CSS styling |
| Recharts | 2.x | All dashboard charts (Line, Bar, Pie) |
| Zustand | 4.x | Global state management |
| TanStack Query | 5.x | Server data fetching, caching, sync |
| Socket.io-client | 4.x | Real-time WebSocket events |
| React Router | 6.x | Client-side routing |
| Lucide React | latest | Icon library |
| Axios | 1.x | HTTP client with interceptors |

### Backend (Node.js)
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express.js | 4.x | REST API framework |
| MongoDB | 7.x | NoSQL document database |
| Mongoose | 8.x | ODM (Object Document Mapper) |
| Socket.io | 4.x | WebSocket server for real-time events |
| JSON Web Tokens (JWT) | — | Stateless authentication |
| bcryptjs | — | Password hashing |
| express-rate-limit | — | DDoS / brute-force protection |

### AI Microservice (Python)
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | AI service runtime |
| FastAPI | 0.111+ | Async REST API for inference endpoints |
| XGBoost | 2.x | Core ML engine (Classifier + Regressor) |
| scikit-learn | 1.4+ | Preprocessing, CV, metrics |
| imbalanced-learn | 0.12+ | SMOTE for class imbalance correction |
| Optuna | 3.x | Bayesian hyperparameter optimization |
| SHAP | 0.45+ | Feature importance / explainability |
| Pandas | 2.x | Data loading and feature engineering |
| NumPy | 1.26+ | Numerical operations |
| joblib | 1.3+ | Model serialization (.pkl) |
| Uvicorn | 0.29+ | ASGI server for FastAPI |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker & Docker Compose | Container orchestration for all 4 services (client, server, ai-service, mongodb) |
| MongoDB Docker image | Persistent database via named volume |

---

## User Roles & Access Control

### Admin
- **Created by:** Database seed on first boot (cannot self-register)
- **Access Scope:** Full system-wide visibility — all projects, all users, all audit logs
- **Powers:**
  - Create Project Manager accounts
  - Suspend, delete, or change the role of any user
  - View and manage all projects across the platform
  - Access audit logs for all system actions
  - View executive analytics overview across all PMs
  - Approve or reject pending developer registrations

### Project Manager (PM)
- **Created by:** Admin only — no public registration
- **Access Scope:** Projects they own or are a member of; developers they manage
- **Powers:**
  - Create and manage projects (title, description, color, status)
  - Create sprints and set sprint goals, dates, and story point targets
  - **Start** and **Complete** sprints (triggers AI risk evaluation on start)
  - Add/remove team members to projects
  - Approve pending developer registrations
  - Assign tasks and manage the backlog
  - View full analytics including Team Burnout and Velocity data
  - Assign developers to tasks; create developer accounts directly

### Developer
- **Created by:** Self-registration at `/register` OR created directly by a PM
- **Access Scope:** Only projects they are a member of; only tasks assigned to them
- **Status on Registration:** `pending` — blocked to a holding page until approved
- **Powers:**
  - Move tasks to In Progress, Review, and Done on the Kanban board
  - Add comments and log work hours (worklogs) to assigned tasks
  - View their own task list and sprint board
  - View their own analytics (personal effort, completion rate)
  - Cannot modify sprint dates, create sprints, or access other developers' data

### The Free Pool
Developers who register but are not yet approved exist in a **"Free Pool"** — their `status = pending` and `managedBy = null`. A PM or Admin must explicitly approve them, linking them to a PM's team. If that PM is removed, developers safely return to the Free Pool rather than losing access permanently.

---

## AI & Machine Learning

The platform uses **3 trained XGBoost models** served via a Python FastAPI microservice.

### Model 1 — Sprint Risk Classifier (`risk_model.pkl`)
- **Algorithm:** XGBoost Classifier
- **Input Features (10):**
  - `blocked_ratio` — % of tasks blocked by other unfinished tasks
  - `blocking_ratio` — % of tasks blocking others
  - `scope_creep_rate` — % of tasks with >1 description change
  - `high_priority_ratio` — % of tasks marked Critical or Blocker
  - `avg_dependency_links` — normalized average issue link count
  - `bug_ratio` — % of tasks typed as Bug
  - `churn_ratio` — combined priority + description change rate
  - `sprint_size_normalized` — sprint task count normalized to max 30
  - `avg_team_burnout_score` — team average burnout (0–100)
  - `max_dev_burnout_score` — highest individual burnout score
- **Output:** Risk score (0–100) + risk level (`low` / `medium` / `high`)
- **Training technique:** SMOTE (class balance) + StratifiedKFold(5) + Optuna (100 trials Bayesian optimization)
- **Evaluation metric:** Macro F1-Score
- **Achieved score:** **F1 = 0.9995**

### Model 2 — Task Effort Regressor (`effort_model.pkl`)
- **Algorithm:** XGBoost Regressor
- **Input Features (4):**
  - `type_encoded` — task type as numeric (Bug=0, Story=1, Task=2, Feature=3)
  - `priority_encoded` — priority as numeric (Low=0, Medium=1, High=2, Critical=3)
  - `desc_bucket` — description length bucket (0=None, 1=Short, 2=Medium, 3=Long)
  - `title_length_norm` — title character length normalized 0–1
- **Output:** Predicted Story Points (continuous, 1–40 range)
- **Training technique:** KFold(5) + Optuna (100 trials)
- **Evaluation metric:** Mean Absolute Error (MAE)
- **Achieved score:** **MAE = 3.53 story points**

### Model 3 — Developer Burnout Classifier (`burnout_model.pkl`)
- **Algorithm:** XGBoost Classifier
- **Classes:** `low` / `medium` / `high` burnout risk
- **Training:** 224 rows with manual labels; class distribution: Low=109, Medium=50, High=65
- **Evaluation metric:** Macro F1-Score
- **Achieved score:** **F1 = 0.9884**

### Why XGBoost?
Our sprint features are highly structured tabular data (ratios, counts, normalized values). XGBoost outperforms Deep Neural Networks on tabular data, requires fewer computational resources, and provides explicit Feature Importance — allowing the system to explain *why* a sprint is at risk.

### Training Pipeline Techniques
- **SMOTE** — Synthetic Minority Over-sampling to address class imbalance (far more successful sprints than failed ones in historical data)
- **StratifiedKFold(5)** — Cross-validation while preserving class ratios; SMOTE applied inside each fold to prevent data leakage
- **Optuna (Bayesian optimization)** — Intelligent hyperparameter search over `n_estimators`, `max_depth`, `learning_rate`, `subsample`, `colsample_bytree` — 100 trials per model

---

## Datasets Used

### Dataset 1 — Sprint Risk (IEEE TSE 2017)
- **Source:** Morakotch agile sprints dataset — IEEE Transactions on Software Engineering 2017
- **Projects:** Apache, JBoss, JIRA, MongoDB, Spring Framework
- **Raw format:** Issue-level CSVs with `boardid`, `sprintid`, `type`, `priority`, `no_issuelink`, `no_blocking`, `no_blockedby`, `no_priority_change`, `no_des_change`
- **Feature engineering:** `pandas.groupby('sprintid')` compresses hundreds of individual task rows into a single sprint-level profile with derived ratio features
- **Label:** Composite risk score using weighted combination of blocked_ratio (35%), scope_creep_rate (30%), high_priority_ratio (20%), churn_ratio (15%) — binarized at 40th percentile

### Dataset 2 — Story Point Estimation (IEEE TSE 2018)
- **Source:** Morakotch story point dataset — IEEE Transactions on Software Engineering 2018
- **Projects:** Appcelerator, Bamboo, Mesos, Moodle, Mule, Titanium, JiraSoftware
- **Raw format:** Issue-level CSVs with `issuekey`, `title`, `description`, `storypoint`
- **Feature engineering:** Text data converted to quantitative features — normalized title length, description length bucket, type inferred from title keywords, priority inferred from description keywords
- **Label:** `storypoint` (continuous, filtered to 1–40 range)

---

## Analytics Dashboard

The Analytics page (`/analytics`) is accessible to Admin and PM roles. It renders different views by role:

### Admin View
- **Executive Overview** — Organization-wide stats: Total Velocity, Completion Rate, Blockers, Cycle Time
- **PM Analytics Scopes** — Admin can select any PM card to view that PM's project analytics exactly as they see it
- **Organization Performance Chart** — Bar chart of planned vs. delivered story points aggregated across all projects

### PM / Project View (also accessible by Admin via PM scope)
- **Sprint Selector** — Dropdown to select a sprint and filter all charts
- **Risk Score by Sprint** — Multi-line chart showing risk score trajectory (Day 1 → Mid-Sprint → End-Sprint) per sprint
- **Rule-Based Delivery Outcome** — Bar chart showing pass/fail for each sprint (80% delivery threshold rule)
- **Member Effort + Burnout Risk** — Dual-axis bar chart: left axis = completed story points per developer; right axis = burnout risk % (0–100)
- **Velocity Trends** — Bar chart of planned vs. delivered points per completed sprint
- **Member Effort + Burnout Snapshot** — Card grid per team member showing effort, logged hours, burnout %, and completion rate progress bar

---

## Project Structure

```
Agile_Ai/
├── agileai/                    # Main application
│   ├── client/                 # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/          # All page components (15 pages)
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── api/            # Axios API modules
│   │   │   ├── store/          # Zustand global state stores
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   └── utils/          # Helper utilities
│   │   ├── Dockerfile          # Frontend Docker image
│   │   └── package.json
│   ├── server/                 # Node.js + Express backend
│   │   ├── controllers/        # Route handler logic
│   │   ├── routes/             # Express route definitions
│   │   ├── models/             # Mongoose schema models
│   │   ├── middleware/         # auth, rbac, rateLimiter
│   │   ├── services/           # AI integration, email, socket
│   │   ├── utils/              # Helper utilities
│   │   ├── server.js           # Entry point
│   │   └── Dockerfile          # Backend Docker image
│   └── docker-compose.yml      # Orchestrates all 4 services
├── ai-service/                 # Python FastAPI AI microservice
│   ├── api.py                  # FastAPI inference endpoints
│   ├── train_models.py         # Sprint Risk + Effort training pipeline
│   ├── train_burnout_model.py  # Burnout model training pipeline
│   ├── models/                 # Serialized .pkl model artifacts
│   │   ├── risk_model.pkl      # Sprint Risk Classifier
│   │   ├── effort_model.pkl    # Task Effort Regressor
│   │   ├── burnout_model.pkl   # Burnout Risk Classifier
│   │   └── metrics.json        # Achieved evaluation metrics
│   ├── requirements.txt
│   └── Dockerfile              # AI service Docker image
├── models/                     # Top-level model artifact copies
├── docs/                       # Testing runbooks and documentation
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB running locally on port 27017

### 1. Start the Backend
```powershell
cd agileai/server
npm install
node server.js
```
Server runs on: `http://localhost:5001`

### 2. Start the Frontend
```powershell
cd agileai/client
npm install
npm run dev
```
Client runs on: `http://localhost:5173`

### 3. Start the AI Service (optional — needed for live predictions)
```powershell
cd ai-service
pip install -r requirements.txt
python api.py
```
AI service runs on: `http://localhost:8001`

---

## Running with Docker

Docker Compose orchestrates all 4 services (client, server, ai-service, mongodb) in a shared network:

```powershell
cd agileai
docker-compose up --build
```

| Service | Port | Description |
|---|---|---|
| Client (React) | 5173 | Frontend UI |
| Server (Express) | 5001 | REST API + WebSocket |
| AI Service (FastAPI) | 8001 | ML inference endpoints |
| MongoDB | 27017 | Database |

> **Note:** Docker is installed and confirmed (v29.3.1). The `docker-compose.yml` is the recommended way to run the full stack for demos.

---

## Environment Variables

### `agileai/server/.env`
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/agileai
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8001
```

### `agileai/client/.env`
```env
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

### `ai-service/.env`
```env
API_PORT=8001
MONGODB_URI=mongodb://localhost:27017/agileai
MODELS_DIR=./models
```

---

## Admin Credentials

To log in as an administrator for testing without creating a new setup:

- **Email:** `freshadmin@agileai.com`
- **Password:** `password123`

> The admin account is seeded automatically into the database on first boot. No manual creation is needed.

---

## What This Project Does NOT Use

The following were considered but **not included** in this project:

- ❌ **Deep Neural Networks / PyTorch / TensorFlow** — XGBoost outperforms DNNs on tabular data
- ❌ **NLP / Text Embeddings** — Text is converted to numerical features (length, buckets, keywords) rather than using embedding models
- ❌ **Redis / caching layer** — Not required at current scale
- ❌ **GraphQL** — REST API is sufficient for the data access patterns
- ❌ **Kubernetes / Helm** — Docker Compose handles orchestration at this scale
- ❌ **CI/CD pipelines** — Not configured; manual deployment
- ❌ **Multi-tenancy / Organization isolation** — Organization schema is designed but single-org setup is used for academic demo
- ❌ **OAuth / Social login** — JWT email/password authentication only
- ❌ **Email service** — Notifications are in-app only; no SMTP configured
- ❌ **PostgreSQL / relational DB** — MongoDB chosen for schema flexibility with nested sprint/task data

---

*AgileAI — Machine Learning meets Agile. Built for academic demonstration and enterprise Agile simulation.*
