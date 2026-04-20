import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('users');

const users = [
  { email: 'pm@agileai.com',      password: 'Pm1234!' },
  { email: 'alice@agileai.com',   password: 'Dev1234!' },
  { email: 'bob@agileai.com',     password: 'Dev1234!' },
  { email: 'charlie@agileai.com', password: 'Dev1234!' },
  { email: 'david@agileai.com',   password: 'Dev1234!' },
];

for (const u of users) {
  const hashed = await bcrypt.hash(u.password, 10);
  const res = await col.updateOne({ email: u.email }, { $set: { password: hashed, status: 'active' } });
  console.log(`${u.email}: matched=${res.matchedCount} modified=${res.modifiedCount}`);
}

await mongoose.disconnect();
console.log('Done.');
