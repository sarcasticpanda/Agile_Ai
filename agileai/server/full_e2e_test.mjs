/**
 * AgileAI Full E2E Test Script
 * 
 * This script:
 * 1. Logs in as PM and creates a project, 2 sprints, 5 tasks
 * 2. Assigns tasks to 5 developers
 * 3. Starts Sprint Alpha
 * 4. Logs in as each dev and updates task statuses
 * 5. Logs in as admin and verifies data
 * 
 * Run: node full_e2e_test.mjs
 */

const BASE = 'http://localhost:5001/api';

async function api(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ ${method} ${path} → ${res.status}:`, data.message || data);
    return { ok: false, status: res.status, data };
  }
  return { ok: true, status: res.status, data: data.data, message: data.message };
}

// Credentials
const ADMIN = { email: 'admin@agileai.com', password: 'Admin1234!' };
const PM = { email: 'pm1@testx.com', password: 'Test1234!' };
const DEVS = [
  { email: 'dev1@testx.com', password: 'Test1234!', name: 'Dev One' },
  { email: 'dev2@testx.com', password: 'Test1234!', name: 'Dev Two' },
  { email: 'dev3@testx.com', password: 'Test1234!', name: 'Dev Three' },
  { email: 'dev4@testx.com', password: 'Test1234!', name: 'Dev Four' },
  { email: 'dev5@testx.com', password: 'Test1234!', name: 'Dev Five' },
];

let results = [];
function log(step, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} [${step}] ${status} ${detail}`);
  results.push({ step, status, detail });
}

