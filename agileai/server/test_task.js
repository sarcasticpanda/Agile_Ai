const axios = require('axios');
const test = async () => {
    try {
        console.log('Logging in as PM...');
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'pm@agileai.com',
            password: 'Pm1234!'
        });
        const token = loginRes.data.token;
        const pmId = loginRes.data.user.id;
        
        console.log('Fetching projects...');
        const projectsRes = await axios.get('http://localhost:3000/api/projects', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const project = projectsRes.data[0];
        if (!project) return console.log('No project found');
        
        console.log('Testing Backlog Task Creation...');
        const taskRes = await axios.post('http://localhost:3000/api/tasks', {
            title: 'Test Task from Script',
            description: 'Testing if backlog task creation works',
            type: 'story',
            priority: 'medium',
            status: 'todo',
            project: project._id,
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Task Created:', taskRes.data);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
};
test();
