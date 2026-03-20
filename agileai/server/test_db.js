import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agileai');
    console.log("Connected DB Name:", conn.connection.name);
    
    // Check if there are any users
    const collections = await conn.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    const dbAdmin = conn.connection.db.admin();
    const dbs = await dbAdmin.listDatabases();
    console.log("All Databases:", dbs.databases.map(db => db.name));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
