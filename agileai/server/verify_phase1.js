import { readFileSync } from 'fs';

const taskRoutes = readFileSync('routes/task.routes.js', 'utf8');
const aiRoutes = readFileSync('routes/ai.routes.js', 'utf8');
const analytics = readFileSync('services/analyticsService.js', 'utf8');

const checks = [
  ['task.routes.js has /worklogs alias', taskRoutes.includes("'/:id/worklogs'")],
  ['ai.routes.js has GET /burnout/:userId', aiRoutes.includes('/burnout/:userId')],
  ['analyticsService.js worklog fix comment', analytics.includes('No worklogs on task at all')],
  ['analyticsService.js 0-credit fix active', analytics.includes('userHours=0 correctly returns 0')],
];

let allPass = true;
for (const [name, result] of checks) {
  if (result) {
    console.log('PASS:', name);
  } else {
    console.log('FAIL:', name);
    allPass = false;
  }
}

console.log('');
if (allPass) {
  console.log('ALL NODE PHASE 1 CHECKS PASSED');
} else {
  console.log('SOME CHECKS FAILED');
  process.exit(1);
}
