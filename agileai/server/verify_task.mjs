import mongoose from 'mongoose';
import Task from './models/Task.model.js';

try {
  const testTask = new Task({
    projectId: new mongoose.Types.ObjectId(),
    title: "Test Integration Task",
    issueType: "Story",
    priority: "High",
    storyPoints: 5,
    statusHistory: [{ status: "To Do", changedBy: new mongoose.Types.ObjectId() }],
    loggedHours: [{ userId: new mongoose.Types.ObjectId(), hours: 3.5, comment: "Backend setup" }]
  });

  const error = testTask.validateSync();
  if (error) {
    console.error("? Validation Failed:", error);
  } else {
    console.log("? Task Model Verified Successfully!");
    console.log("-----------------------------------");
    console.log(`Title: ${testTask.title}`);
    console.log(`Story Points: ${testTask.storyPoints}`);
    console.log(`Status History entries: ${testTask.statusHistory.length}`);
    console.log(`Logged Hours recorded: ${testTask.loggedHours[0].hours} hours`);
    console.log(`Default Days Idle: ${testTask.daysIdle}`);
  }
} catch (err) {
  console.error("Error loading model:", err.message);
}
