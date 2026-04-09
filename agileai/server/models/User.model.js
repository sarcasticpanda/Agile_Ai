import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'pm', 'developer'],
      default: 'developer',
    },
    avatar: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'active',
    },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    // ML and Capacity Fields
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    capacityHoursPerWeek: {
      type: Number,
      default: 40,
    },
    hourlyRate: {
      type: Number,
      default: null, // Admin/PM visibility only
    },

    // Phase-0 telemetry for time-pattern analytics (burnout index)
    timezone: { type: String, default: null },
    // Stored as HH:mm in the user's local time
    workDayStartLocal: { type: String, default: null },
    workDayEndLocal: { type: String, default: null },

    // AI burnout fields (persisted prediction cache)
    aiBurnoutRiskScore: { type: Number, default: null },
    aiBurnoutRiskLevel: { type: String, enum: ['low', 'medium', 'high'], default: null },
    aiBurnoutConfidence: { type: Number, default: null },
    aiBurnoutModelVersion: { type: String, default: null },
    aiBurnoutLastAnalyzed: { type: Date, default: null },
    aiBurnoutHistory: [
      {
        score: { type: Number, default: null },
        level: { type: String, enum: ['low', 'medium', 'high'], default: null },
        confidence: { type: Number, default: null },
        computedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
