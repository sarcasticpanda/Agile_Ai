import mongoose from 'mongoose';
import User from './models/User.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkAdmin() {
  await mongoose.connect('mongodb://127.0.0.1:27017/agileai');
  const admin = await User.findOne({ email: 'admin@test.com' }).select('+password');
  if (!admin) {
    console.log('NO ADMIN FOUND');
    process.exit(1);
  }
  const match = await admin.matchPassword('test1234');
  console.log('ADMIN FOUND:', admin);
  console.log('PASSWORD MATCH:', match);
  process.exit(0);
}

checkAdmin();
