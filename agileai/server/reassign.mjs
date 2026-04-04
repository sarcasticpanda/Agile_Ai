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
    console.log('Logging in as Admin...');
    const adminRes = await request('/auth/login', 'POST', { email: 'admin@agileai.com', password: 'Admin1234!' });
    const adminToken = adminRes.data.token;
    
    const usersRes = await request('/admin/users', 'GET', null, adminToken);
    const users = usersRes.data;
    
    // Specifically target pm@agileai.com
    const pm = users.find(u => u.email === 'pm@agileai.com');
    if (!pm) throw new Error("No pm@agileai.com found");
    
    // Find all 5 devs
    const devs = users.filter(u => ['alice@agileai.com', 'bob@agileai.com', 'charlie@agileai.com', 'david@agileai.com', 'eve@agileai.com'].includes(u.email));
    
    for (const dev of devs) {
       console.log(`Assigning ${dev.name} to PM ${pm.name} (${pm.email})...`);
       await request(`/admin/users/${dev._id}`, 'PATCH', { status: 'active', managedBy: pm._id }, adminToken);
    }
  } catch (err) {
      console.log('Error', err);
  }
}
run();
