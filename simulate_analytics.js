import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './agileai/server/models/User.model.js';
import Project from './agileai/server/models/Project.model.js';
import Sprint from './agileai/server/models/Sprint.model.js';
import Task from './agileai/server/models/Task.model.js';
import { triggerAIRiskRefresh } from './agileai/server/services/aiRefresh.service.js';
import { recalculateTeamStats } from './agileai/server/services/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'agileai/server/.env') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/agileai-test-db";

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runSimulation() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // 1. Setup Data
  const pm = new User({
    name: "PM Pete", email: "pm@test.com", passwordHash: "x", role: "product-owner"
  });
  const devA = new User({
    name: "Dev Alice", email: "alice@test.com", passwordHash: "x", role: "developer",
    aiBurnoutRiskScore: 0, aiBurnoutLevel: 'low'
  });
  const devB = new User({
    name: "Dev Bob", email: "bob@test.com", passwordHash: "x", role: "developer",
    aiBurnoutRiskScore: 0, aiBurnoutLevel: 'low'
  });
  await pm.save(); await devA.save(); await devB.save();

  const project = new Project({
    name: "Simulation Project",
    key: "SIM",
    owner: pm._id,
    members: [
      { user: pm._id, role: 'owner' },
      { user: devA._id, role: 'developer' },
      { user: devB._id, role: 'developer' }
    ]
  });
  await project.save();

  const sprint = new Sprint({
    project: project._id,
    name: "Sprint 1",
    goal: "Test things",
    startDate: new Date(),
    endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    status: 'active'
  });
  await sprint.save();

  console.log("\n--- SCENARIO 1: DEV A IS GIVEN A MASSIVE TASK (100 hours overdue) ---");
  const task1 = new Task({
    project: project._id, sprint: sprint._id, reporter: pm._id,
    title: "Massive Task", status: 'inprogress',
    assignees: [{ user: devA._id, contributionPercent: 100 }],
    dueDate: new Date(Date.now() - 5 * 24 * 3600 * 1000), // Overdue!
    isBlocked: true,
    worklogs: [{ user: devA._id, hours: 80, date: new Date() }]
  });
  await task1.save();
  
  // Recalculate burnout
  await recalculateTeamStats();
  await devA.reload();
  console.log(`Dev A Burnout Score (Alone): ${devA.aiBurnoutRiskScore.toFixed(2)} (${devA.aiBurnoutLevel})`);

  // Trigger sprint risk
  await triggerAIRiskRefresh(sprint._id);
  await delay(2000); // Wait for python api
  await sprint.reload();
  console.log(`Sprint Risk Score: ${sprint.aiRiskScore} (${sprint.aiRiskLevel})`);


  console.log("\n--- SCENARIO 2: PM ADDS DEV B TO HELP ---");
  task1.assignees.push({ user: devB._id, contributionPercent: 50 });
  task1.assignees[0].contributionPercent = 50;
  // Let Dev B log 10 hours
  task1.worklogs.push({ user: devB._id, hours: 10, date: new Date() });
  await task1.save();

  // Recalculate burnout
  await recalculateTeamStats();
  await devA.reload(); await devB.reload();
  console.log(`Dev A Burnout Score (Shared): ${devA.aiBurnoutRiskScore?.toFixed(2) || 'N/A'}`);
  console.log(`Dev B Burnout Score (Shared): ${devB.aiBurnoutRiskScore?.toFixed(2) || 'N/A'}`);

  // Trigger sprint risk
  await triggerAIRiskRefresh(sprint._id);
  await delay(2000); // Wait for python api
  await sprint.reload();
  console.log(`Sprint Risk Score: ${sprint.aiRiskScore} (${sprint.aiRiskLevel})`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

runSimulation().catch(console.error);
