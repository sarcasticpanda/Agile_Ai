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
    console.log('--- Phase 3: PM Workflow ---');
    // Login as PM
    console.log('Logging in as PM...');
    const pmRes = await request('/auth/login', 'POST', { email: 'pm@agileai.com', password: 'Pm1234!' });
    const pmToken = pmRes.data.token;
    
    // Check Team
    console.log('Fetching PM Roster...');
    const rosterRes = await request('/pm/my-developers', 'GET', null, pmToken);
    const myRoster = rosterRes.data;
    console.log(`PM has ${myRoster.length} developers in roster.`);
    if (myRoster.length < 5) console.warn("Wait, fewer than 5 developers found!");

    // Check Projects or create one
    let projectsRes = await request('/projects', 'GET', null, pmToken);
    let myProjectId;
    
    if (projectsRes.data.length === 0) {
        console.log('No project found. Creating a new PM project...');
        const newProj = await request('/projects', 'POST', {
            title: 'Agile E2E Test Suite',
            description: 'Automated test project.',
            key: 'TEST'
        }, pmToken);
        myProjectId = newProj.data._id;
    } else {
        myProjectId = projectsRes.data[0]._id;
        console.log(`Using existing project: ${projectsRes.data[0].title}`);
    }

    // Create 2 Sprints
    console.log('\nCreating Sprint 1 and Sprint 2...');
    let sprint1, sprint2;
    try {
        const s1 = await request('/sprints', 'POST', {
            title: 'Sprint 1 - Foundations',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            projectId: myProjectId
        }, pmToken);
        sprint1 = s1.data;
        
        const s2 = await request('/sprints', 'POST', {
            title: 'Sprint 2 - AI Integration',
            startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            endDate: new Date(Date.now() + 14 * 86400000).toISOString(),
            projectId: myProjectId
        }, pmToken);
        sprint2 = s2.data;
        console.log('Sprints created successfully.');
    } catch(err) {
        console.error('Error creating sprints! Bug found: ', err.message);
        // We will halt and fix if there is a permission issue here.
        throw err;
    }

    // Create tasks for developers
    // Group 1: Alice, Bob, Charlie (Sprint 1)
    // Group 2: David, Eve (Sprint 2)
    const devs = myRoster;
    if (devs.length < 5) throw new Error("Missing seeded devs.");
    
    const group1 = devs.slice(0, 3);
    const group2 = devs.slice(3, 5);

    console.log('\nAssigning Tasks to Group 1 (Sprint 1)...');
    for (const dev of group1) {
        await request('/tasks', 'POST', {
            title: `Implement ${dev.name} feature core`,
            description: 'Essential task.',
            status: 'todo',
            type: 'story',
            priority: 'medium',
            storyPoints: 5,
            reporter: pmRes.data._id,
            assignee: dev._id,
            sprint: sprint1._id,
            project: myProjectId
        }, pmToken);
    }

    console.log('Assigning Tasks to Group 2 (Sprint 2)...');
    for (const dev of group2) {
        await request('/tasks', 'POST', {
            title: `Research ${dev.name} models`,
            description: 'AI task.',
            status: 'todo',
            type: 'task',
            priority: 'high',
            storyPoints: 8,
            reporter: pmRes.data._id,
            assignee: dev._id,
            sprint: sprint2._id,
            project: myProjectId
        }, pmToken);
    }
    
    console.log('Phase 3 Task assignments completed successfully (No constraint or backend crashes found)!');

  } catch (error) {
    import('fs').then(fs => fs.writeFileSync('fail.log', `Error: ${error.message}\nStack: ${error.stack}`));
    console.error('Test script failed:', error);
  }
}

run();
