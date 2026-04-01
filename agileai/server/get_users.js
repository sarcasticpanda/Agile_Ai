const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/agileai').then(async () => {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(users.map(u => ({ email: u.email, role: u.role, status: u.status })));
    process.exit(0);
});
