# AGILEAI — COMPLETE VIVA DOCUMENTATION & DATASET REPORT
**Version:** 1.0 (Final Viva Preparation Document)
**Date:** April 2026
**Target Audience:** Project Examiners, Technical Evaluators, and Team Members

---

## TABLE OF CONTENTS
1. [Executive Summary & Core Objectives](#1-executive-summary--core-objectives)
2. [The 3-Phase System Architecture](#2-the-3-phase-system-architecture)
3. [User Roles, Hierarchy, & "The Free Pool"](#3-user-roles-hierarchy--the-free-pool)
4. [Backend Infrastructure & API Design](#4-backend-infrastructure--api-design)
5. [Database Schema & Data Relationships](#5-database-schema--data-relationships)
6. [Advanced Analytics & Metric Formulas](#6-advanced-analytics--metric-formulas)
7. [Machine Learning Pipeline (The AI Brain)](#7-machine-learning-pipeline-the-ai-brain)
8. [The Datasets: Origins, Raw Structure, & Feature Engineering](#8-the-datasets-origins-raw-structure--feature-engineering)
9. [Microservices Integration: Node.js ↔ Python](#9-microservices-integration-nodejs--python)
10. [Comprehensive Viva Questions & Defense Answers](#10-comprehensive-viva-questions--defense-answers)

---

<br><br>

## 1. EXECUTIVE SUMMARY & CORE OBJECTIVES

AgileAI is a next-generation project management platform. Traditional Agile tools (like standard Jira or Trello) rely entirely on human intuition to estimate task duration and predict whether a sprint will succeed. AgileAI solves this fundamental flaw by integrating **Machine Learning (XGBoost)** to evaluate the structural integrity of sprints and automatically predict effort metrics.

**Core Innovation:** 
By parsing historical enterprise data from some of the world's most successful open-source projects, AgileAI actively intercepts the "Sprint Planning" phase to warn Project Managers of statistical risks (like overlapping dependencies or high-priority churn) before the sprint even begins.

<br><br>

## 2. THE 3-PHASE SYSTEM ARCHITECTURE

To ensure maximum stability and modularity, the project development was mapped into three logical phases. This separation-of-concerns architecture is a major defense point.

### Phase 1: The MERN Engine (Foundation)
This phase established the platform's traditional components. 
- **MongoDB:** Houses the NoSQL document data (Users, Projects, Sprints, Tasks).
- **Express.js & Node.js:** Forms the primary REST API monolithic gateway.
- **React (Vite) & Tailwind CSS:** The client-side application interface featuring global state management via Zustand.
- **Features Implemented:** Role-Based Access Control (RBAC), JWT authentication, Sprint Kanban boards, and task CRUD operations.

### Phase 2: AI & Machine Learning Integration (The Brains)
This phase transforms the platform from a basic tracker into a predictive engine.
- **Python ML Microservice:** Hosted via a lightweight bridge (Flask/FastAPI or spawned child processes), disconnected from the Node main thread to prevent blocking the event loop.
- **Model 1 (Sprint Risk Classifier):** Analyzes mathematical ratios of sprint tasks to assign a failure risk score (0-100%).
- **Model 2 (Task Effort Regressor):** Reads textual representations of tasks to estimate Story Points.
- **Integration:** The Node.js server transmits structured JSON payloads to Python, receiving predictions back to store in MongoDB.

### Phase 3: Real-Time Analytics & WebSockets
This phase brings the application to life for concurrent team activities.
- **WebSockets (Socket.io):** Broadcasts real-time events when tasks are moved across the Kanban board, creating a multiplayer collaborative environment.
- **Advanced Analytics:** Computing Velocity, ideal vs. actual Burndown charts, and team efficiency metrics dynamically.

<br><br>

## 3. USER ROLES, HIERARCHY, & "THE FREE POOL"

A major component of AgileAI is its strict governance over personnel.

### A. The Super Admin
- **Genesis Setup:** Seeded into the database upon application initialization. Users cannot self-register as an Administrator.
- **Liberty & Scope:** Absolute. An Admin has cross-tenant optics. They can view every project, audit log, and user profile. 
- **Actions:** Can dynamically suspend users, forcefully change user roles, and monitor aggregate statistics across the entire monolithic database. They also create the Project Managers.

### B. The Project Manager (PM)
- **Genesis Setup:** Created exclusively through the Admin Panel. No public registration exists for PMs.
- **Liberty & Scope:** Scoped purely to the projects they create or are assigned to, and the Developers they adopt.
- **Actions:** PMs are the "Directors" of AgileAI. They create Projects, assemble Sprints, assign tasks, and possess the unique power to "Start" and "Complete" a sprint (which triggers the AI evaluation logic).

### C. The Developer & The "Free Pool"
- **Genesis Setup:** Developers register via the public interface (`/register`). However, to prevent rogue users, they are initialized with a `status = 'pending'` and `managedBy = null`.
- **The Free Pool Concept:** This pending state represents the "Free Pool" (or Empty Pool). A registered developer is trapped behind a pending screen. They belong to nobody.
- **The Adoption Workflow:** 
  1. A pm browses the `Pending Approvals` queue.
  2. The PM clicks "Approve", which updates the Developer's `status` to `active` and links `managedBy` to the PM's `_id`.
  3. The Developer is now officially claimed and can access their assigned tasks.
  4. If a PM releases a Developer or the PM is deleted, the cascade effect resets the Developer's `managedBy` to `null`, safely returning them to the Free Pool.
- **Actions:** Developers can modify tasks assigned to them, push cards across the board, post comments, and log work hours. They cannot alter sprint dates or project settings.

<br><br>

## 4. BACKEND INFRASTRUCTURE & API DESIGN

The Node.js Express server is built with strict middleware interceptors to enforce the RBAC system. 

### Key Middlewares
- **`auth.middleware.js`:** Extracts the JWT from the Authorization header and attaches the user document to `req.user`.
- **`rbac.middleware.js`:** A higher-order function that explicitly checks `req.user.role`. For example, `requireRole(['admin', 'pm'])` denies any Developer attempting to access the endpoint.
- **`rateLimiter`:** Standard DDOS protection.

### Endpoint Flow Example: Starting a Sprint
```javascript
// POST /api/sprints/:id/start
1. Middleware validates user is PM or Admin.
2. Checks that Sprint status is currently 'planning'.
3. Checks that no other Sprint in the same Project is 'active'.
4. Triggers an AI payload to the Python microservice.
5. Updates Sprint status to 'active', startedAt to Date.now().
6. Emits `sprint:started` via Socket.io to the room.
```

<br><br>

## 5. DATABASE SCHEMA & DATA RELATIONSHIPS

AgileAI utilizes MongoDB. The NoSQL structure allows deep embedding of arrays (like task comments) while referencing normalized documents (like Users and Projects).

### Sprint Schema (AI-Augmented)
```javascript
{
  _id: ObjectId,
  project: { type: ObjectId, ref: 'Project' },
  title: String,
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ['planning','active','completed'] },
  totalStoryPoints: Number,
  completedStoryPoints: Number,
  velocity: Number, // Computed metric
  
  // AI PREDICTION RENDER FIELDS
  aiRiskScore: Number,       // 0-100 indicating failure likelihood
  aiRiskLevel: String,       // 'low', 'medium', 'high'
  aiRiskFactors: [{ factor: String, impact: Number }],
}
```

### Task Schema (The Agile Workhorse)
```javascript
{
  _id: ObjectId,
  sprint: { type: ObjectId, ref: 'Sprint' }, // Null if in backlog
  title: String,
  description: String,
  type: { type: String, enum: ['story','bug','task','epic'] },
  status: { type: String, enum: ['todo','inprogress','review','done'] },
  priority: { type: String, enum: ['low','medium','high','critical'] },
  assignee: { type: ObjectId, ref: 'User' },
  storyPoints: Number,        // Agile effort metric
  
  // Advanced features
  blockedBy: [{ type: ObjectId, ref: 'Task' }],
  comments: [{ author: ObjectId, text: String, createdAt: Date }],
  worklogs: [{ user: ObjectId, hours: Number, date: Date }],
  
  // AI PREDICTION RENDER FIELDS
  aiEstimatedHours: Number, 
  aiEstimateConfidence: Number
}
```

<br><br>

## 6. ADVANCED ANALYTICS & METRIC FORMULAS

The analytics controller runs heavy aggregation pipelines against MongoDB to feed the frontend charts.

### The Burndown Chart Logic
- **Ideal Trajectory:** Dictated mathematically by standard agile rules. 
  `points_per_day = totalStoryPoints / sprint_total_duration_in_days`
- **Actual Trajectory:** Calculated dynamically. As tasks move to a `status = 'done'`, their associated `storyPoints` are subtracted from the remaining pool for that timestamp.

### Team Velocity Calculation
- **Formula:** Velocity is the trailing average of previous sprints. 
  `Velocity = Sum(completedStoryPoints of last N sprints) / N`
- Used to indicate burnout (sudden drop in velocity) or capability growth.

### Sprint Health Score (Proprietary Algorithm)
AgileAI calculates a live composite score (0-100) using:
1. `# of Default Idle Tasks` (> 3 days with no DB changes).
2. `% of Blocked Tasks` (tasks explicitly linked to blockedBy arrays that are not 'done').
3. `Scope Creep Counter` (tasks injected into the sprint *after* the `startedAt` date).

<br><br>

## 7. MACHINE LEARNING PIPELINE (THE AI BRAIN)

The Python service (`train_models.py`) is the most computationally advanced part of the platform. We rely on **XGBoost** (Extreme Gradient Boosting).

### Why XGBoost?
We are processing highly structured tabular data (ratios, word counts, nested links). **Deep Neural Networks (DNNs) typically underperform on tabular datasets** relative to tree-based ensemble methods like XGBoost. By utilizing XGBoost, we require less hyperparameter tuning to avoid overfitting and gain access to explicit Feature Importance (which translates to transparent AI risk explanations for the PMs).

### Model 1: The Sprint Risk Classifier (`XGBClassifier`)
Predicts if a sprint will crash.
- **Problem:** Data Imbalance. Sprints successfully complete far more often than they fail. If an AI trains on 90% successes, it simply guesses "success" every time.
- **Solution:** We integrated **SMOTE (Synthetic Minority Over-sampling Technique)** inside an `ImbPipeline`. SMOTE synthetically generates "failed sprint" data points mathematically, forcing the model to learn 50/50 balance.
- **Cross-Validation:** We use `StratifiedKFold(n_splits=5)`. The data is split 5 ways. SMOTE is applied *inside* the fold on training data only to avoid "data leakage" into the validation fold.

### Model 2: The Task Effort Regressor (`XGBRegressor`)
Predicts how many Story Points a task requires.
- Standard regression model mapping descriptive lengths and text complexities to numeric values. Evaluated using Mean Absolute Error (MAE) rather than Accuracy (since it outputs continuous floats, not categories).

### Bayesian Hyperparameter Tuning (Optuna)
Instead of guessing the optimal `learning_rate` or `max_depth` (Grid Search/Random Search), we employed **Optuna**. Optuna uses Bayesian optimization, leveraging the history of previous model runs to intelligently guess the best parameters, resulting in massive metric improvements in under 100 trials.

<br><br>

## 8. THE DATASETS: ORIGINS, RAW STRUCTURE, & FEATURE ENGINEERING

For enterprise-grade accuracy, AgileAI does not use dummy datasets. The models were trained on historic repository data from the world's largest open-source software projects. The metrics were published in **IEEE Transactions on Software Engineering (TSE) 2017 & 2018**.

### Dataset 1: Sprint Risk Prediction
- **Origins:** Apache, JBoss, JIRA core code, MongoDB code, and Spring Framework.
- **Raw File Structure Example (`apache_issue_0.csv`):**
  ```csv
  boardid,sprintid,type,priority,no_comment,no_issuelink,no_blocking,no_blockedby,no_priority_change,no_des_change
  1,8,Task,Minor,1,0,0,0,0,0
  1,8,Improvement,Major,1,2,0,0,0,0
  ```
- **Feature Engineering Logic:**
  `train_models.py` uses `pandas.groupby('sprintid')` to compress hundreds of individual tasks into a single "Sprint Profile".
  1. `blocked_ratio`: SUM(tasks with no_blockedby > 0) / Total Tasks
  2. `churn_ratio`: SUM(priority changes + description changes) / (Total Tasks * 5)
  3. `high_priority_ratio`: % of tasks labeled "Critical" or "Blocker".
  - **Traget Vector ('success'):** Calculated dynamically. 1 (Success) if `blocked_ratio < 0.2` and `churn_ratio < 0.5`. Otherwise 0 (Failure).

### Dataset 2: Task Effort / Story Point Registration
- **Origins:** Appcelerator, Bamboo, Mesos, Moodle, Mule, Titanium.
- **Raw File Structure Example (`jirasoftware.csv`):**
  ```csv
  issuekey,title,description,storypoint
  JSW-1271,"Change Trigger for Night Service",NULL,5
  JSW-1681,"Generic webwork aliases clash","Some web work actions have commands that have very generic aliases...",5
  ```
- **Feature Engineering Logic:**
  Text data cannot be fed directly to XGBoost. We mapped it to quantitative metrics:
  1. `title_length_norm`: Title string length clipped to a 0-1 distribution.
  2. `desc_bucket`: Categorical mapping of description length (0: None, 1: Short, 2: Medium, 3: High).

<br><br>

## 9. MICROSERVICES INTEGRATION: NODE.JS ↔ PYTHON

The platform connects the Express backend to the Python AI core dynamically. 
When a PM hits `/api/sprints/:id/start`, Node.js takes the sprint's tasks from MongoDB:

**Node.js JSON Payload Construction:**
```javascript
const sprintProfile = {
  blocked_ratio: computeBlocked(tasks),
  blocking_ratio: computeBlocking(tasks),
  scope_creep_rate: computeCreep(tasks),
  high_priority_ratio: computePriority(tasks),
  //...
};
```

**Execution Pipeline:**
Node uses standard IPC (Inter-Process Communication) or HTTP over local boundary to pass `sprintProfile` to the AI wrapper. 
The Python inference script loads the serialized `joblib` artifacts (`risk_model.pkl`), pushes the data through the `StandardScaler` fitted from training, and executes `.predict()`. 
Node awaits the JSON response to mutate the Database and inform the user interface.

<br><br>

## 10. COMPREHENSIVE VIVA QUESTIONS & DEFENSE ANSWERS

Memorize these concepts for the defense phase of your Viva. The answers are phrased perfectly to impress technical evaluators.

**Q1: How exactly does your AI integration work? Does it train live inside the platform when users make changes?**
> *Defense:* "No, live training during web traffic would cause massive system blocking and latency. Our Python service pre-trains the XGBoost models offline using Optuna on massive open-source datasets (IEEE TSE) and saves the trained states as serialized `.pkl` artifacts. Our Node.js server passes JSON data in real-time to a Python interface simply to execute `inference` (predictions) against those frozen models. It takes milliseconds."

**Q2: Why did your team utilize XGBoost instead of a Deep Neural Network (DNN/PyTorch)?**
> *Defense:* "Our sprint metrics (ratios, counts) represent highly structured, tabular data. Research shows that tree-based ensemble algorithms like XGBoost consistently outperform Deep Neural Networks on tabular data, require far fewer computational resources, and are easier to tune. Furthermore, XGBoost allows us to extract explicit 'Feature Importance', which means we can cleanly explain *why* the AI predicted a failure."

**Q3: Your Sprint Risk dataset has far more successful sprints than failed sprints. How do you prevent the AI from defaulting to 'successful' every time due to bias?**
> *Defense:* "We recognized the class imbalance and integrated SMOTE (Synthetic Minority Over-sampling Technique). SMOTE analyzes the 'failed sprint' minority class and synthetically interpolates new data points geographically close to them. We inject SMOTE entirely inside a `StratifiedKFold` Pipeline to guarantee the synthetic data never leaks into our validation fold testing, preserving real-world accuracy."

**Q4: Explain your architectural choice regarding 'The Free Pool' mechanism.**
> *Defense:* "To ensure role security across developers, we designed the Free Pool. When developers register, they are assigned a `pending` status and their `managedBy` database field is strictly `null`. They are walled off from viewing arbitrary company projects. By forcing Project Managers to 'Approve' and adopt them, the developer's ID links to the PM's organization. If a PM is removed, our cascade triggers return those developers safely to the Free Pool rather than stranding their accounts."

**Q5: How does your frontend UI ensure that developers cannot force a Sprint to start via API manipulation?**
> *Defense:* "While the frontend React Code hides the 'Start Sprint' buttons based on Role strings, security is ultimately enforced Server-Side. In Node.js, we employ an explicit `rbac.middleware.js` wrapper. Attempting to POST to `/api/sprints/:id/start` as a developer results in the JWT token decoding as 'developer', triggering an immediate HTTP 403 Forbidden intercept before the controller even fires."

**Q6: Where exactly did your training data come from, or is it synthetic?**
> *Defense:* "The data is absolutely real, enterprise-grade historic software traces. We utilized two benchmark datasets published in IEEE Transactions on Software Engineering (TSE 2017 & 2018). Our sprint analysis traces derive from Apache, JBoss, and Spring Framework developments, meaning our model is predicting based on the workflow traits of the world's best open-source engineers."

**Q7: How are 'Story Points' utilized mathematically within your advanced analytics dashboard?**
> *Defense:* "Story Points act as the primary quantitative dimension for effort. We run MongoDB aggregations on them. For the Burndown Chart, we formulate an ideal trajectory based on total sprint duration. As tasks cross the 'Done' threshold on the Kanban board, their literal `storyPoints` integer is cumulatively subtracted dynamically to map the actual completion slope."

**Q8: What specific hyperparameter tuning did you use for XGBoost? Manual Grid Search?**
> *Defense:* "No, Grid Search is computationally naive. We used Optuna, which leverages Bayesian optimization. Instead of brute-forcing parameter grids, Optuna analyzes the loss curves of previous trials to mathematically zero in on the optimal `max_depth` and `learning_rate` in just 100 trials, dramatically accelerating our development speed."

**Q9: If the system has Admin, PM, and Developer roles, how does database scaling behave if you introduce multiple Organizations?**
> *Defense:* "For this build, we opted for cross-project isolation via the `owner` and `members` arrays inside the Project collection. If multi-tenancy were required in the future, we have pre-designed an `Organization` collection schema in our Master Blueprint. We could simply map `orgId` as an index onto the User collection, instantly creating walled enterprise-garden data models."

**Q10: Tell us about the actual Data Feature Engineering logic. How do you convert raw CSV files into an AI prediction?**
> *Defense:* "For Task Effort, AI can't read raw English natively without NLP. To feed our XGBoost regressor, we mathematically parameterized textual complexity: we calculated normalized title lengths, built categorical 'desc_buckets' mapping how long descriptions are, and combined them with priority flags. For Sprints, we employed `pandas.groupby()` to squash hundreds of individual JIRA tasks into centralized ratios like `blocked_ratio` and `churn_ratio`, creating singular macro-profiles representing the entire Sprint's behavior."

---
*Document prepared for AgileAI Assessment & Viva Environment. Good Luck!*