// Quick script to create clean test users with known passwords
const BASE = 'http://localhost:5001/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function patch(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('=== Creating AgileAI Test Users ===\n');

  // 1. Register admin
  console.log('1. Registering admin...');
  let r = await post('/auth/register', { name: 'Admin Boss', email: 'boss@agileai.com', password: 'Boss1234!' });
  if (!r.success) {
    console.log('  Admin register failed (may already exist), trying login...');
    r = await post('/auth/login', { email: 'boss@agileai.com', password: 'Boss1234!' });
  }
  const adminToken = r.data?.token;
  const adminId = r.data?._id;
  console.log(`  Admin ID: ${adminId}, Role: ${r.data?.role}`);

  // 2. Register PM
  console.log('2. Registering PM...');
  r = await post('/auth/register', { name: 'PM Lead', email: 'pmlead@agileai.com', password: 'PmLead1234!' });
  if (!r.success) {
    console.log('  PM register failed (may already exist), trying login...');
    r = await post('/auth/login', { email: 'pmlead@agileai.com', password: 'PmLead1234!' });
  }
  const pmId = r.data?._id;
  console.log(`  PM ID: ${pmId}, Role: ${r.data?.role}`);

  // 3. Register Developer
  console.log('3. Registering Developer...');
  r = await post('/auth/register', { name: 'Dev Coder', email: 'devcoder@agileai.com', password: 'DevCode1234!' });
  if (!r.success) {
    console.log('  Dev register failed (may already exist), trying login...');
    r = await post('/auth/login', { email: 'devcoder@agileai.com', password: 'DevCode1234!' });
  }
  const devId = r.data?._id;
  console.log(`  Dev ID: ${devId}, Role: ${r.data?.role}`);

  // 4. Promote admin role (new users default to 'developer')
  if (adminToken && adminId) {
    // First we need to promote OUR admin user. Since new users are 'developer' by default,
    // we need an existing admin to do it. Let's check if there's one we can use.
    // Actually, let's just update directly in the DB via the existing admin accounts.
    console.log('\n4. Need to set roles. Trying existing admin login...');
    
    // Try known admin accounts
    const adminCreds = [
      { email: 'realadmin@test.com', password: 'Admin123!' },
      { email: 'admin@example.com', password: 'Admin123!' },
      { email: 'freshadmin@test.com', password: 'Admin123!' },
      { email: 'admin10@example.com', password: 'Admin123!' },
    ];
    
    let existingAdminToken = null;
    for (const cred of adminCreds) {
      const lr = await post('/auth/login', cred);
      if (lr.success && lr.data?.role === 'admin') {
        existingAdminToken = lr.data.token;
        console.log(`  Found working admin: ${cred.email}`);
        break;
      }
    }

    if (existingAdminToken) {
      // Promote boss to admin
      if (adminId) {
        const ur = await patch(`/admin/users/${adminId}`, { role: 'admin' }, existingAdminToken);
        console.log(`  Boss -> admin: ${ur.success ? 'OK' : ur.message}`);
      }
      // Promote PM
      if (pmId) {
        const ur = await patch(`/admin/users/${pmId}`, { role: 'pm' }, existingAdminToken);
        console.log(`  PM Lead -> pm: ${ur.success ? 'OK' : ur.message}`);
      }
    } else {
      console.log('  No existing admin token works. Will update DB directly.');
      console.log('  IMPORTANT: You need to update roles manually in MongoDB.');
    }
  }

  console.log('\n=== Test Credentials ===');
  console.log('Admin:     boss@agileai.com     / Boss1234!');
  console.log('PM:        pmlead@agileai.com   / PmLead1234!');
  console.log('Developer: devcoder@agileai.com / DevCode1234!');
  console.log('\nNote: If roles were not promoted, run the role fix separately.');
}

main().catch(console.error);
