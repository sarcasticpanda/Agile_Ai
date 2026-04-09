import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5001/api';
const AI_HEALTH_URL = process.env.AI_HEALTH_URL || 'http://127.0.0.1:8001/health';

const PM_CREDS = {
  email: process.env.PM_EMAIL || 'pm@agileai.com',
  password: process.env.PM_PASSWORD || 'Pm1234!',
};

const ADMIN_CREDS = {
  email: process.env.ADMIN_EMAIL || 'admin@agileai.com',
  password: process.env.ADMIN_PASSWORD || 'Admin1234!',
};

const descLong =
  'This is an intentionally long description used to move the desc_bucket into the highest segment. '.repeat(30);
const descMedium =
  'This is a medium-size description for testing effort model behavior and persistence fidelity.';

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
    },
  });

  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }

  if (!res.ok) {
    const msg = body?.message || body?.detail || `HTTP ${res.status}`;
    throw new Error(`${url} -> ${msg}`);
  }

  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

async function loginWithFallback() {
  try {
    const pm = await httpJson(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(PM_CREDS),
    });
    if (pm?.data?.token) {
      return { token: pm.data.token, role: pm.data.role || 'pm', principal: PM_CREDS.email };
    }
  } catch {
    // fallback below
  }

  const admin = await httpJson(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(ADMIN_CREDS),
  });
  assert(admin?.data?.token, 'Admin login fallback failed.');
  return { token: admin.data.token, role: admin.data.role || 'admin', principal: ADMIN_CREDS.email };
}

