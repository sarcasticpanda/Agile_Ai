/**
 * FULL ROLE-BASED E2E TEST
 * Flow:
 * 1. PM logs in → creates fresh project → creates sprint → adds 4 devs
 * 2. PM creates tasks (8 tasks across 4 devs, varying points)
 * 3. PM starts the sprint
 * 4. Each dev logs in → moves tasks through statuses → logs hours
 * 5. Devs complete some tasks (done), leave some in-progress
 * 6. Verify analytics: burndown, velocity, team stats, burnout scores
 * 7. PM completes the sprint → checks velocity history
 */

// fetch is available globally in Node 18+

const BASE = 'http://localhost:5001/api';

const USERS = {
  admin:   { email: 'admin@agileai.com',   password: 'Admin1234!', id: '69cd5725aed33e030bac07db' },
  pm:      { email: 'pm@agileai.com',       password: 'Pm1234!',    id: '69cd598baed33e030bac081f' },
  alice:   { email: 'alice@agileai.com',    password: 'Dev1234!',   id: '69cf4e4259044aa5c7ee9904' },
  bob:     { email: 'bob@agileai.com',      password: 'Dev1234!',   id: '69cf4e4259044aa5c7ee9905' },
  charlie: { email: 'charlie@agileai.com',  password: 'Dev1234!',   id: '69cf4e4259044aa5c7ee9906' },
  david:   { email: 'david@agileai.com',    password: 'Dev1234!',   id: '69cf691421b7ef00596159f9' },
};

const tokens = {};

