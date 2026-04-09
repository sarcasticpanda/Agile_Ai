/**
 * AgileAI Detailed System Test Suite (API + Socket.IO)
 *
 * Covers:
 * - Admin assigns 5 devs to a PM
 * - PM creates project, creates 2 sprints, assigns tasks (3+2 grouping)
 * - 5 dev accounts login and update tasks (status, comment, worklog)
 * - Verifies realtime events via Socket.IO (task:moved / task:updated)
 * - Verifies audit logs for assignments and task status history timestamps
 *
 * Run:
 *   node system_test_suite.mjs
 * Optional env:
 *   API_BASE=http://localhost:5001/api
 *   SOCKET_BASE=http://localhost:5001
 */

import { io as createSocket } from 'socket.io-client';

const API_BASE = process.env.API_BASE || 'http://localhost:5001/api';
const SOCKET_BASE = process.env.SOCKET_BASE || API_BASE.replace(/\/api$/, '');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = { success: false, message: `Non-JSON response (${res.status})` };
  }

  if (!res.ok) {
    const msg = payload?.message || payload?.error || JSON.stringify(payload);
    return { ok: false, status: res.status, message: msg, raw: payload };
  }

  return { ok: true, status: res.status, data: payload.data, message: payload.message, raw: payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDateish(value, message) {
  assert(value, message);
  const d = new Date(value);
  assert(!Number.isNaN(d.getTime()), message);
  return d;
}

function assertApproxSameTime(a, b, toleranceMs, message) {
  const da = new Date(a);
  const db = new Date(b);
  assert(!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime()), message);
  const diff = Math.abs(da.getTime() - db.getTime());
  assert(diff <= toleranceMs, `${message} (diff=${diff}ms)`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function ensureUserRegistered({ name, email, password }) {
  const res = await api('POST', '/auth/register', { name, email, password });
  if (res.ok) {
    console.log(`✅ Registered (pending): ${email}`);
    return;
  }
  if (String(res.message).toLowerCase().includes('already exists')) {
    console.log(`ℹ️  User exists: ${email}`);
    return;
  }
  throw new Error(`Register failed for ${email}: ${res.status} ${res.message}`);
}

async function login({ email, password }) {
  const res = await api('POST', '/auth/login', { email, password });
  assert(res.ok, `Login failed for ${email}: ${res.status} ${res.message}`);
  return res.data;
}

async function adminPatchUser(adminToken, userId, patch) {
  const res = await api('PATCH', `/admin/users/${userId}`, patch, adminToken);
  assert(res.ok, `Admin patch user ${userId} failed: ${res.status} ${res.message}`);
  return res.data;
}

async function connectWatcherSocket({ label, userId, projectId }) {
  const socket = createSocket(SOCKET_BASE, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: true,
  });

  const events = {
    connected: false,
    taskMoved: [],
    taskUpdated: [],
    sprintStatusChanged: [],
  };

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} socket connect timeout`)), 10000);
    socket.on('connect', () => {
      clearTimeout(t);
      events.connected = true;
      socket.emit('join:user', userId);
      socket.emit('join:project', projectId);
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });

  socket.on('task:moved', (payload) => events.taskMoved.push(payload));
  socket.on('task:updated', (payload) => events.taskUpdated.push(payload));
  socket.on('sprint:status_changed', (payload) => events.sprintStatusChanged.push(payload));

  console.log(`✅ ${label} socket connected + joined project:${projectId}`);

  return { socket, events };
}

async function waitForAdminUserByEmail(adminToken, email, { retries = 5, delayMs = 400 } = {}) {
  const normalizedEmail = String(email).toLowerCase();
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await api('GET', '/admin/users', null, adminToken);
    if (res.ok) {
      const found = (res.data || []).find((u) => String(u.email).toLowerCase() === normalizedEmail);
      if (found) return found;
    }
    if (attempt < retries) {
      await sleep(delayMs);
    }
  }
  return null;
}

async function main() {
  console.log('AgileAI Detailed System Test Suite');
  console.log(`API_BASE=${API_BASE}`);
  console.log(`SOCKET_BASE=${SOCKET_BASE}`);

  const startedAt = new Date();
  const runTag = startedAt.toISOString().replace(/[:.]/g, '-');

  const creds = {
    admin: { email: 'admin@agileai.com', password: 'Admin1234!' },
    pm: { email: 'pm@agileai.com', password: 'Pm1234!' },
    devs: [
      { name: 'Dev Alice', email: 'alice@agileai.com', password: 'Dev1234!' },
      { name: 'Dev Bob', email: 'bob@agileai.com', password: 'Dev1234!' },
      { name: 'Dev Charlie', email: 'charlie@agileai.com', password: 'Dev1234!' },
      { name: 'David Dev', email: 'david@agileai.com', password: 'Dev1234!' },
      { name: 'Eve Dev', email: 'eve@agileai.com', password: 'Dev1234!' },
    ],
  };

  section('0) Smoke check');
  const health = await fetch(SOCKET_BASE);
  assert(health.ok, `Backend not reachable at ${SOCKET_BASE} (status ${health.status})`);
  console.log(`✅ Backend reachable (${health.status})`);

  section('1) Ensure 5 developer accounts exist');
  for (const dev of creds.devs.slice(3)) {
    await ensureUserRegistered(dev);
  }

  section('1b) Edge case: pending users cannot login');
  const pendingCreds = {
    name: `Pending User ${runTag}`,
    email: `pending.${runTag}@agileai.local`,
    password: 'Dev1234!',
  };
  await ensureUserRegistered(pendingCreds);
  const pendingLogin = await api('POST', '/auth/login', { email: pendingCreds.email, password: pendingCreds.password });
  assert(!pendingLogin.ok && pendingLogin.status === 403, `Expected pending login 403, got ${pendingLogin.status}`);
  console.log('✅ Pending user login blocked (403)');

  section('2) Admin login + ensure PM role/status');
  const admin = await login(creds.admin);
  assert(admin.role === 'admin', 'Admin role mismatch after login');
  const adminToken = admin.token;

  const pm = await login(creds.pm);
  const pmId = pm._id;
  // If PM is not pm role or not active, flip it via admin
  const usersRes = await api('GET', '/admin/users', null, adminToken);
  assert(usersRes.ok, `Admin get users failed: ${usersRes.status} ${usersRes.message}`);
  const users = usersRes.data;
  const pmUser = users.find((u) => u.email === creds.pm.email);
  assert(pmUser, 'PM user not found in admin users');

  if (pmUser.role !== 'pm' || pmUser.status !== 'active') {
    await adminPatchUser(adminToken, pmUser._id, { role: 'pm', status: 'active' });
    console.log('✅ Ensured PM is role=pm, status=active');
  } else {
    console.log('ℹ️  PM already role=pm, status=active');
  }

  section('3) Admin assigns 5 devs to the PM (managedBy) + activates them');
  const devUserRecords = creds.devs.map((d) => {
    const u = users.find((x) => x.email === d.email);
    return { ...d, user: u };
  });

  for (const d of devUserRecords) {
    assert(d.user, `Dev user not found in admin users list: ${d.email}`);

    // If already assigned, force a managedBy change so we can validate audit logs are written.
    if (d.user.managedBy?.toString?.() === pmId.toString()) {
      await adminPatchUser(adminToken, d.user._id, { managedBy: null });
    }

    const patch = { status: 'active', role: 'developer', managedBy: pmId };
    await adminPatchUser(adminToken, d.user._id, patch);
    console.log(`✅ Assigned ${d.email} -> PM ${creds.pm.email}`);
  }

  // Verify in admin/hierarchy
  const hierarchy = await api('GET', '/admin/hierarchy', null, adminToken);
  assert(hierarchy.ok, `Admin hierarchy failed: ${hierarchy.status} ${hierarchy.message}`);
  const pmNode = (hierarchy.data || []).find((n) => n.email === creds.pm.email);
  assert(pmNode, 'PM not present in hierarchy overview');
  assert((pmNode.devs || []).length >= 5, `Expected 5 devs under PM, got ${(pmNode.devs || []).length}`);
  console.log('✅ Admin hierarchy shows PM with 5 devs');

  section('4) PM creates project, adds 5 devs');
  const pm2 = await login(creds.pm); // refresh token after potential role flip
  const pmToken = pm2.token;

  const projectTitle = `System Test Project ${runTag}`;
  const projectCreate = await api(
    'POST',
    '/projects',
    { title: projectTitle, description: 'Automated detailed system test', key: `ST${runTag.slice(-6)}` },
    pmToken
  );
  assert(projectCreate.ok, `Create project failed: ${projectCreate.status} ${projectCreate.message}`);
  const projectId = projectCreate.data._id;
  console.log(`✅ Created project ${projectTitle} (${projectId})`);

  for (const d of devUserRecords) {
    const add = await api('POST', `/projects/${projectId}/members`, { email: d.email, role: 'developer' }, pmToken);
    assert(add.ok || String(add.message).toLowerCase().includes('already a member'), `Add member failed for ${d.email}: ${add.status} ${add.message}`);
    console.log(`✅ Added member: ${d.email}`);
  }

  section('5) PM creates 2 sprints');
  const sprint1 = await api(
    'POST',
    '/sprints',
    {
      title: `Sprint A ${runTag}`,
      startDate: nowIso(),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      projectId,
    },
    pmToken
  );
  assert(sprint1.ok, `Create sprint A failed: ${sprint1.status} ${sprint1.message}`);
  assert(sprint1.data.startDate, 'Sprint A missing planned startDate');
  assert(sprint1.data.endDate, 'Sprint A missing planned endDate');

  const sprint2 = await api(
    'POST',
    '/sprints',
    {
      title: `Sprint B ${runTag}`,
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      projectId,
    },
    pmToken
  );
  assert(sprint2.ok, `Create sprint B failed: ${sprint2.status} ${sprint2.message}`);
  assert(sprint2.data.startDate, 'Sprint B missing planned startDate');
  assert(sprint2.data.endDate, 'Sprint B missing planned endDate');

  console.log(`✅ Created sprints: ${sprint1.data._id}, ${sprint2.data._id}`);

  section('6) PM assigns tasks (3 devs in Sprint A, 2 devs in Sprint B)');
  const groupA = devUserRecords.slice(0, 3);
  const groupB = devUserRecords.slice(3, 5);

  const tasks = [];
  for (const d of groupA) {
    const t = await api(
      'POST',
      '/tasks',
      {
        title: `Task for ${d.name} (${runTag})`,
        description: 'System-test generated',
        status: 'todo',
        type: 'story',
        priority: 'medium',
        storyPoints: 5,
        project: projectId,
        sprint: sprint1.data._id,
        assignee: d.user._id,
      },
      pmToken
    );
    assert(t.ok, `Create task failed for ${d.email}: ${t.status} ${t.message}`);
    assert(t.data.addedToSprintAt, `Expected addedToSprintAt on created task for ${d.email}`);
    tasks.push({ title: t.data.title, id: t.data._id, assigneeEmail: d.email, sprintId: sprint1.data._id });
    console.log(`✅ Created+assigned: ${d.email} -> ${t.data._id}`);
  }

  for (const d of groupB) {
    const t = await api(
      'POST',
      '/tasks',
      {
        title: `Task for ${d.name} (${runTag})`,
        description: 'System-test generated',
        status: 'todo',
        type: 'task',
        priority: 'high',
        storyPoints: 8,
        project: projectId,
        sprint: sprint2.data._id,
        assignee: d.user._id,
      },
      pmToken
    );
    assert(t.ok, `Create task failed for ${d.email}: ${t.status} ${t.message}`);
    assert(t.data.addedToSprintAt, `Expected addedToSprintAt on created task for ${d.email}`);
    tasks.push({ title: t.data.title, id: t.data._id, assigneeEmail: d.email, sprintId: sprint2.data._id });
    console.log(`✅ Created+assigned: ${d.email} -> ${t.data._id}`);
  }

  section('6b) Telemetry: task churn counters increment (PM-only)');
  const churnTarget = tasks[0];
  const churnBefore = await api('GET', `/tasks/${churnTarget.id}`, null, pmToken);
  assert(churnBefore.ok, `Fetch churn target failed: ${churnBefore.status} ${churnBefore.message}`);

  const churnPatch = await api(
    'PATCH',
    `/tasks/${churnTarget.id}`,
    { priority: 'low', description: `Updated by PM at ${nowIso()}` },
    pmToken
  );
  assert(churnPatch.ok, `Patch churn target failed: ${churnPatch.status} ${churnPatch.message}`);

  const churnAfter = await api('GET', `/tasks/${churnTarget.id}`, null, pmToken);
  assert(churnAfter.ok, `Fetch churn target after patch failed: ${churnAfter.status} ${churnAfter.message}`);
  assert((churnAfter.data.changeCounters?.priorityChanges || 0) >= 1, 'Expected priorityChanges to increment');
  assert((churnAfter.data.changeCounters?.descriptionChanges || 0) >= 1, 'Expected descriptionChanges to increment');
  console.log('✅ Task churn counters incremented');

  section('6c) Telemetry: addedToSprintAt updates on sprint move');
  const moveTarget = tasks[1];
  const moveBefore = await api('GET', `/tasks/${moveTarget.id}`, null, pmToken);
  assert(moveBefore.ok, `Fetch move target failed: ${moveBefore.status} ${moveBefore.message}`);
  const beforeAdded = assertDateish(moveBefore.data.addedToSprintAt, 'Move target missing addedToSprintAt before move');

  const moveOut = await api('PATCH', `/tasks/${moveTarget.id}/sprint`, { sprintId: null }, pmToken);
  assert(moveOut.ok, `Move task out of sprint failed: ${moveOut.status} ${moveOut.message}`);
  const moveIn = await api('PATCH', `/tasks/${moveTarget.id}/sprint`, { sprintId: sprint1.data._id }, pmToken);
  assert(moveIn.ok, `Move task into sprint failed: ${moveIn.status} ${moveIn.message}`);

  const moveAfter = await api('GET', `/tasks/${moveTarget.id}`, null, pmToken);
  assert(moveAfter.ok, `Fetch move target after move failed: ${moveAfter.status} ${moveAfter.message}`);
  const afterAdded = assertDateish(moveAfter.data.addedToSprintAt, 'Move target missing addedToSprintAt after move');
  assert(afterAdded.getTime() >= beforeAdded.getTime(), 'Expected addedToSprintAt to be updated on move into sprint');
  console.log('✅ addedToSprintAt updated on sprint move');

  section('7) Realtime watchers connect (PM + Admin)');
  const adminWatcher = await connectWatcherSocket({ label: 'ADMIN', userId: admin._id, projectId });
  const pmWatcher = await connectWatcherSocket({ label: 'PM', userId: pmId, projectId });

  section('7b) Sprint lifecycle: PM starts Sprint A (realtime)');
  const sprintEventsBefore = pmWatcher.events.sprintStatusChanged.length;
  const startSprintA = await api('POST', `/sprints/${sprint1.data._id}/start`, {}, pmToken);
  assert(startSprintA.ok, `Start Sprint A failed: ${startSprintA.status} ${startSprintA.message}`);
  assertDateish(startSprintA.data.startedAt, 'Sprint A missing startedAt after start');
  assertDateish(startSprintA.data.originalEndDateAtStart, 'Sprint A missing originalEndDateAtStart after start');
  assertApproxSameTime(startSprintA.data.startDate, sprint1.data.startDate, 2000, 'Sprint A planned startDate changed on start (should not)');
  assertApproxSameTime(startSprintA.data.endDate, sprint1.data.endDate, 2000, 'Sprint A planned endDate changed on start (should not)');
  await sleep(300);
  const sprintEventsAfter = pmWatcher.events.sprintStatusChanged.length;
  assert(sprintEventsAfter > sprintEventsBefore, 'Expected sprint:status_changed realtime event after starting Sprint A');
  console.log('✅ Sprint A started and realtime event received');

  const startSprintB = await api('POST', `/sprints/${sprint2.data._id}/start`, {}, pmToken);
  assert(startSprintB.ok, `Start Sprint B failed: ${startSprintB.status} ${startSprintB.message}`);
  assertDateish(startSprintB.data.startedAt, 'Sprint B missing startedAt after start');
  console.log('✅ Sprint B started');

  section('7c) Telemetry: sprint extension tracking (wasExtended)');
  const extendTo = new Date(new Date(sprint1.data.endDate).getTime() + 2 * 86400000).toISOString();
  const extendRes = await api('PATCH', `/sprints/${sprint1.data._id}`, { endDate: extendTo }, pmToken);
  assert(extendRes.ok, `Extend Sprint A failed: ${extendRes.status} ${extendRes.message}`);
  assert(extendRes.data.wasExtended === true, 'Expected Sprint A wasExtended=true after extending planned endDate');
  console.log('✅ Sprint extension tracked');

  // Negative: dev cannot start sprint
  const devForSprintCheck = await login(creds.devs[0]);
  const devStartSprint = await api('POST', `/sprints/${sprint1.data._id}/start`, {}, devForSprintCheck.token);
  assert(!devStartSprint.ok && devStartSprint.status === 403, `Expected dev start sprint 403, got ${devStartSprint.status}`);
  console.log('✅ Dev cannot start sprint (403)');

  section('8) Devs login and update their task (status + comment + worklog + delete)');
  const statusSequence = ['inprogress', 'review', 'done'];

  for (const d of devUserRecords) {
    const devAuth = await login({ email: d.email, password: d.password });
    const devToken = devAuth.token;

    const myTask = tasks.find((t) => t.assigneeEmail === d.email);
    assert(myTask, `No task found for dev ${d.email}`);

    // 8a) status updates (emits task:moved)
    for (const st of statusSequence) {
      const upd = await api('PATCH', `/tasks/${myTask.id}/status`, { status: st }, devToken);
      assert(upd.ok, `Dev ${d.email} failed status->${st}: ${upd.status} ${upd.message}`);
      console.log(`✅ ${d.email} set status -> ${st}`);
    }

    // 8b) add comment
    const addComment = await api('POST', `/tasks/${myTask.id}/comment`, { text: `Comment from ${d.email} at ${nowIso()}` }, devToken);
    assert(addComment.ok, `Add comment failed for ${d.email}: ${addComment.status} ${addComment.message}`);

    // 8c) delete comment (must be allowed for same user)
    const taskAfterComment = await api('GET', `/tasks/${myTask.id}`, null, devToken);
    assert(taskAfterComment.ok, `Fetch task after comment failed: ${taskAfterComment.status} ${taskAfterComment.message}`);
    const lastComment = (taskAfterComment.data.comments || []).slice(-1)[0];
    assert(lastComment, 'Expected comment to exist on task');
    assert(lastComment.createdAt, 'Expected comment.createdAt to exist');

    const delComment = await api('DELETE', `/tasks/${myTask.id}/comment/${lastComment._id}`, null, devToken);
    assert(delComment.ok, `Delete comment failed for ${d.email}: ${delComment.status} ${delComment.message}`);

    // 8d) add worklog
    const addWorklog = await api('POST', `/tasks/${myTask.id}/worklog`, { hours: 1, description: `Worklog by ${d.email}`, date: nowIso() }, devToken);
    assert(addWorklog.ok, `Add worklog failed for ${d.email}: ${addWorklog.status} ${addWorklog.message}`);

    // 8e) delete that worklog
    const taskAfterWorklog = await api('GET', `/tasks/${myTask.id}`, null, devToken);
    assert(taskAfterWorklog.ok, `Fetch task after worklog failed: ${taskAfterWorklog.status} ${taskAfterWorklog.message}`);
    const lastWorklog = (taskAfterWorklog.data.worklogs || []).slice(-1)[0];
    assert(lastWorklog, 'Expected worklog to exist on task');
    assert(lastWorklog.createdAt, 'Expected worklog.createdAt to exist');
    assert(taskAfterWorklog.data.actualHours >= 1, `Expected actualHours to be >= 1, got ${taskAfterWorklog.data.actualHours}`);

    const delWorklog = await api('DELETE', `/tasks/${myTask.id}/worklog/${lastWorklog._id}`, null, devToken);
    assert(delWorklog.ok, `Delete worklog failed for ${d.email}: ${delWorklog.status} ${delWorklog.message}`);

    const taskAfterWorklogDelete = await api('GET', `/tasks/${myTask.id}`, null, devToken);
    assert(taskAfterWorklogDelete.ok, `Fetch task after worklog delete failed: ${taskAfterWorklogDelete.status} ${taskAfterWorklogDelete.message}`);
    assert(taskAfterWorklogDelete.data.actualHours === 0, `Expected actualHours to return to 0 after delete, got ${taskAfterWorklogDelete.data.actualHours}`);

    // 8f) Verify statusHistory timestamps
    const taskFinal = await api('GET', `/tasks/${myTask.id}`, null, devToken);
    assert(taskFinal.ok, `Fetch final task failed: ${taskFinal.status} ${taskFinal.message}`);
    const history = taskFinal.data.statusHistory || [];
    assert(history.length >= 3, `Expected statusHistory length >=3, got ${history.length}`);
    for (const h of history.slice(-3)) {
      assert(h.changedAt, 'Missing changedAt on statusHistory');
    }
  }

  section('9) Verify realtime events received');
  // Give sockets a moment to flush
  await sleep(500);

  const pmMoved = pmWatcher.events.taskMoved.length;
  const adminMoved = adminWatcher.events.taskMoved.length;
  console.log(`PM saw task:moved = ${pmMoved}`);
  console.log(`ADMIN saw task:moved = ${adminMoved}`);

  // Expect at least 5 devs * 3 status changes = 15 moved events
  assert(pmMoved >= 15, `Expected PM to receive >=15 task:moved events, got ${pmMoved}`);
  assert(adminMoved >= 15, `Expected ADMIN to receive >=15 task:moved events, got ${adminMoved}`);

  pmWatcher.socket.disconnect();
  adminWatcher.socket.disconnect();

  section('9b) Sprint completion + analytics/risk smoke tests');
  const completeA = await api('POST', `/sprints/${sprint1.data._id}/complete`, {}, pmToken);
  assert(completeA.ok, `Complete Sprint A failed: ${completeA.status} ${completeA.message}`);
  assert(completeA.data.status === 'completed', 'Sprint A expected status=completed');
  assertDateish(completeA.data.completedAt, 'Sprint A missing completedAt after complete');
  assert(completeA.data.completedPoints === 15, `Sprint A expected completedPoints=15, got ${completeA.data.completedPoints}`);
  assert(completeA.data.committedPoints === 15, `Sprint A expected committedPoints=15, got ${completeA.data.committedPoints}`);

  const completeB = await api('POST', `/sprints/${sprint2.data._id}/complete`, {}, pmToken);
  assert(completeB.ok, `Complete Sprint B failed: ${completeB.status} ${completeB.message}`);
  assert(completeB.data.status === 'completed', 'Sprint B expected status=completed');
  assertDateish(completeB.data.completedAt, 'Sprint B missing completedAt after complete');
  assert(completeB.data.completedPoints === 16, `Sprint B expected completedPoints=16, got ${completeB.data.completedPoints}`);
  assert(completeB.data.committedPoints === 16, `Sprint B expected committedPoints=16, got ${completeB.data.committedPoints}`);

  // Autopsy endpoint should respond
  const autopsy = await api('GET', `/sprints/${sprint1.data._id}/autopsy`, null, pmToken);
  assert(autopsy.ok, `Sprint autopsy failed: ${autopsy.status} ${autopsy.message}`);
  console.log('✅ Sprint completion + autopsy OK');

  // Analytics endpoints
  const burndown = await api('GET', `/analytics/burndown/${sprint1.data._id}`, null, pmToken);
  assert(burndown.ok, `Analytics burndown failed: ${burndown.status} ${burndown.message}`);
  const velocity = await api('GET', `/analytics/velocity/${projectId}`, null, pmToken);
  assert(velocity.ok, `Analytics velocity failed: ${velocity.status} ${velocity.message}`);
  const teamStats = await api('GET', `/analytics/team/${projectId}`, null, pmToken);
  assert(teamStats.ok, `Analytics team stats failed: ${teamStats.status} ${teamStats.message}`);
  const completion = await api('GET', `/analytics/completion/${sprint1.data._id}`, null, pmToken);
  assert(completion.ok, `Analytics completion failed: ${completion.status} ${completion.message}`);

  const overviewPm = await api('GET', '/analytics/overview', null, pmToken);
  assert(overviewPm.ok, `Analytics overview (PM) failed: ${overviewPm.status} ${overviewPm.message}`);
  assert(overviewPm.data?.stats, 'Analytics overview (PM) missing stats payload');

  const overviewAdmin = await api('GET', '/analytics/overview', null, adminToken);
  assert(overviewAdmin.ok, `Analytics overview (ADMIN) failed: ${overviewAdmin.status} ${overviewAdmin.message}`);
  assert(overviewAdmin.data?.stats, 'Analytics overview (ADMIN) missing stats payload');

  console.log('✅ Analytics endpoints OK');

  // Risk endpoints
  const sprintRisk = await api('GET', `/risk/sprint/${sprint1.data._id}`, null, pmToken);
  assert(sprintRisk.ok, `Risk sprint failed: ${sprintRisk.status} ${sprintRisk.message}`);
  const projectRisk = await api('GET', `/risk/project/${projectId}`, null, pmToken);
  assert(projectRisk.ok, `Risk project failed: ${projectRisk.status} ${projectRisk.message}`);
  const exec = await api('GET', `/risk/dashboard`, null, pmToken);
  assert(exec.ok, `Risk dashboard failed: ${exec.status} ${exec.message}`);
  console.log('✅ Risk endpoints OK');

  section('10) Verify audit logs exist for assignments (with timestamps)');
  const activity = await api('GET', '/admin/activity-logs', null, adminToken);
  assert(activity.ok, `Fetch activity logs failed: ${activity.status} ${activity.message}`);

  const logs = activity.data || [];
  const assignedLogs = logs.filter((l) => l.action === 'USER_ASSIGNED');
  const assignedSinceStart = assignedLogs.filter((l) => l.createdAt && new Date(l.createdAt) >= new Date(startedAt.getTime() - 60_000));
  assert(assignedSinceStart.length >= 5, `Expected >=5 USER_ASSIGNED logs from this run, got ${assignedSinceStart.length}`);
  const anyMissingDate = assignedSinceStart.some((l) => !l.createdAt);
  assert(!anyMissingDate, 'Some USER_ASSIGNED logs missing createdAt timestamp');
  console.log(`✅ Audit logs OK (USER_ASSIGNED this-run count=${assignedSinceStart.length})`);

  section('11) Negative RBAC checks');
  // Developer must not be able to create tasks
  const dev0 = devForSprintCheck;
  const devCreate = await api('POST', '/tasks', { title: 'Should fail', project: projectId }, dev0.token);
  assert(!devCreate.ok && devCreate.status === 403, `Expected dev create task 403, got ${devCreate.status}`);
  console.log('✅ Dev cannot create tasks (403)');

  // PM must not be able to access admin endpoints
  const pmAdminUsers = await api('GET', '/admin/users', null, pmToken);
  assert(!pmAdminUsers.ok && pmAdminUsers.status === 403, `Expected PM admin/users 403, got ${pmAdminUsers.status}`);
  console.log('✅ PM cannot access admin endpoints (403)');

  // Dev must not be able to access PM endpoints
  const devRoster = await api('GET', '/pm/my-developers', null, dev0.token);
  assert(!devRoster.ok && devRoster.status === 403, `Expected dev pm/my-developers 403, got ${devRoster.status}`);
  console.log('✅ Dev cannot access PM endpoints (403)');

  // PM must not be able to add a developer not managed by them
  const outsider = { name: `Outsider ${runTag}`, email: `outsider.${runTag}@agileai.local`, password: 'Dev1234!' };
  await ensureUserRegistered(outsider);

  const outsiderUser = await waitForAdminUserByEmail(adminToken, outsider.email);
  assert(outsiderUser, `Outsider user not found in admin list after retries: ${outsider.email}`);
  await adminPatchUser(adminToken, outsiderUser._id, { status: 'active', role: 'developer', managedBy: null });
  const pmAddOutsider = await api('POST', `/projects/${projectId}/members`, { email: outsider.email, role: 'developer' }, pmToken);
  assert(!pmAddOutsider.ok && pmAddOutsider.status === 403, `Expected PM add outsider 403, got ${pmAddOutsider.status}`);
  console.log('✅ PM cannot add unassigned developer to project (403)');

  console.log('\n🎉 SYSTEM TEST PASSED');
}

main().catch((err) => {
  console.error('\n❌ SYSTEM TEST FAILED');
  console.error(err?.stack || err?.message || err);
  process.exitCode = 1;
});
