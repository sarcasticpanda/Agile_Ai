import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agileai');
    console.log("Connected to MongoDB");
    
    // Define a simple User schema for querying
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      role: String,
      isActive: Boolean
    });
    const User = mongoose.model('User', userSchema);

    const onlyCore = process.argv.includes('--core');
    const coreEmails = [
      'admin@agileai.com',
      'pm@agileai.com',
      'alice@agileai.com',
      'bob@agileai.com',
      'charlie@agileai.com',
      'david@agileai.com',
      'eve@agileai.com',
    ];
    const query = onlyCore ? { email: { $in: coreEmails } } : {};
    
    const users = await User.find(query);
    console.log("--- Existing Users ---");
    users.forEach(u => {
      console.log(`- ${u._id} | ${u.name} (${u.email}) | Role: ${u.role} | Active: ${u.isActive}`);
    });
    console.log("-----------------------");
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUsers();
