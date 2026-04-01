import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['story', 'bug', 'task', 'epic'], default: 'task' },
    status: { type: String, enum: ['todo', 'inprogress', 'review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storyPoints: { type: Number, default: null },
    estimatedHours: { type: Number, default: null },
    actualHours: { type: Number, default: 0 },
    labels: [{ type: String }],
    dueDate: { type: Date },
    order: { type: Number, default: 0 },
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    isBlocked: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
    statusHistory: [{
      from: String,
      to: String,
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now }
    }],
    comments: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: { type: Date, default: Date.now },
      editedAt: Date
    }],
    worklogs: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      hours: Number,
      date: { type: Date, default: Date.now },
      description: String,
      createdAt: { type: Date, default: Date.now }
    }],
    // AI FIELD — populated by Python service
    aiEstimatedHours: { type: Number, default: null },
    aiEstimateConfidence: { type: Number, default: null }
  },
  { timestamps: true }
);

taskSchema.pre('save', function(next) {
  if (this.isModified('worklogs') || this.isNew) {
    this.actualHours = this.worklogs.reduce((total, log) => total + (log.hours || 0), 0);
  }
  if (this.isModified('blockedBy')) {
    this.isBlocked = this.blockedBy.length > 0;
  }
  this.lastActivityAt = new Date();
export default Task;
