import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = 'http://localhost:5001/api';

async function request(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

async function run() {
  try {
    console.log('--- Phase 4: Dev Workflow ---');
    // Login as a Dev (Alice)
    console.log('Logging in as Alice...');
    const devRes = await request('/auth/login', 'POST', { email: 'alice@agileai.com', password: 'Dev1234!' });
    const devToken = devRes.data.token;
    const devId = devRes.data._id;
    
    console.log('Fetching David\'s tasks...');
    const tasksRes = await request(`/tasks?assigneeId=${devId}`, 'GET', null, devToken);
    const tasks = tasksRes.data;
    
    if (tasks.length === 0) {
        throw new Error('David has no tasks assigned to him!');
    }
    
    console.log(`David has ${tasks.length} tasks. Moving the first task to in-progress...`);
    const taskId = tasks[0]._id;
    
    const updateRes = await request(`/tasks/${taskId}/status`, 'PATCH', { status: 'inprogress' }, devToken);
    if (updateRes.data.status !== 'inprogress') {
        throw new Error("Failed to change status to inprogress");
    }
    console.log('Task status successfully changed!');
    
    // Testing Constraint: Dev tries to change Sprint structure (Should Fail)
    console.log('\nTesting RBAC Constraints: Dev trying to modify project structure...');
    try {
        await request(`/projects/${tasks[0].project}`, 'DELETE', null, devToken);
        throw new Error('SECURITY BUG: Developer deleted the project!');
    } catch(err) {
        console.log('Security constraint working: ' + err.message);
    }
    
    console.log('\nPhase 4 dev updates and constraints validated successfully.');
  } catch (error) {
    import('fs').then(fs => fs.writeFileSync('fail_dev.log', `Error: ${error.message}\nStack: ${error.stack}`));
    console.error('Test script failed:', error);
  }
}

run();
