import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const initDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agileai');
    
    // Create a dummy collection explicitly to force DB creation
    const db = mongoose.connection.db;
    await db.createCollection('system_init').catch(() => {});
    await db.collection('system_init').insertOne({ initializedAt: new Date(), message: "Database created successfully" });
    
    console.log("Database 'agileai' successfully initialized on disk! You can now refresh MongoDB Compass.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

initDB();
