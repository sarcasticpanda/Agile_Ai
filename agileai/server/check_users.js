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
    
    const users = await User.find({});
    console.log("--- Existing Users ---");
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}) | Role: ${u.role} | Active: ${u.isActive}`);
    });
    console.log("-----------------------");
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUsers();
