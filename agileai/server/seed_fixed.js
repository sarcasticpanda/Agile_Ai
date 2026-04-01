import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.model.js';

dotenv.config();

mongoose.connect('mongodb://127.0.0.1:27017/agileai').then(async () => {
    // Clear existing users
    await User.deleteMany({});
    
    // Create Admin
    const admin = new User({
        name: 'Admin User', 
        email: 'admin@test.com', 
        password: 'test1234', 
        role: 'admin', 
        status: 'active'
    });
    await admin.save();

    // Create 2 PMs
    for (let i = 1; i <= 2; i++) {
        const pm = new User({
            name: `PM User ${i}`, 
            email: `pm${i}@test.com`, 
            password: 'test1234', 
            role: 'pm', 
            status: 'active'
        });
        await pm.save();
    }

    // Create 12 Devs
    for (let i = 1; i <= 12; i++) {
        const dev = new User({
            name: `Dev User ${i}`, 
            email: `dev${i}@test.com`, 
            password: 'test1234', 
            role: 'developer', 
            status: 'active'
        });
        await dev.save();
    }

    console.log('15 Users seeded securely!');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