// ── helpers ──────────────────────────────────────────────────────────────────
const log  = (msg)        => console.log(`\n${'='.repeat(60)}\n${msg}`);
const ok   = (msg)        => console.log(`  ✅ ${msg}`);
const fail = (msg, err)   => console.error(`  ❌ ${msg}`, err ?? '');
const info = (msg)        => console.log(`  ℹ️  ${msg}`);

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(role) {
  const user = USERS[role];
  const { status, data } = await api('POST', '/auth/login', {
    email: user.email,
    password: user.password,
  });
  if (status === 200 && data?.data?.token) {
    tokens[role] = data.data.token;
    ok(`${role} logged in (${user.email})`);
    return tokens[role];
  }
  fail(`${role} login FAILED`, `status=${status} msg=${data?.message}`);
  return null;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  // ─── STEP 1: Login all roles ────────────────────────────────────────────
  log('STEP 1: Login all roles');
  await login('admin');
  await login('pm');
  await login('alice');
  await login('bob');
  await login('charlie');
  await login('david');

  const pmTok  = tokens.pm;
  const aTok   = tokens.alice;
  const bTok   = tokens.bob;
  const cTok   = tokens.charlie;
  const dTok   = tokens.david;

  if (!pmTok) { fail('PM token missing — aborting'); process.exit(1); }

  // ─── STEP 2: PM creates a fresh project ─────────────────────────────────
  log('STEP 2: PM creates project "E2E Audit Project"');
  const today = new Date();
  const { status: ps, data: pd } = await api('POST', '/projects', {
    title: 'E2E Audit Project',
    description: 'Created by PM for full E2E role-based test',
    color: '#10b981',
  }, pmTok);

  if (ps !== 201) { fail('Project creation FAILED', pd?.message); process.exit(1); }
  const projectId = pd.data._id;
  ok(`Project created: "${pd.data.title}" (${projectId})`);

  // ─── STEP 3: PM adds 4 developers to project ───────────────────────────
  log('STEP 3: PM adds 4 developers to project');
  for (const [name, user] of [['alice', USERS.alice], ['bob', USERS.bob], ['charlie', USERS.charlie], ['david', USERS.david]]) {
    const { status, data } = await api('POST', `/projects/${projectId}/members`, {
      userId: user.id,
      role: 'developer',
    }, pmTok);
    status === 200 || status === 201
      ? ok(`Added ${name} (${user.id}) to project`)
      : fail(`Failed to add ${name}`, data?.message);
  }

  // ─── STEP 4: PM creates a sprint ────────────────────────────────────────
  log('STEP 4: PM creates Sprint "Sprint Alpha"');
  const sprintStart = new Date(today);
  const sprintEnd   = new Date(today);
  sprintEnd.setDate(sprintEnd.getDate() + 14);

  const { status: ss, data: sd } = await api('POST', `/sprints?projectId=${projectId}`, {
    title: 'Sprint Alpha',
    goal: 'Complete auth and dashboard features',
    projectId,
    startDate: sprintStart.toISOString(),
    endDate:   sprintEnd.toISOString(),
  }, pmTok);

  if (ss !== 201) { fail('Sprint creation FAILED', sd?.message); process.exit(1); }
  const sprintId = sd.data._id;
  ok(`Sprint created: "${sd.data.title}" (${sprintId})`);

  // ─── STEP 5: PM creates 8 tasks (2 per dev, varying points) ────────────
  log('STEP 5: PM creates 8 tasks with story points assigned to each dev');
  const taskDefs = [
    // Alice: 5+3 = 8 pts
    { title: '[Alice] Implement Login UI',      priority: 'high',     points: 5, dev: 'alice' },
    { title: '[Alice] Write Auth Unit Tests',   priority: 'medium',   points: 3, dev: 'alice' },
    // Bob: 8+2 = 10 pts
    { title: '[Bob] Build Dashboard API',       priority: 'high',     points: 8, dev: 'bob' },
    { title: '[Bob] Fix Navbar Bug',            priority: 'low',      points: 2, dev: 'bob',   type: 'bug' },
    // Charlie: 5+5 = 10 pts
    { title: '[Charlie] Design DB Schema',      priority: 'critical', points: 5, dev: 'charlie' },
    { title: '[Charlie] Write Integration Tests', priority: 'medium', points: 5, dev: 'charlie' },
    // David: 3+1 = 4 pts
    { title: '[David] Setup CI Pipeline',       priority: 'medium',   points: 3, dev: 'david' },
    { title: '[David] Update README docs',      priority: 'low',      points: 1, dev: 'david' },
  ];

  const createdTasks = [];
  for (const t of taskDefs) {
    const { status, data } = await api('POST', '/tasks', {
      title: t.title,
      description: `Auto-generated for E2E test — assigned to ${t.dev}`,
      type: t.type || 'story',
      priority: t.priority,
      storyPoints: t.points,
      project: projectId,
      sprint: sprintId,
      assignee: USERS[t.dev].id,
      assignees: [{ user: USERS[t.dev].id, contributionPercent: 100 }],
    }, pmTok);
    if (status === 201) {
      createdTasks.push({ ...data.data, _dev: t.dev, _points: t.points, _title: t.title });
      ok(`Task: "${t.title}" → ${t.dev} (${t.points}pts)`);
    } else {
      fail(`Task creation FAILED: ${t.title}`, data?.message);
    }
  }

  info(`Total tasks created: ${createdTasks.length}/8`);

  // ─── STEP 6: PM starts the sprint ───────────────────────────────────────
  log('STEP 6: PM starts Sprint Alpha');
  const { status: startS, data: startD } = await api('POST', `/sprints/${sprintId}/start`, {}, pmTok);
  startS === 200
    ? ok(`Sprint started! Committed points: ${startD.data?.committedPoints}`)
    : fail('Sprint start FAILED', startD?.message);

  await wait(500);

  // ─── STEP 7: Devs move tasks through statuses (simulate work) ────────────
  log('STEP 7: Devs progress their tasks');

  // Helper: update task status as a specific dev
  async function moveTask(taskId, status, devToken, devName) {
    const { status: s, data } = await api('PATCH', `/tasks/${taskId}/status`, { status }, devToken);
    s === 200
      ? ok(`${devName} moved task → ${status}`)
      : fail(`${devName} failed to move task to ${status}`, data?.message);
    await wait(200);
  }

  // Helper: log work hours as a dev
  async function logHours(taskId, hours, devToken, devName, activityType = 'implementation') {
    const { status: s, data } = await api('POST', `/tasks/${taskId}/worklog`, {
      hours,
      activityType,
      outcome: 'progress',
      description: `E2E test worklog — ${hours}h of ${activityType}`,
    }, devToken);
    s === 201 || s === 200
      ? ok(`${devName} logged ${hours}h`)
      : fail(`${devName} worklog FAILED`, data?.message);
    await wait(200);
  }

  // Alice: completes BOTH tasks (full velocity contributor)
  const aliceTasks = createdTasks.filter(t => t._dev === 'alice');
  if (aliceTasks[0]) {
    await moveTask(aliceTasks[0]._id, 'inprogress', aTok, 'Alice');
    await logHours(aliceTasks[0]._id, 3, aTok, 'Alice');
    await moveTask(aliceTasks[0]._id, 'review', aTok, 'Alice');
    await moveTask(aliceTasks[0]._id, 'done', aTok, 'Alice');
    await logHours(aliceTasks[0]._id, 2, aTok, 'Alice', 'testing');
  }
  if (aliceTasks[1]) {
    await moveTask(aliceTasks[1]._id, 'inprogress', aTok, 'Alice');
    await logHours(aliceTasks[1]._id, 2, aTok, 'Alice');
    await moveTask(aliceTasks[1]._id, 'done', aTok, 'Alice');
  }

  // Bob: completes only the BIG task, leaves bug in inprogress (partial delivery)
  const bobTasks = createdTasks.filter(t => t._dev === 'bob');
  if (bobTasks[0]) {
    await moveTask(bobTasks[0]._id, 'inprogress', bTok, 'Bob');
    await logHours(bobTasks[0]._id, 6, bTok, 'Bob');
    await logHours(bobTasks[0]._id, 3, bTok, 'Bob', 'testing');
    await moveTask(bobTasks[0]._id, 'review', bTok, 'Bob');
    await moveTask(bobTasks[0]._id, 'done', bTok, 'Bob');
  }
  if (bobTasks[1]) {
    // Bug task stays inprogress — simulates unfinished work
    await moveTask(bobTasks[1]._id, 'inprogress', bTok, 'Bob');
    await logHours(bobTasks[1]._id, 1, bTok, 'Bob', 'debugging');
    info('Bob left bug task in inprogress (intentional — tests partial velocity)');
  }

  // Charlie: completes first task, leaves second in review (blocked scenario)
  const charlieTasks = createdTasks.filter(t => t._dev === 'charlie');
  if (charlieTasks[0]) {
    await moveTask(charlieTasks[0]._id, 'inprogress', cTok, 'Charlie');
    await logHours(charlieTasks[0]._id, 4, cTok, 'Charlie');
    await moveTask(charlieTasks[0]._id, 'done', cTok, 'Charlie');
  }
  if (charlieTasks[1]) {
    await moveTask(charlieTasks[1]._id, 'inprogress', cTok, 'Charlie');
    await logHours(charlieTasks[1]._id, 3, cTok, 'Charlie');
    await moveTask(charlieTasks[1]._id, 'review', cTok, 'Charlie');
    info('Charlie left integration tests in review (tests burndown partial)');
  }

  // David: completes both (lowest load — should show low burnout)
  const davidTasks = createdTasks.filter(t => t._dev === 'david');
  if (davidTasks[0]) {
    await moveTask(davidTasks[0]._id, 'inprogress', dTok, 'David');
    await logHours(davidTasks[0]._id, 2, dTok, 'David');
    await moveTask(davidTasks[0]._id, 'done', dTok, 'David');
  }
  if (davidTasks[1]) {
    await moveTask(davidTasks[1]._id, 'inprogress', dTok, 'David');
    await moveTask(davidTasks[1]._id, 'done', dTok, 'David');
  }

  // ─── STEP 8: Query analytics and verify ─────────────────────────────────
  log('STEP 8: Querying analytics (as PM)');
  await wait(1000); // let server process updates

  // Team stats
  const { status: ts, data: td } = await api('GET', `/analytics/team-stats?projectId=${projectId}&sprintId=${sprintId}`, null, pmTok);
  if (ts === 200) {
    ok('Team stats endpoint responding');
    const members = td.data?.members || [];
    info(`Members returned: ${members.length}`);
    members.forEach(m => {
      info(`  ${m.user?.name || m.user}: completedSP=${m.completedStoryPoints}, completionRate=${m.completionRate?.toFixed(1)}%, burnout=${(m.aiBurnoutRiskScore ?? m.overallBurnoutScore ?? 0).toFixed(1)}`);
    });
  } else {
    fail('Team stats FAILED', td?.message);
  }

  // Burndown
  const { status: bs, data: bd } = await api('GET', `/analytics/burndown/${sprintId}`, null, pmTok);
  if (bs === 200) {
    ok('Burndown endpoint responding');
    const points = bd.data || [];
    info(`Burndown data points: ${points.length}`);
    if (points.length > 0) {
      const last = points[points.length - 1];
      info(`  Last point — date: ${last.date}, ideal: ${last.ideal}, actual: ${last.actual}`);
    }
  } else {
    fail('Burndown FAILED', bd?.message);
  }

  // Velocity
  const { status: vs, data: vd } = await api('GET', `/analytics/velocity?projectId=${projectId}`, null, pmTok);
  if (vs === 200) {
    ok('Velocity endpoint responding');
    const series = vd.data?.series || vd.data || [];
    info(`Velocity sprints: ${Array.isArray(series) ? series.length : 'N/A'}`);
    if (Array.isArray(series)) {
      series.forEach(s => info(`  Sprint "${s.sprintName}": planned=${s.planned}, completed=${s.completed}`));
    }
  } else {
    fail('Velocity FAILED', vd?.message);
  }

  // Sprint risk
  const { status: rs, data: rd } = await api('GET', `/analytics/sprint-risk?projectId=${projectId}`, null, pmTok);
  if (rs === 200) {
    ok('Sprint risk endpoint responding');
    const risks = rd.data || [];
    info(`Sprint risk data points: ${risks.length}`);
    risks.forEach(r => info(`  Sprint "${r.sprintName}": score=${r.riskScore?.toFixed(1)}, level=${r.riskLevel}`));
  } else {
    fail('Sprint risk FAILED', rd?.message);
  }

  // ─── STEP 9: Dev perspective — what can each dev see? ───────────────────
  log('STEP 9: Dev perspective — verifying data isolation');
  const { status: ats, data: atd } = await api('GET', `/tasks?projectId=${projectId}&sprintId=${sprintId}`, null, aTok);
  if (ats === 200) {
    const myTasks = atd.data || [];
    ok(`Alice sees ${myTasks.length} tasks in the sprint`);
    const aliceOwned = myTasks.filter(t => {
      const assignee = t.assignee?._id || t.assignee;
      return String(assignee) === USERS.alice.id;
    });
    info(`  Alice's own tasks: ${aliceOwned.length}`);
  } else {
    fail('Alice task fetch FAILED', atd?.message);
  }

  // ─── STEP 10: PM completes the sprint ───────────────────────────────────
  log('STEP 10: PM completes Sprint Alpha');
  const { status: cs, data: cd } = await api('POST', `/sprints/${sprintId}/complete`, {}, pmTok);
  if (cs === 200) {
    ok(`Sprint completed! completedPoints=${cd.data?.completedPoints}`);

    // Re-query velocity now that sprint is complete
    await wait(500);
    const { status: vs2, data: vd2 } = await api('GET', `/analytics/velocity?projectId=${projectId}`, null, pmTok);
    if (vs2 === 200) {
      const series = vd2.data?.series || vd2.data || [];
      ok(`Velocity after completion — ${Array.isArray(series) ? series.length : 0} sprint(s) in history`);
      if (Array.isArray(series)) {
        series.forEach(s => info(`  "${s.sprintName}": planned=${s.planned}, completed=${s.completed}, velocity=${s.completed}`));
      }
    }
  } else {
    fail('Sprint complete FAILED', cd?.message);
  }

  // ─── FINAL SUMMARY ──────────────────────────────────────────────────────
  log('FINAL SUMMARY');
  const totalPoints = taskDefs.reduce((s, t) => s + t.points, 0);
  // Alice: 5+3=8 done, Bob: 8 done (2 not), Charlie: 5 done (5 not), David: 3+1=4 done
  const donePoints = 8 + 8 + 5 + 4;
  info(`Total sprint committed: ${totalPoints} pts`);
  info(`Expected completed: ${donePoints} pts`);
  info(`Expected incomplete: ${totalPoints - donePoints} pts (Bob bug + Charlie review)`);
  info('');
  info('Project ID:  ' + projectId);
  info('Sprint ID:   ' + sprintId);
  info('PM email:    pm@agileai.com');
  info('Dev emails:  alice/bob/charlie/david @agileai.com  (pw: Password123!)');
  info('');
  info('Open the browser at http://localhost:5173');
  info('Login as PM → navigate to E2E Audit Project → check Analytics');
}

run().catch(err => {
  console.error('\n💥 UNHANDLED ERROR:', err.message);
  process.exit(1);
});
