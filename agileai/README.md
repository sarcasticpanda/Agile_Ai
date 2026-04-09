# AgileAI - Phase 1 (Jira Core)

AgileAI is a comprehensive project management web application built with the MERN stack. Designed with a forward-looking architecture, Phase 1 delivers robust Jira-style core functionality (Projects, Backlogs, Sprints, Kanban Boards, Role-based Access, Analytics), explicitly wired to eagerly accept a Python AI microservice in Phase 2.

## 🚀 Features (Phase 1)
- **Authentication & RBAC**: JWT-based auth with User, Project Manager, and System Admin roles.
- **Projects & Sprints**: Create projects, form teams, build product backlogs, and plan iterations.
- **Kanban Board**: Drag-and-drop task progression mapped strictly to Agile flows (To Do, In Progress, Review, Done).
- **Analytics**: Real-time burndown charts and velocity tracking via Recharts.
- **Real-time Sync**: Socket.io integration pushes state updates across connected clients instantly.
- **AI-Ready Hooks**: Database schemas and frontend interfaces (stubs) prepared for intelligent sprint estimation and risk prediction.

## 🛠 Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand, React Query v5, React Router v6, dnd-kit, Recharts.
- **Backend**: Node.js 20, Express 5, Mongoose 8, Socket.io, JSON Web Tokens (JWT).
- **Database**: MongoDB (via Docker).
- **DevOps**: Docker & Docker Compose for normalized environment provisioning.

---

## 🏃‍♂️ How to Run Locally

