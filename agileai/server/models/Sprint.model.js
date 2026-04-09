import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    
    title: { type: String, required: true },
    goal: { type: String, default: '' },
    // Planned schedule (do NOT overwrite on start/complete)
    startDate: Date,
    endDate: Date,

    // Actual execution timestamps
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Used to detect extension while sprint is active
    originalEndDateAtStart: { type: Date, default: null },
    wasExtended: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['planning', 'active', 'completed', 'cancelled'], 
      default: 'planning' 
    },

    // Locked at "Start Sprint" ? never changes retroactively
    committedPoints: { type: Number, default: 0 },   // sum of storyPoints at start
    completedPoints: { type: Number, default: 0 },   // updates live

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // For ML cold-start protection
    historicalVelocityUsed: { type: Number, default: null }, // fallback if team has <5 sprints

    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    
    // AI FIELDS — populated by Python service in Phase 2
    aiRiskScore: { type: Number, default: null }, // 0-100
    aiRiskLevel: { type: String, enum: ['low', 'medium', 'high'], default: null },
    aiRiskFactors: [
      {
        factor: { type: String },
        impact: { type: Number },
        direction: { type: String, enum: ['positive', 'negative'] },
      },
    ],
    aiLastAnalyzed: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

const Sprint = mongoose.model('Sprint', sprintSchema);
export default Sprint;
