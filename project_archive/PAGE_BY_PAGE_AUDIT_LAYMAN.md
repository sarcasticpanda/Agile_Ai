# AGILEAI: PAGE-BY-PAGE DETAILED AUDIT (LAYMAN'S TERMS) 🚨
**Date:** April 1, 2026
**Purpose:** A brutally honest, highly detailed, page-by-page breakdown of exactly what works, what is connected, and what is currently broken or missing based on the Masterplan. Written in plain English.

---

## 🏢 THE HIERARCHY (Who is Who)
Before we look at the pages, here is how the users work:
* **The Super Admin (The CEO):** Seeded into the database. Cannot be created publicly. Sees everything. Creates Project Managers.
* **The Project Manager / PM (The Boss):** Created by Admins. They create the projects, make the schedules, and click "Start Sprint".
* **The Developer (The Worker):** Anyone can sign up as this. But when they do, they are thrown into the **"Free Pool" (The Waiting Room)**. They belong to nobody and can't see any projects until a PM officially adopts them.

---

## 📄 PAGE 1: Login & Registration Page (`/login` & `/register`)
**The Goal:** Let people log in, and let Developers sign up for the platform.

✅ **WHAT IS DONE (Integrated):**
* The user interface (UI) is built. 
* The database successfully creates the user.
* It successfully forces all new web-registrations to have the `role` of "Developer" and the `status` of "pending".

❌ **WHAT IS LEFT (Missing/Broken):**
* **The Waiting Room Trap:** The frontend React code needs to be strictly locked. If a newly registered Developer logs in, they *must* be forced to the `/pending` screen. Right now, a clever developer might be able to type `/dashboard` and sneak into the app.

---

## 📄 PAGE 2: The Pending Lobby / Free Pool (`/pending`)
**The Goal:** A literal waiting room for new Developers. It just shows an hourglass saying "Waiting for a PM to approve you."

✅ **WHAT IS DONE (Integrated):**
* The database logic is ready: `status: 'pending'` and `managedBy: null`.
* Admins and PMs have the backend buttons to "Adopt" these users, moving them from the pool to their team.

❌ **WHAT IS LEFT (Missing/Broken):**
* **Auto-Refresh:** The frontend page needs code (`setInterval`) to check the database every 60 seconds. When a PM adopts them, the page should automatically unlock and jump to the Dashboard without the Developer hitting refresh.

---

## 📄 PAGE 3: The Admin Dashboard (`/admin`)
**The Goal:** The God-View. Let Admins see all users, all PMs, and all company statistics in one place.

✅ **WHAT IS DONE (Integrated):**
* The database routes exist to pull "All Users", "All Projects", and "System Stats".
* Admins can successfully change user statuses (Active/Suspended).

❌ **WHAT IS LEFT (Missing/Broken):**
* **Audit Logs:** The masterplan says Admins should see a live feed of who did what (e.g., "Dave moved Task 4"). This is likely just blank UI right now; the backend isn't recording every click into the `AuditLog` database correctly.

---

## 📄 PAGE 4: The Project Manager (PM) Dashboard (`/dashboard`)
**The Goal:** The command center for the PM. They should see their active project, their developers, and if their Sprint is healthy or failing.

✅ **WHAT IS DONE (Integrated):**
* The UI cards for "My Team" and "Active Sprint" are built.
* The API correctly fetches ONLY the developers who were "adopted" by this specific PM.

❌ **WHAT IS LEFT (Missing/Broken):**
* **The AI Risk Badge (Major Missing Piece):** There is a spot on the PM dashboard that should say "Sprint Health: HIGH RISK". **This is NOT connected.** The AI model is trained, but the Node.js backend has no way to actually ask the AI for the score. It's just an empty or fake badge right now.
* **Notification Banner:** The PM needs a flashing alert saying "You have 3 Developers in the Free Pool waiting for approval." 

---

## 📄 PAGE 5: The Backlog Page (`/projects/:id/backlog`)
**The Goal:** The giant shopping list of tasks. PMs create Sprints here and drag tasks into them.

✅ **WHAT IS DONE (Integrated):**
* You can create tasks, and they save to MongoDB.
* You can group tasks into a "Sprint" block waiting to be started.

❌ **WHAT IS LEFT (Missing/Broken):**
* **The Duplicate File Problem:** You currently have `PmBacklogPage.jsx` and `BacklogPage.jsx`. This is garbage code structure. You need to delete one, and use `if (user.role === 'pm')` to hide the "Edit" buttons from standard developers.
* **AI Effort Estimation (Integration Left):** When you type a task description, the AI is supposed to guess the Story Points. Again, the AI is trained, but the API network bridge is missing! Node.js is not sending the task text to Python.

---

## 📄 PAGE 6: The Sprint Board / Kanban (`/projects/:id/board`)
**The Goal:** The digital whiteboard with columns (To Do, In Progress, Review, Done).

✅ **WHAT IS DONE (Integrated):**
* The database updates correctly when you drag and drop a card into a new column.
* Developers can assign themselves to cards and log hours.

❌ **WHAT IS LEFT (Missing/Broken):**
* **The Duplicate File Problem:** Just like the Backlog, you have identical copies of the board for PMs and Devs. They MUST be merged.
* **The "Phantom Board" (No Real-Time Sync):** The Masterplan requires WebSockets (`Socket.io`). Right now, if Developer A moves a card to "Done", Developer B staring at their own laptop won't see it move until they hit the 'Refresh' button on their browser. You need to connect WebSockets so it moves instantly like a multiplayer video game.

---

## 📄 PAGE 7: Analytics & Reporting (`/analytics`)
**The Goal:** Beautiful charts showing if the team is working fast enough (Velocity) and a line graph showing tasks dropping to zero (Burndown).

✅ **WHAT IS DONE (Integrated):**
* The React charts (frontend) are likely placed on the page for visual looks.

❌ **WHAT IS LEFT (Missing/Broken):**
* **The Math is Missing:** The Burndown chart requires heavy daily math (`Total points minus completed points per day`). Right now, the backend `analyticsController.js` is not calculating this correctly from the database. The charts are either flat, faked with dummy data, or entirely broken.

---

## 🧠 THE CORE MISSING LINK: THE AI ENGINE (Layman Explanation)
**What you accomplished:** You successfully wrote `train_models.py`. Your code downloaded 100,000 real software tasks, studied them using XGBoost, and saved the "AI Brains" into files ending in `.pkl`. **This was the hardest part, and it is 100% DONE.**

**What is LACKING (The Missing Integration):**
The `.pkl` files are sitting on your hard drive doing nothing. 
1. Your Node.js server (which runs the website) does not speak Python. 
2. Therefore, when the PM clicks "Start Sprint", Node.js doesn't know how to ask the `.pkl` files for the Risk Score.
3. **How to fix before Viva:** You must write a tiny, 20-line Python webhook server (using Flask or FastAPI). 
   * Node.js sends the Sprint data to `http://localhost:5000/predict`.
   * The Python Flask server catches it, runs the `.pkl` brain, and sends the Risk Score back to Node.js.
   * THEN Node.js can save the official score to the database and show it on the Dashboard.