async function main() {
  console.log('=== AI Reality Verification ===');

  const health = await httpJson(AI_HEALTH_URL, { method: 'GET', headers: {} });
  assert(health?.ok === true, 'AI health check did not return ok=true');
  console.log(
    `AI health OK | riskVersion=${health?.models?.risk?.version} effortVersion=${health?.models?.effort?.version}`
  );

  const auth = await loginWithFallback();
  const bearer = { Authorization: `Bearer ${auth.token}` };
  console.log(`Authenticated as ${auth.principal} (${auth.role}).`);

  const runTag = new Date().toISOString().replace(/[:.]/g, '-');

  const projectRes = await httpJson(`${API_BASE}/projects`, {
    method: 'POST',
    headers: bearer,
    body: JSON.stringify({
      title: `AI Verify Project ${runTag}`,
      description: 'Controlled project for AI reality verification',
      key: `AIV${runTag.slice(-4)}`,
    }),
  });
  const projectId = projectRes?.data?._id;
  assert(projectId, 'Project creation failed to return _id');

  const now = Date.now();
  const sprintRes = await httpJson(`${API_BASE}/sprints`, {
    method: 'POST',
    headers: bearer,
    body: JSON.stringify({
      title: `AI Verify Sprint ${runTag}`,
      goal: 'Reality verification',
      startDate: new Date(now).toISOString(),
      endDate: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      projectId,
    }),
  });
  const sprintId = sprintRes?.data?._id;
  assert(sprintId, 'Sprint creation failed to return _id');

  const createTask = async (payload) => {
    const created = await httpJson(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify({
        project: projectId,
        sprint: sprintId,
        ...payload,
      }),
    });
    assert(created?.data?._id, 'Task creation failed to return _id');
    return created.data;
  };

  const taskA = await createTask({
    title: 'Short fix',
    description: '',
    type: 'task',
    priority: 'low',
    storyPoints: 2,
  });

  const taskB = await createTask({
    title: 'Medium implementation task',
    description: descMedium,
    type: 'story',
    priority: 'medium',
    storyPoints: 5,
  });

  const taskC = await createTask({
    title: 'Critical bug with large investigation and remediation scope',
    description: descLong,
    type: 'bug',
    priority: 'critical',
    storyPoints: 13,
  });

  const estimateTask = async (taskId) => {
    const res = await httpJson(`${API_BASE}/ai/estimate-effort`, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify({ taskId }),
    });
    assert(res?.success === true && res?.data?.ok === true, `Estimate failed for task ${taskId}`);
    return res.data;
  };

  const estA = await estimateTask(taskA._id);
  const estB = await estimateTask(taskB._id);
  const estC = await estimateTask(taskC._id);

  const vals = [round3(estA.predictedStoryPoints), round3(estB.predictedStoryPoints), round3(estC.predictedStoryPoints)];
  const unique = new Set(vals);
  assert(unique.size > 1, `Effort outputs look static: ${vals.join(', ')}`);

  const taskAFresh = await httpJson(`${API_BASE}/tasks/${taskA._id}`, {
    method: 'GET',
    headers: bearer,
  });
  assert(taskAFresh?.data?.aiEstimatedStoryPoints != null, 'Task A missing persisted aiEstimatedStoryPoints');
  assert(taskAFresh?.data?.aiEstimatedStoryPointsAt, 'Task A missing persisted aiEstimatedStoryPointsAt');

  const predictRisk = async () => {
    const res = await httpJson(`${API_BASE}/ai/predict-risk`, {
      method: 'POST',
      headers: bearer,
      body: JSON.stringify({ sprintId }),
    });
    assert(res?.success === true && res?.data?.ok === true, 'predict-risk failed');
    return res.data;
  };

  const riskBefore = await predictRisk();

  await httpJson(`${API_BASE}/tasks/${taskA._id}`, {
    method: 'PATCH',
    headers: bearer,
    body: JSON.stringify({
      priority: 'critical',
      description: descLong,
      blockedBy: [taskC._id],
      type: 'bug',
    }),
  });

  const riskAfter = await predictRisk();

  const beforeFeatures = riskBefore?.features || {};
  const afterFeatures = riskAfter?.features || {};
  const featureDelta =
    round3(beforeFeatures.blocked_ratio) !== round3(afterFeatures.blocked_ratio) ||
    round3(beforeFeatures.high_priority_ratio) !== round3(afterFeatures.high_priority_ratio) ||
    round3(beforeFeatures.bug_ratio) !== round3(afterFeatures.bug_ratio);
  assert(featureDelta, 'Risk features did not react to controlled task change');

  const sprintFresh = await httpJson(`${API_BASE}/sprints/${sprintId}`, {
    method: 'GET',
    headers: bearer,
  });
  assert(sprintFresh?.data?.aiRiskScore != null, 'Sprint missing persisted aiRiskScore');
  assert(sprintFresh?.data?.aiLastAnalyzed, 'Sprint missing persisted aiLastAnalyzed');

  const insights = await httpJson(`${API_BASE}/ai/insights/${sprintId}`, {
    method: 'GET',
    headers: bearer,
  });
  assert(insights?.success === true, 'Insights endpoint failed');
  assert(Array.isArray(insights?.data?.riskFactors), 'Insights response missing riskFactors array');

  console.log('Effort predictions (SP):', {
    taskA: estA.predictedStoryPoints,
    taskB: estB.predictedStoryPoints,
    taskC: estC.predictedStoryPoints,
  });

  console.log('Risk score transition:', {
    before: riskBefore.riskScore,
    after: riskAfter.riskScore,
    beforeFeatures: {
      blocked_ratio: beforeFeatures.blocked_ratio,
      high_priority_ratio: beforeFeatures.high_priority_ratio,
      bug_ratio: beforeFeatures.bug_ratio,
    },
    afterFeatures: {
      blocked_ratio: afterFeatures.blocked_ratio,
      high_priority_ratio: afterFeatures.high_priority_ratio,
      bug_ratio: afterFeatures.bug_ratio,
    },
  });

  console.log('PASS: AI outputs are dynamic, persisted, and API-backed for UI consumption.');
}

main().catch((err) => {
  console.error('FAIL: AI reality verification failed.');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