async function main() {
  console.log('\n========================================');
  console.log('   AgileAI Full E2E Test Suite');
  console.log('========================================\n');

  // ─── PHASE 1: LOGIN ALL USERS ─────────────────────────────────
  console.log('\n─── PHASE 1: Authentication ───\n');

  const adminLogin = await api('POST', '/auth/login', ADMIN);
  if (!adminLogin.ok) { log('Admin Login', 'FAIL', 'Cannot login as admin'); return; }
  const adminToken = adminLogin.data.token;
  log('Admin Login', 'PASS', `Token received`);

  const pmLogin = await api('POST', '/auth/login', PM);
  if (!pmLogin.ok) { log('PM Login', 'FAIL', 'Cannot login as PM — is account active?'); return; }
  const pmToken = pmLogin.data.token;
  const pmId = pmLogin.data._id;
  log('PM Login', 'PASS', `PM ID: ${pmId}`);

  const devTokens = {};
  const devIds = {};
  for (const dev of DEVS) {
    const devLogin = await api('POST', '/auth/login', dev);
    if (!devLogin.ok) { log(`${dev.name} Login`, 'FAIL'); continue; }
    devTokens[dev.email] = devLogin.data.token;
    devIds[dev.email] = devLogin.data._id;
    log(`${dev.name} Login`, 'PASS', `ID: ${devLogin.data._id}`);
  }

  // ─── PHASE 2: ADMIN VERIFIES DEVS ARE ASSIGNED TO PM ──────────
  console.log('\n─── PHASE 2: Admin Team Verification ───\n');

  const usersRes = await api('GET', '/admin/users', null, adminToken);
  if (!usersRes.ok) { log('Admin Get Users', 'FAIL'); return; }
  
  const allUsers = usersRes.data;
  const assignedDevs = allUsers.filter(u => u.role === 'developer' && u.managedBy === pmId);
  log('Devs Assigned to PM', assignedDevs.length === 5 ? 'PASS' : 'WARN', `${assignedDevs.length}/5 devs assigned to PM`);

  // If not all assigned, assign them now
  for (const dev of DEVS) {
    const userId = devIds[dev.email];
    const userRecord = allUsers.find(u => u._id === userId);
    if (userRecord && userRecord.managedBy !== pmId) {
      await api('PATCH', `/admin/users/${userId}`, { managedBy: pmId }, adminToken);
      console.log(`   → Assigned ${dev.name} to PM`);
    }
  }

  // ─── PHASE 3: PM CREATES PROJECT ──────────────────────────────
  console.log('\n─── PHASE 3: Project Creation ───\n');

  // Check if project already exists
  const existingProjects = await api('GET', '/projects', null, pmToken);
  let projectId;
  const existingProject = (existingProjects.data || []).find(p => p.title === 'E2E Test Project');
  
  if (existingProject) {
    projectId = existingProject._id;
    log('Project Exists', 'PASS', `Using existing project ${projectId}`);
  } else {
    const createProject = await api('POST', '/projects', {
      title: 'E2E Test Project',
      description: 'Full end-to-end test project',
      color: '#4F46E5',
    }, pmToken);
    if (!createProject.ok) { log('Create Project', 'FAIL', createProject.data?.message); return; }
    projectId = createProject.data._id;
    log('Create Project', 'PASS', `Project ID: ${projectId}`);
  }

  // Add devs as members to the project
  for (const dev of DEVS) {
    const addMember = await api('POST', `/projects/${projectId}/members`, { email: dev.email, role: 'developer' }, pmToken);
    if (addMember.ok) {
      log(`Add ${dev.name} to Project`, 'PASS');
    } else {
      log(`Add ${dev.name} to Project`, addMember.data?.message?.includes('already') ? 'PASS' : 'WARN', addMember.data?.message);
    }
  }

  // ─── PHASE 4: CREATE SPRINTS ──────────────────────────────────
  console.log('\n─── PHASE 4: Sprint Creation ───\n');

  // Clean up — check existing sprints
  const existingSprints = await api('GET', `/sprints?projectId=${projectId}`, null, pmToken);
  let sprintAlphaId, sprintBetaId;

  const existingAlpha = (existingSprints.data || []).find(s => s.title === 'Sprint Alpha');
  const existingBeta = (existingSprints.data || []).find(s => s.title === 'Sprint Beta');

  if (existingAlpha) {
    sprintAlphaId = existingAlpha._id;
    log('Sprint Alpha', 'PASS', `Already exists: ${sprintAlphaId}`);
  } else {
    const createAlpha = await api('POST', '/sprints', {
      title: 'Sprint Alpha',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-14T00:00:00.000Z',
      projectId,
    }, pmToken);
    if (!createAlpha.ok) { log('Create Sprint Alpha', 'FAIL', createAlpha.data?.message); return; }
    sprintAlphaId = createAlpha.data._id;
    log('Create Sprint Alpha', 'PASS', `ID: ${sprintAlphaId}`);
  }

  if (existingBeta) {
    sprintBetaId = existingBeta._id;
    log('Sprint Beta', 'PASS', `Already exists: ${sprintBetaId}`);
  } else {
    const createBeta = await api('POST', '/sprints', {
      title: 'Sprint Beta',
      startDate: '2026-04-15T00:00:00.000Z',
      endDate: '2026-04-28T00:00:00.000Z',
      projectId,
    }, pmToken);
    if (!createBeta.ok) { log('Create Sprint Beta', 'FAIL', createBeta.data?.message); return; }
    sprintBetaId = createBeta.data._id;
    log('Create Sprint Beta', 'PASS', `ID: ${sprintBetaId}`);
  }

  // ─── PHASE 5: CREATE TASKS ────────────────────────────────────
  console.log('\n─── PHASE 5: Task Creation ───\n');

  const taskDefs = [
    { title: 'Build Auth System', type: 'story', priority: 'high', sprint: sprintAlphaId, assigneeEmail: 'dev1@testx.com' },
    { title: 'Fix Login Bug', type: 'bug', priority: 'critical', sprint: sprintAlphaId, assigneeEmail: 'dev2@testx.com' },
    { title: 'Write API Docs', type: 'task', priority: 'medium', sprint: sprintAlphaId, assigneeEmail: 'dev3@testx.com' },
    { title: 'Setup CI/CD Pipeline', type: 'story', priority: 'high', sprint: sprintBetaId, assigneeEmail: 'dev4@testx.com' },
    { title: 'Database Optimization', type: 'task', priority: 'low', sprint: sprintBetaId, assigneeEmail: 'dev5@testx.com' },
  ];

  const taskIds = {};

  // Check for existing tasks
  const existingTasks = await api('GET', `/tasks?projectId=${projectId}`, null, pmToken);
  const existingTaskTitles = (existingTasks.data || []).map(t => t.title);

  for (const taskDef of taskDefs) {
    const existing = (existingTasks.data || []).find(t => t.title === taskDef.title);
    if (existing) {
      taskIds[taskDef.title] = existing._id;
      log(`Task "${taskDef.title}"`, 'PASS', `Already exists: ${existing._id}`);
      continue;
    }

    const createTask = await api('POST', '/tasks', {
      title: taskDef.title,
      type: taskDef.type,
      priority: taskDef.priority,
      project: projectId,
      sprint: taskDef.sprint,
    }, pmToken);

    if (!createTask.ok) {
      log(`Create "${taskDef.title}"`, 'FAIL', createTask.data?.message);
      continue;
    }
    taskIds[taskDef.title] = createTask.data._id;
    log(`Create "${taskDef.title}"`, 'PASS', `ID: ${createTask.data._id}`);
  }

  // ─── PHASE 6: ASSIGN TASKS TO DEVS ───────────────────────────
  console.log('\n─── PHASE 6: Task Assignment ───\n');

  for (const taskDef of taskDefs) {
    const taskId = taskIds[taskDef.title];
    const devId = devIds[taskDef.assigneeEmail];
    if (!taskId || !devId) { log(`Assign "${taskDef.title}"`, 'SKIP', 'Missing ID'); continue; }

    const assign = await api('PATCH', `/tasks/${taskId}`, { assignee: devId }, pmToken);
    if (assign.ok) {
      log(`Assign "${taskDef.title}" → ${taskDef.assigneeEmail}`, 'PASS');
    } else {
      log(`Assign "${taskDef.title}"`, 'FAIL', assign.data?.message);
    }
  }

  // ─── PHASE 7: START SPRINT ALPHA ──────────────────────────────
  console.log('\n─── PHASE 7: Start Sprint Alpha ───\n');

  // Check sprint status first
  const sprintCheck = await api('GET', `/sprints/${sprintAlphaId}`, null, pmToken);
  if (sprintCheck.ok && sprintCheck.data.status === 'active') {
    log('Sprint Alpha Already Active', 'PASS');
  } else {
    const startSprint = await api('POST', `/sprints/${sprintAlphaId}/start`, {}, pmToken);
    if (startSprint.ok) {
      log('Start Sprint Alpha', 'PASS', `Status: ${startSprint.data.status}`);
    } else {
      log('Start Sprint Alpha', 'FAIL', startSprint.data?.message);
    }
  }

  // ─── PHASE 8: DEVS UPDATE TASK STATUSES ───────────────────────
  console.log('\n─── PHASE 8: Developer Task Updates ───\n');

  // Dev 1: Move "Build Auth System" → inprogress
  const dev1Task = taskIds['Build Auth System'];
  if (dev1Task) {
    const update1 = await api('PATCH', `/tasks/${dev1Task}/status`, { status: 'inprogress' }, devTokens['dev1@testx.com']);
    log('Dev1: Build Auth System → inprogress', update1.ok ? 'PASS' : 'FAIL', update1.data?.message || '');
  }

  // Dev 2: Move "Fix Login Bug" → inprogress
  const dev2Task = taskIds['Fix Login Bug'];
  if (dev2Task) {
    const update2 = await api('PATCH', `/tasks/${dev2Task}/status`, { status: 'inprogress' }, devTokens['dev2@testx.com']);
    log('Dev2: Fix Login Bug → inprogress', update2.ok ? 'PASS' : 'FAIL');
  }

  // Dev 3: Move "Write API Docs" → review
  const dev3Task = taskIds['Write API Docs'];
  if (dev3Task) {
    const update3 = await api('PATCH', `/tasks/${dev3Task}/status`, { status: 'review' }, devTokens['dev3@testx.com']);
    log('Dev3: Write API Docs → review', update3.ok ? 'PASS' : 'FAIL');
  }

  // Dev 1: Move "Build Auth System" → done  
  if (dev1Task) {
    const update1b = await api('PATCH', `/tasks/${dev1Task}/status`, { status: 'done' }, devTokens['dev1@testx.com']);
    log('Dev1: Build Auth System → done', update1b.ok ? 'PASS' : 'FAIL');
  }

  // ─── PHASE 9: VERIFY TASK STATES ─────────────────────────────
  console.log('\n─── PHASE 9: Verification ───\n');

  // Get all tasks as PM and verify statuses
  const finalTasks = await api('GET', `/tasks?projectId=${projectId}`, null, pmToken);
  if (finalTasks.ok) {
    const tasks = finalTasks.data || [];
    for (const task of tasks) {
      console.log(`   📋 "${task.title}" → Status: ${task.status} | Assignee: ${task.assignee?.name || 'none'} | Sprint: ${task.sprint || 'backlog'}`);
    }
    
    const authTask = tasks.find(t => t.title === 'Build Auth System');
    log('Verify Auth System = done', authTask?.status === 'done' ? 'PASS' : 'FAIL', `Actual: ${authTask?.status}`);
    
    const loginTask = tasks.find(t => t.title === 'Fix Login Bug');
    log('Verify Login Bug = inprogress', loginTask?.status === 'inprogress' ? 'PASS' : 'FAIL', `Actual: ${loginTask?.status}`);
    
    const docsTask = tasks.find(t => t.title === 'Write API Docs');
    log('Verify API Docs = review', docsTask?.status === 'review' ? 'PASS' : 'FAIL', `Actual: ${docsTask?.status}`);
  }

  // Verify as Admin
  const adminTasks = await api('GET', `/tasks?projectId=${projectId}`, null, adminToken);
  log('Admin Can See All Tasks', adminTasks.ok ? 'PASS' : 'FAIL', `${(adminTasks.data || []).length} tasks visible`);

  // Verify devs see their own tasks
  for (const dev of DEVS) {
    const devTasks = await api('GET', `/tasks?assigneeId=${devIds[dev.email]}`, null, devTokens[dev.email]);
    const count = (devTasks.data || []).length;
    log(`${dev.name} My Tasks`, count > 0 ? 'PASS' : 'FAIL', `${count} task(s) visible`);
  }

  // ─── PHASE 10: FINAL SUMMARY ─────────────────────────────────
  console.log('\n========================================');
  console.log('   TEST RESULTS SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN' || r.status === 'SKIP').length;
  
  console.log(`   ✅ PASSED: ${passed}`);
  console.log(`   ❌ FAILED: ${failed}`);
  console.log(`   ⚠️  WARNS:  ${warned}`);
  console.log(`   📊 TOTAL:  ${results.length}`);
  console.log();

  if (failed > 0) {
    console.log('   FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.step}: ${r.detail}`);
    });
  }

  console.log('\n========================================');
  console.log('  KEY DATA FOR BROWSER VERIFICATION');
  console.log('========================================');
  console.log(`  Project ID:       ${projectId}`);
  console.log(`  Sprint Alpha ID:  ${sprintAlphaId}`);
  console.log(`  Sprint Beta ID:   ${sprintBetaId}`);
  console.log(`  PM URL:   http://localhost:5173/pm/projects/${projectId}/backlog`);
  console.log(`  Board URL: http://localhost:5173/pm/projects/${projectId}/sprints/${sprintAlphaId}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
