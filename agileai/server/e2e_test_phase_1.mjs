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
    console.log('--- Phase 1: Test Data Preparation ---');
    // Register David and Eve
    console.log('Registering David...');
    try {
        await request('/auth/register', 'POST', { name: 'David Dev', email: 'david@agileai.com', password: 'Dev1234!' });
        console.log('David registered (Pending).');
    } catch (e) { console.log('David already exists or error: ' + e.message); }

    console.log('Registering Eve...');
    try {
        await request('/auth/register', 'POST', { name: 'Eve Dev', email: 'eve@agileai.com', password: 'Dev1234!' });
        console.log('Eve registered (Pending).');
    } catch (e) { console.log('Eve already exists or error: ' + e.message); }

    // Admin Login
    console.log('\nLogging in as Admin...');
    const adminRes = await request('/auth/login', 'POST', { email: 'admin@agileai.com', password: 'Admin1234!' });
    const adminToken = adminRes.data.token;
    
    console.log('--- Phase 2: Admin Flow (Assignment) ---');
    const usersRes = await request('/admin/users', 'GET', null, adminToken);
    const users = usersRes.data;
    
    const pm = users.find(u => u.role === 'pm');
    if (!pm) throw new Error("No PM found");
    
    // Find all 5 devs
    const devs = users.filter(u => ['alice@agileai.com', 'bob@agileai.com', 'charlie@agileai.com', 'david@agileai.com', 'eve@agileai.com'].includes(u.email));
    
    for (const dev of devs) {
       console.log(`Approving and assigning ${dev.name} to PM ${pm.name}...`);
       await request(`/admin/users/${dev._id}`, 'PATCH', { status: 'active', managedBy: pm._id }, adminToken);
    }
    
    console.log('\nChecking Audit Logs for assignments...');
    const logsRes = await request('/admin/logs', 'GET', null, adminToken);
    const assignmentLogs = logsRes.data.filter(l => l.action === 'USER_ASSIGNED');
    console.log(`Found ${assignmentLogs.length} recent USER_ASSIGNED logs.`);
    
    console.log('\nPhase 1 & 2 completed successfully.');
  } catch (error) {
    console.error('Test script failed:', error);
  }
}

run();
