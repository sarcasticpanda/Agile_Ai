import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
  name: String, email: String, password: String, role: String, status: String
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

mongoose.connect('mongodb://localhost:27017/agileai').then(async () => {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('auditpm123', salt);
    
    // Create or update admin
    await User.findOneAndUpdate(
        { email: 'freshadmin@test.com' },
        { name: 'Admin User', email: 'freshadmin@test.com', password, role: 'admin', status: 'active' },
        { upsert: true }
    );
    // Create or update pm
    await User.findOneAndUpdate(
        { email: 'auditpm@test.com' },
        { name: 'PM User', email: 'auditpm@test.com', password, role: 'pm', status: 'active' },
        { upsert: true }
    );
    // Create or update dev
    await User.findOneAndUpdate(
        { email: 'auditdev@test.com' },
        { name: 'Dev User', email: 'auditdev@test.com', password, role: 'developer', status: 'active' },
        { upsert: true }
    );
    console.log('Users created/updated successfully!');
    process.exit(0);
});
