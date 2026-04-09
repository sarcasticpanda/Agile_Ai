import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

const MONGODB_URI = process.env.MONGODB_URI;
console.log('Connecting to:', MONGODB_URI.substring(0, 40) + '...');

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB!\n');

const db = mongoose.connection.db;
const usersCol = db.collection('users');

// ─── Helper ────────────────────────────────────────────────
async function upsertUser({ name, email, password, role, status }) {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  const existing = await usersCol.findOne({ email });
  if (existing) {
    await usersCol.updateOne(
      { email },
      { $set: { role, status, password: hashed, isActive: true } }
    );
    console.log(`  ✅ Updated existing: ${email} → role=${role}, status=${status}`);
    return existing._id;
  } else {
    const result = await usersCol.insertOne({
      name,
      email,
      password: hashed,
      role,
      status,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  ✅ Created new: ${email} → role=${role}, status=${status}`);
    return result.insertedId;
  }
}

// ─── Seed Users ─────────────────────────────────────────────
console.log('=== Seeding Test Users ===\n');

console.log('1. Admin user:');
const adminId = await upsertUser({
  name: 'Super Admin',
  email: 'admin@agileai.com',
  password: 'Admin1234!',
  role: 'admin',
  status: 'active',
});

console.log('\n2. PM user (active - admin will adjust role if needed):');
const pmId = await upsertUser({
  name: 'PM Lead',
  email: 'pm@agileai.com',
  password: 'Pm1234!',
  role: 'pm',
  status: 'active',
});

console.log('\n3. Developer 1 (pending):');
const dev1Id = await upsertUser({
  name: 'Dev Alice',
  email: 'alice@agileai.com',
  password: 'Dev1234!',
  role: 'developer',
  status: 'pending',
});

console.log('\n4. Developer 2 (pending):');
const dev2Id = await upsertUser({
  name: 'Dev Bob',
  email: 'bob@agileai.com',
  password: 'Dev1234!',
  role: 'developer',
  status: 'pending',
});

console.log('\n5. Developer 3 (pending):');
const dev3Id = await upsertUser({
  name: 'Dev Charlie',
  email: 'charlie@agileai.com',
  password: 'Dev1234!',
  role: 'developer',
  status: 'pending',
});

console.log('\n=== ✅ All Users Seeded ===');
console.log('\n📋 Login Credentials:');
console.log('────────────────────────────────────────');
console.log('ADMIN:    admin@agileai.com   / Admin1234!');
console.log('PM:       pm@agileai.com      / Pm1234!   (pending approval)');
console.log('Dev 1:    alice@agileai.com   / Dev1234!  (pending approval)');
console.log('Dev 2:    bob@agileai.com     / Dev1234!  (pending approval)');
console.log('Dev 3:    charlie@agileai.com / Dev1234!  (pending approval)');
console.log('────────────────────────────────────────');
console.log('\nAdmin is ACTIVE and can login immediately.');
console.log('Others need admin approval via the Admin panel.');

await mongoose.disconnect();
console.log('\nDone.');
