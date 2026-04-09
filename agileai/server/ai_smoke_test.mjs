import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import Task from './models/Task.model.js';
import Sprint from './models/Sprint.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

const API_BASE = process.env.API_BASE || 'http://localhost:5001/api';
const AI_HEALTH_URL = process.env.AI_HEALTH_URL || 'http://127.0.0.1:8001/health';
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in env');
  process.exit(1);
}

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = typeof json === 'object' && json && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`${url} failed: ${msg}`);
  }

  return json;
}

async function main() {
  console.log('=== AI Smoke Test (Phase 2) ===');
  console.log(`API_BASE=${API_BASE}`);
  console.log(`AI_HEALTH_URL=${AI_HEALTH_URL}`);

  // 1) AI health
  const health = await httpJson(AI_HEALTH_URL, { method: 'GET', headers: {} });
  if (!health?.ok) {
    throw new Error('AI service health check did not return ok=true');
  }
  console.log('✅ AI service health OK');

  // 2) Pick IDs from DB
  await mongoose.connect(MONGODB_URI);

  const effortTask = await Task.findOne({}).sort({ updatedAt: -1 });
  if (!effortTask?._id) {
    throw new Error('No Task found in Mongo for effort test');
  }

  const taskWithSprint = await Task.findOne({ sprint: { $ne: null } }).sort({ updatedAt: -1 });
  if (!taskWithSprint?.sprint) {
    throw new Error('No Task with sprint found in Mongo for risk test');
  }

  const sprint = await Sprint.findById(taskWithSprint.sprint);
  if (!sprint?._id) {
    throw new Error('Sprint referenced by task not found');
  }

  const taskId = effortTask._id.toString();
  const sprintId = sprint._id.toString();

  console.log(`Using taskId=${taskId}`);
  console.log(`Using sprintId=${sprintId}`);

  // 3) Login as admin
  const login = await httpJson(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@agileai.com', password: 'Admin1234!' }),
  });

  const token = login?.data?.token;
  if (!token) {
    throw new Error('Login did not return token');
  }
  console.log('✅ Admin login OK');

  // 4) Call estimate-effort
  const effort = await httpJson(`${API_BASE}/ai/estimate-effort`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ taskId }),
  });

  if (!effort?.success || !effort?.data?.ok) {
    throw new Error('estimate-effort did not return success');
  }
  console.log('✅ estimate-effort OK');

  // 5) Assert persistence on Task
  const persistedTask = await Task.findById(taskId).lean();
  if (persistedTask?.aiEstimatedStoryPoints == null) {
    throw new Error('Task.aiEstimatedStoryPoints was not persisted');
  }
  if (!persistedTask?.aiEstimatedStoryPointsAt) {
    throw new Error('Task.aiEstimatedStoryPointsAt was not persisted');
  }
  console.log('✅ Task AI persistence OK');

  // 6) Call predict-risk
  const risk = await httpJson(`${API_BASE}/ai/predict-risk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sprintId }),
  });

  if (!risk?.success || !risk?.data?.ok) {
    throw new Error('predict-risk did not return success');
  }
  console.log('✅ predict-risk OK');

  // 7) Assert persistence on Sprint
  const persistedSprint = await Sprint.findById(sprintId).lean();
  if (persistedSprint?.aiRiskScore == null) {
    throw new Error('Sprint.aiRiskScore was not persisted');
  }
  if (!persistedSprint?.aiLastAnalyzed) {
    throw new Error('Sprint.aiLastAnalyzed was not persisted');
  }
  console.log('✅ Sprint AI persistence OK');

  await mongoose.disconnect();

  console.log('🎉 AI SMOKE TEST PASSED');
}

main().catch(async (err) => {
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  console.error('❌ AI SMOKE TEST FAILED');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
