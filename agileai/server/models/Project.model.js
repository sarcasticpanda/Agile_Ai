import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String, // e.g. "AGL" for task prefixes
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization', // standardization for Phase 6 ML
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['pm', 'developer'],
          default: 'developer',
        },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    color: {
      type: String,
      default: '#4F46E5', // indigo-600
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  await this.model('Sprint').deleteMany({ projectId: this._id });
  await this.model('Task').deleteMany({ projectId: this._id });
  next();
});

const Project = mongoose.model('Project', projectSchema);
export default Project;
