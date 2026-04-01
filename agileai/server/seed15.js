import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
  name: String, email: String, password: String, role: String, status: String, avatar: String
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

mongoose.connect('mongodb://127.0.0.1:27017/agileai').then(async () => {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('test1234', salt);
    
    // Create Admin
    await User.findOneAndUpdate(
        { email: 'admin@test.com' },
        { name: 'Admin User', email: 'admin@test.com', password, role: 'admin', status: 'active' },
        { upsert: true }
    );

    // Create 2 PMs
    for (let i = 1; i <= 2; i++) {
        await User.findOneAndUpdate(
            { email: `pm${i}@test.com` },
            { name: `PM User ${i}`, email: `pm${i}@test.com`, password, role: 'pm', status: 'active' },
            { upsert: true }
        );
    }

    // Create 12 Devs
    for (let i = 1; i <= 12; i++) {
        await User.findOneAndUpdate(
            { email: `dev${i}@test.com` },
            { name: `Dev User ${i}`, email: `dev${i}@test.com`, password, role: 'developer', status: 'active' },
            { upsert: true }
        );
    }

    console.log('15 Users seeded successfully!');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
