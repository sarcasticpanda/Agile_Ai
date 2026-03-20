// Role-based API test script (ESM-compatible)
import fetch from 'node:http';
const BASE = 'http://localhost:5001/api';

async function api(method, path, body, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: 5000,
    };
    const req = fetch.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ ok: false, status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', e => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'TIMEOUT' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function pass(msg) { console.log('\x1b[32m  ✅ PASS:\x1b[0m', msg); }
function fail(msg) { console.log('\x1b[31m  ❌ FAIL:\x1b[0m', msg); }
function info(msg) { console.log('\x1b[36m  ℹ️  INFO:\x1b[0m', msg); }
function section(msg) { console.log('\n\x1b[33m=== ' + msg + ' ===\x1b[0m'); }

async function run() {
  section('1. SERVER HEALTH CHECK');
  const health = await api('GET', '/../', null, null);
  if (health.ok || health.status > 0) {
    pass(`Server is reachable (status ${health.status})`);
  } else {
    fail(`Server unreachable: ${health.error}`);
    console.log('\nERROR: Cannot reach the server at localhost:5001. Please ensure the server is running.');
    process.exit(1);
  }

  section('2. ADMIN USER REGISTRATION');
  let adminToken, adminRole, pmId, pmToken, devToken;
  let adminRes = await api('POST', '/auth/register', { name: 'Admin User', email: 'admin@agileai.com', password: 'Admin123!' });
  if (adminRes.ok) {
    adminToken = adminRes.body?.data?.token;
    adminRole = adminRes.body?.data?.role;
    pass(`Admin registered. Role: ${adminRole}`);
  } else if (adminRes.status === 400) {
    info('Admin already exists. Logging in...');
    let loginRes = await api('POST', '/auth/login', { email: 'admin@agileai.com', password: 'Admin123!' });
    if (loginRes.ok) { adminToken = loginRes.body?.data?.token; adminRole = loginRes.body?.data?.role; pass(`Admin logged in. Role: ${adminRole}`); }
    else fail(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
  } else fail(`Unexpected error: ${JSON.stringify(adminRes.body)}`);

  section('3. PM USER REGISTRATION');
  let pmRes = await api('POST', '/auth/register', { name: 'PM User', email: 'pm@agileai.com', password: 'PM12345!' });
  if (pmRes.ok) {
    pmToken = pmRes.body?.data?.token;
    pmId = pmRes.body?.data?._id;
    pass(`PM registered. ID: ${pmId}, Role: ${pmRes.body?.data?.role}`);
  } else if (pmRes.status === 400) {
    info('PM already exists. Logging in...');
    let loginRes = await api('POST', '/auth/login', { email: 'pm@agileai.com', password: 'PM12345!' });
    if (loginRes.ok) { pmToken = loginRes.body?.data?.token; pmId = loginRes.body?.data?._id; pass(`PM logged in. Role: ${loginRes.body?.data?.role}`); }
    else fail(`PM login failed`);
  } else fail(`PM reg error: ${JSON.stringify(pmRes.body)}`);

  section('4. DEVELOPER USER REGISTRATION');
  let devRes = await api('POST', '/auth/register', { name: 'Dev User', email: 'dev@agileai.com', password: 'Dev12345!' });
  if (devRes.ok) {
    devToken = devRes.body?.data?.token;
    pass(`Dev registered. Role: ${devRes.body?.data?.role}`);
  } else if (devRes.status === 400) {
    info('Dev already exists. Logging in...');
    let loginRes = await api('POST', '/auth/login', { email: 'dev@agileai.com', password: 'Dev12345!' });
    if (loginRes.ok) { devToken = loginRes.body?.data?.token; pass(`Dev logged in. Role: ${loginRes.body?.data?.role}`); }
    else fail(`Dev login failed`);
  } else fail(`Dev reg error: ${JSON.stringify(devRes.body)}`);

  section('5. ADMIN ROLE - FEATURE TESTS');
  if (adminToken) {
    // Admin: get system stats
    let statsRes = await api('GET', '/admin/stats', null, adminToken);
    if (statsRes.ok) pass(`Admin can access /admin/stats: ${JSON.stringify(statsRes.body?.data)}`);
    else fail(`Admin /admin/stats returned ${statsRes.status}`);

    // Admin: get users
    let usersRes = await api('GET', '/admin/users', null, adminToken);
    if (usersRes.ok) {
      const users = usersRes.body?.data || [];
      pass(`Admin can view ${users.length} users`);
      users.forEach(u => info(`  ${u.name} | ${u.email} | Role: ${u.role}`));
      // find the PM to upgrade role
      const pmUser = users.find(u => u.email === 'pm@agileai.com');
      if (pmUser) {
        pmId = pmUser._id;
        let upgradeRes = await api('PATCH', `/admin/users/${pmId}`, { role: 'pm' }, adminToken);
        if (upgradeRes.ok) pass(`Admin upgraded pm@agileai.com to role 'pm'`);
        else fail(`Role upgrade failed: ${upgradeRes.status}`);
      }
    } else fail(`Admin /admin/users returned ${usersRes.status}`);

    // Admin: create project
    let projRes = await api('POST', '/projects', { name: 'Alpha Project', description: 'Integration test project', status: 'planning', color: '#4f46e5' }, adminToken);
    if (projRes.ok) {
      const projId = projRes.body?.data?._id;
      pass(`Admin created project: ${projId}`);

      // Create sprint in project
      let sprintRes = await api('POST', `/projects/${projId}/sprints`, { name: 'Sprint 1', startDate: '2026-03-18', endDate: '2026-04-01', project: projId }, adminToken);
      if (sprintRes.ok) {
        const sprintId = sprintRes.body?.data?._id;
        pass(`Admin created sprint: ${sprintId}`);
        // Start sprint
        let startRes = await api('POST', `/projects/${projId}/sprints/${sprintId}/start`, null, adminToken);
        if (startRes.ok) pass(`Admin started Sprint 1`);
        else fail(`Admin start sprint failed: ${startRes.status}`);
      } else fail(`Admin create sprint failed: ${sprintRes.status}`);

      // Create task
      let taskRes = await api('POST', `/projects/${projId}/tasks`, { title: 'Fix login bug', type: 'Bug', priority: 'High', storyPoints: 3, project: projId }, adminToken);
      if (taskRes.ok) {
        const taskId = taskRes.body?.data?._id;
        pass(`Admin created task: ${taskId}`);
        
        // Test Dev can move task (kanban)
        section('6. DEVELOPER ROLE - KANBAN MOVE (PATCH task status)');
        if (devToken) {
          let moveRes = await api('PATCH', `/projects/${projId}/tasks/${taskId}/status`, { status: 'In Progress' }, devToken);
          if (moveRes.ok) pass(`Dev can move task to "In Progress" on Kanban board`);
          else fail(`Dev move task failed: ${moveRes.status}`);
          // Dev: add comment
          let commentRes = await api('POST', `/projects/${projId}/tasks/${taskId}/comment`, { text: 'I am working on this' }, devToken);
          if (commentRes.ok) pass(`Dev can add comment to task`);
          else fail(`Dev add comment failed: ${commentRes.status}`);
          // Dev: delete task (should fail)
          let delRes = await api('DELETE', `/projects/${projId}/tasks/${taskId}`, null, devToken);
          if (!delRes.ok && delRes.status === 403) pass(`Dev CANNOT delete task (403 blocked correctly)`);
          else fail(`Dev delete task returned ${delRes.status} (expected 403 BLOCKED)`);
        }
      } else fail(`Admin create task failed: ${taskRes.status}`);
    } else fail(`Admin create project failed: ${projRes.status} | ${JSON.stringify(projRes.body)}`);
  }

  section('7. PM ROLE TESTS (re-login after role upgrade)');
  // Re-login PM to get fresh token with updated role
  let pmRelog = await api('POST', '/auth/login', { email: 'pm@agileai.com', password: 'PM12345!' });
  if (pmRelog.ok) {
    pmToken = pmRelog.body?.data?.token;
    pass(`PM re-logged in. New role: ${pmRelog.body?.data?.role}`);
  }
  if (pmToken) {
    // PM: access admin (should fail)
    let pmAdminRes = await api('GET', '/admin/users', null, pmToken);
    if (!pmAdminRes.ok && pmAdminRes.status === 403) pass(`PM CANNOT access /admin/users (403 blocked correctly)`);
    else fail(`PM /admin/users returned ${pmAdminRes.status} (expected 403)`);
    // PM: create project (should succeed)
    let pmProjRes = await api('POST', '/projects', { name: "PM's Project", description: 'PM created project', status: 'active', color: '#10b981' }, pmToken);
    if (pmProjRes.ok) pass(`PM CAN create project`);
    else fail(`PM create project returned ${pmProjRes.status}`);
    // PM: delete project (should fail - Admin only)
    let projects = await api('GET', '/projects', null, pmToken);
    if (projects.ok && projects.body?.data?.length > 0) {
      const firstProjId = projects.body.data[0]._id;
      let pmDelRes = await api('DELETE', `/projects/${firstProjId}`, null, pmToken);
      if (!pmDelRes.ok && pmDelRes.status === 403) pass(`PM CANNOT delete project (Admin-only, 403 blocked correctly)`);
      else fail(`PM delete project returned ${pmDelRes.status} (expected 403)`);
    }
  }

  section('8. DEVELOPER ROLE TESTS');
  if (devToken) {
    // Dev: access admin (should fail)
    let dAdminRes = await api('GET', '/admin/users', null, devToken);
    if (!dAdminRes.ok && dAdminRes.status === 403) pass(`Dev CANNOT access /admin/users (403 blocked correctly)`);
    else fail(`Dev /admin/users returned ${dAdminRes.status} (expected 403)`);
    // Dev: create project (should fail)
    let dProjRes = await api('POST', '/projects', { name: 'Unauthorized Project', description: 't' }, devToken);
    if (!dProjRes.ok && dProjRes.status === 403) pass(`Dev CANNOT create project (403 blocked correctly)`);
    else fail(`Dev create project returned ${dProjRes.status} (expected 403)`);
    // Dev: view projects (should succeed)
    let dGetProj = await api('GET', '/projects', null, devToken);
    if (dGetProj.ok) pass(`Dev CAN view all projects (${dGetProj.body?.data?.length} visible)`);
    else fail(`Dev GET /projects returned ${dGetProj.status}`);
  }

  section('9. ANALYTICS ROUTES');
  if (adminToken) {
    let analyticsRes = await api('GET', '/analytics/velocity/dummy123', null, adminToken);
    info(`Analytics velocity endpoint status: ${analyticsRes.status} (returns ${analyticsRes.ok ? 'data' : 'error/not found for dummy ID'})`);
  }

  section('✅ ALL TESTS COMPLETE');
}

run().catch(e => { console.error('Fatal error:', e); process.exit(1); });
