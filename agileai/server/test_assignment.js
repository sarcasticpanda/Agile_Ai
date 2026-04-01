import axios from 'axios';

async function test() {
  try {
    const api = axios.create({ baseURL: 'http://localhost:5001/api' });
    
    // Login as admin
    const adminRes = await api.post('/auth/login', { email: 'admin@system.com', password: 'password123' });
    const adminToken = adminRes.data.data.token;
    console.log('Admin logged in');

    // Create a dev
    const devParams = { name: 'Test Dev', email: 'devtest@test.com', password: 'password123' };
    await api.post('/auth/register', devParams).catch(()=>console.log('Dev already exists'));
    
    const adminApi = axios.create({ baseURL: 'http://localhost:5001/api', headers: { Authorization: `Bearer ${adminToken}` } });
    
    // Admin activates dev and sets role
    const usersRes = await adminApi.get('/admin/users');
    const dev = usersRes.data.data.find(u => u.email === 'devtest@test.com');
    await adminApi.patch(`/admin/users/${dev._id}`, { status: 'active', role: 'developer' });
    console.log('Dev activated');

    // Admin creates project
    const projRes = await adminApi.post('/projects', { title: 'Test Project', description: 'Test', color: '#000000', key: 'TEST' });
    const projectId = projRes.data.data._id;
    console.log('Project created:', projectId);

    // Admin adds dev to project
    await adminApi.post(`/projects/${projectId}/members`, { email: 'devtest@test.com', role: 'developer' });
    console.log('Dev added to project');

    // Dev logs in
    const devRes = await api.post('/auth/login', { email: 'devtest@test.com', password: 'password123' });
    const devToken = devRes.data.data.token;
    const devUserId = devRes.data.data.user._id;
    
    const devApi = axios.create({ baseURL: 'http://localhost:5001/api', headers: { Authorization: `Bearer ${devToken}` } });
    const devProjectsRes = await devApi.get('/projects');
    console.log('Dev projects fetched:', devProjectsRes.data.data.length);
    if (devProjectsRes.data.data.length > 0) {
      console.log('Dev sees project:', devProjectsRes.data.data[0].title);
    } else {
      console.log('Dev SEES NO PROJECTS! BUG FOUND.');
    }

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
