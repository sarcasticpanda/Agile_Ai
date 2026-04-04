import 'dotenv/config';
import mongoose from 'mongoose';
import Project from './models/Project.model.js';
import Sprint from './models/Sprint.model.js';
import Task from './models/Task.model.js';

async function clean() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    await Project.deleteMany({});
    await Sprint.deleteMany({});
    await Task.deleteMany({});
    
    console.log('Deleted all Projects, Sprints, and Tasks.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

clean();
