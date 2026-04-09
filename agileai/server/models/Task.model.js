import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sprint: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null },
    addedToSprintAt: { type: Date, default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['story', 'bug', 'task', 'epic'], default: 'task' },
    status: { type: String, enum: ['todo', 'inprogress', 'review', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    changeCounters: {
      priorityChanges: { type: Number, default: 0 },
      descriptionChanges: { type: Number, default: 0 },
    },
    assignmentMode: {
      type: String,
      enum: ['single', 'multi', 'subtask'],
      default: 'single',
    },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignees: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        contributionPercent: { type: Number, min: 0, max: 100, default: 100 },
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    subtasks: [
      {
        title: { type: String, required: true },
        description: { type: String, default: '' },
        status: {
          type: String,
          enum: ['todo', 'inprogress', 'review', 'done'],
          default: 'todo',
        },
        assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        storyPoints: { type: Number, default: 0 },
        estimatedHours: { type: Number, default: null },
        actualHours: { type: Number, default: 0 },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storyPoints: { type: Number, default: null },
    estimatedHours: { type: Number, default: null },
    actualHours: { type: Number, default: 0 },
    labels: [{ type: String }],
    dueDate: { type: Date },
    assignedAt: { type: Date, default: null },   // When task was assigned to a developer
    startedAt: { type: Date, default: null },     // When task first moved to inprogress
    completedAt: { type: Date, default: null },   // When task moved to done
    reopenedAt: { type: Date, default: null },    // When task moved back from done
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
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      createdAt: { type: Date, default: Date.now },
      editedAt: Date
    }],
    worklogs: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      hours: Number,
      date: { type: Date, default: Date.now },
      startedAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      source: { type: String, enum: ['manual-hours', 'time-range'], default: 'manual-hours' },
      activityType: {
        type: String,
        enum: ['implementation', 'testing', 'code-review', 'collaboration', 'debugging', 'planning', 'documentation'],
        default: 'implementation',
      },
      outcome: {
        type: String,
        enum: ['progress', 'blocked', 'handoff', 'completed'],
        default: 'progress',
      },
      progressDelta: { type: Number, min: -100, max: 100, default: null },
      description: String,
      createdAt: { type: Date, default: Date.now }
    }],
    activeTimers: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      startedAt: { type: Date, default: Date.now },
      activityType: {
        type: String,
        enum: ['implementation', 'testing', 'code-review', 'collaboration', 'debugging', 'planning', 'documentation'],
        default: 'implementation',
      },
      note: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
    }],
    // AI FIELD — populated by Python service
    aiEstimatedHours: { type: Number, default: null },
    aiEstimateConfidence: { type: Number, default: null },
    aiEstimatedStoryPoints: { type: Number, default: null },
    aiEstimatedStoryPointsAt: { type: Date, default: null },
    aiEffortModelVersion: { type: String, default: null },
    aiHoursPerPointBaseline: { type: Number, default: null },
    aiHoursPerPointSampleCount: { type: Number, default: null },
    aiHoursDerivedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

taskSchema.pre('save', function(next) {
  if (this.isModified('worklogs') || this.isNew) {
    const worklogHours = this.worklogs.reduce((total, log) => total + (log.hours || 0), 0);
    const subtaskHours = (this.subtasks || []).reduce((total, sub) => total + (sub.actualHours || 0), 0);
    this.actualHours = worklogHours + subtaskHours;
  }

  if (this.isModified('subtasks')) {
    const now = new Date();
    this.subtasks = (this.subtasks || []).map((sub) => ({
      ...sub,
      updatedAt: now,
      createdAt: sub.createdAt || now,
    }));
  }

  const normalizedAssignees = [];
  const seen = new Set();
  for (const entry of this.assignees || []) {
    const userId = entry?.user ? String(entry.user) : null;
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    normalizedAssignees.push({
      user: entry.user,
      contributionPercent: Number.isFinite(Number(entry.contributionPercent))
        ? Number(entry.contributionPercent)
        : 100,
      assignedAt: entry.assignedAt || this.assignedAt || new Date(),
    });
  }

  if (normalizedAssignees.length === 0 && this.assignee) {
    normalizedAssignees.push({
      user: this.assignee,
      contributionPercent: 100,
      assignedAt: this.assignedAt || new Date(),
    });
  }

  if (normalizedAssignees.length > 0) {
    this.assignees = normalizedAssignees;
    this.assignee = normalizedAssignees[0].user;
    this.assignedAt = this.assignedAt || normalizedAssignees[0].assignedAt;
  } else {
    this.assignees = [];
    this.assignee = null;
  }

  if ((this.subtasks || []).length > 0) {
    this.assignmentMode = 'subtask';
  } else if ((this.assignees || []).length > 1) {
    this.assignmentMode = 'multi';
  } else {
    this.assignmentMode = 'single';
  }

  if (this.isModified('blockedBy')) {
    this.isBlocked = this.blockedBy.length > 0;
  }
  this.lastActivityAt = new Date();
  next();
});

const Task = mongoose.model('Task', taskSchema);
export default Task;
