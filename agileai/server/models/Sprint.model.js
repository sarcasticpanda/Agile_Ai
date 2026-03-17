import mongoose from 'mongoose';

const sprintSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    goal: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed'],
      default: 'planning',
    },
    velocity: {
      type: Number,
      default: 0,
    },
    totalStoryPoints: {
      type: Number,
      default: 0,
    },
    completedStoryPoints: {
      type: Number,
      default: 0,
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    // ─── AI PLACEHOLDER FIELDS — populated in Phase 2 ───
    aiPrediction: {
      riskScore: { type: Number, default: null },
      riskLevel: { type: String, enum: ['low', 'medium', 'high', null], default: null },
      confidence: { type: Number, default: null },
      factors: [
        {
          name: { type: String },
          impact: { type: Number },
          direction: { type: String }, // 'positive' or 'negative'
        },
      ],
      effortEstimate: { type: Number, default: null },
      generatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

const Sprint = mongoose.model('Sprint', sprintSchema);
export default Sprint;
