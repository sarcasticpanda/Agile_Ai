import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

mongoose.connect('mongodb://localhost:27017/agileai').then(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await mongoose.connection.db.collection('users').updateOne(
        { email: 'freshadmin@test.com' },
        { $set: { password: hashedPassword } }
    );
    console.log('Password reset successfully for freshadmin@test.com');
    process.exit(0);
});