### Prerequisites
- [Docker & Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.
- [Node.js 20+](https://nodejs.org/) installed globally (for local dev script execution).

### 1. Clone & Enter Directory
Ensure you are in the `agileai` subfolder containing the `docker-compose.yml` file:
```bash
cd agileai
```

### 2. Environment Configuration
Copy the sample environment variables:
```bash
cp .env.example .env
```
*(Optionally, modify the generated `.env` file for custom ports or JWT secrets)*

### 3. Start the Application via Docker Compose
Run the following command to build the images and start the MongoDB database, Node server, and Vite client in tandem:
```bash
docker-compose up --build
```

### 4. Access the Ports
Once the containers report they are successfully running, open your browser:
- **Frontend / Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **MongoDB**: `mongodb://localhost:27017`

### 5. Using the App
1. At the **Login Page**, toggle to "Sign Up" to create your first administrative user.
2. The first registered user assumes the `admin` global role automatically (or manually set in MongoDB).
3. Create a Project via the Dashboard or Projects page.
4. Navigate to the Backlog, populate Issues, construct a Sprint, and hit **Start Sprint**.
5. Switch to the Sprint Board to utilize the Drag-and-Drop Kanban columns.

---

### ⚡️ Running Without Docker (Direct Node + Mongo)
If you already have MongoDB running locally and prefer to execute the services without Docker, follow these steps instead:

1. **Environment file**
	```bash
	cd agileai
	cp .env.example .env
	```
	Adjust `PORT`, `CLIENT_URL`, or `MONGODB_URI` inside `.env` if you need custom ports/databases.

2. **Install dependencies**
	```bash
	cd server && npm install
	cd ../client && npm install
	```
	The client installation pulls in Tailwind CSS plus the bundled plugins (`@tailwindcss/forms` and `@tailwindcss/typography`).

3. **Start MongoDB**
	Ensure a local mongod is listening on `mongodb://localhost:27017`. Compass or `mongosh` can confirm.

4. **Run the API server** (from `agileai/server`)
	```bash
	npm run dev
	```
	The server uses `PORT` from `.env` (defaults to 5000). If that port is occupied, temporarily set `PORT=5001` before the command.

5. **Run the Vite client** (from `agileai/client`)
	```bash
	npm run dev
	```
	Vite reads `VITE_API_URL` from `.env` or defaults to `http://localhost:5000/api`. Update the value when you change the backend port.

6. **Visit the app**
	- UI → whatever port Vite reports (default 5173).
	- API health check → `curl http://localhost:<PORT>/` should print `AgileAI API Phase 1 is running...`.

### AI Retraining Data Export (Phase 4 kickoff)
To start retraining work, export production-shaped datasets from MongoDB:

1. Open a terminal in `agileai/server`
2. Run:
	```bash
	npm run export:training-data
	```

This command writes CSV files into `../ai-service/data_exports/`:
- `risk_training_from_mongo_<timestamp>.csv`
- `effort_training_from_mongo_<timestamp>.csv`
- `burnout_features_unlabeled_<timestamp>.csv`
- `export_summary_<timestamp>.json`

Notes:
- Burnout exports are intentionally unlabeled (`burnout_label` empty) by default.
- You can train burnout with manual labels, or use the controlled heuristic auto-label pipeline.
- You can override output path with `AI_EXPORT_DIR`.
- You can override burnout window size with `BURNOUT_WINDOW_DAYS` (default 30).

### AI Candidate Retraining Runner (Phase 4 Task 3)
After export, train versioned candidate models without overwriting production by default:

1. Open a terminal in `agileai/server`
2. Run:
	```bash
	npm run retrain:candidate
	```

What it does:
- loads the existing base training datasets from `ai-service/repo_cache`,
- appends the latest exported Mongo CSVs from `ai-service/data_exports`,
- trains risk + effort models into a versioned candidate folder:
	`../ai-service/models/candidates/candidate_<timestamp>_<version>/`
- writes `candidate_manifest.json` + `metrics.json` in that folder.

Important safety behavior:
- production model files in `ai-service/models/` are not touched by default.
- to promote a candidate into production (with automatic backup), run:
	```bash
	npm run retrain:promote
	```

Advanced usage:
- run directly with custom trial count:
	```bash
	python ../ai-service/retrain_candidates.py --use-exported-data --trials 10
	```
- omit export data (base datasets only): remove `--use-exported-data`.

### Burnout Model Training (Phase 4 Task 4)
Train the missing burnout model so all three AI model pipelines are active (risk, effort, burnout):

1. Open a terminal in `agileai/server`
2. Run:
	```bash
	npm run retrain:burnout
	```

What this does:
- loads latest `burnout_features_unlabeled_*.csv` export,
- builds labels from curated `burnout_label` if present,
- otherwise uses an explicit heuristic auto-label strategy,
- trains and writes:
	- `../ai-service/models/burnout_model.pkl`
	- `../ai-service/models/burnout_features.pkl`
	- `../ai-service/models/burnout_metadata.json`
	- `../ai-service/models/burnout_metrics.json`

Then run full Phase-4 retrain pipeline in one command:
	```bash
	npm run retrain:all
	```

This runs export + candidate retrain (risk/effort) + burnout retrain.

### AI Reality Verification (no static placeholders)
To validate that website-facing AI values come from live model predictions and not static stubs:

1. Ensure backend (`5001`) and AI service (`8001`) are running.
2. Run from `agileai/server`:
	```bash
	npm run verify:ai-reality
	```

This check will:
- create controlled project/sprint/tasks,
- run effort predictions for varied task inputs,
- assert outputs are not constant,
- verify persisted AI fields on Task/Sprint,
- mutate sprint risk inputs and verify risk features react,
- verify insights endpoint returns model-derived factors.

## 🏗 Architecture Blueprint (Preparing for Phase 2)
The codebase strictly isolates `aiProxy.service.js` and `ai.routes.js`. Currently, they simulate analytical delays and return hardcoded mock intelligence (found inside `AnalyticsPage` and `BacklogPage` UI badging). 

In Phase 2, `aiProxy` will reroute HTTP queries directly to the Python FastAPI microservice listed in `docker-compose.yml` (currently heavily commented out).

### Folder Structure Overview
```text
agileai/
├── client/              # React/Vite SPA
│   ├── src/api/         # Axios wrappers (auth, projects, tasks, ai)
│   ├── src/components/  # UI primitives (Buttons, Modals, Kanban core)
│   ├── src/hooks/       # React Query data fetching & Socket logic
│   ├── src/pages/       # Top-level route modules
│   └── src/store/       # Zustand Global State
├── server/              # Node/Express API
│   ├── controllers/     # Business logic handlers
│   ├── middleware/      # Auth & Role guards, global error catchers
│   ├── models/          # Mongoose Schemas (Task, Sprint, etc.)
│   ├── routes/          # API Definition paths
│   └── services/        # Abstractions (Socket, Analytics, AI stubs)
└── docker-compose.yml   # Orchestration mapping
```
