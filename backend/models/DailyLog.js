import mongoose from 'mongoose';

const LOG_TYPES = ['DAILY', 'WEIGHT', 'ENVIRONMENT'];

const dailyLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch is required'],
    },
    house: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House',
      required: [true, 'House is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    cycleDay: {
      type: Number,
      default: 1,
    },
    logType: {
      type: String,
      enum: LOG_TYPES,
      required: [true, 'Log type is required'],
    },

    deaths: { type: Number, default: null },
    feedKg: { type: Number, default: null },
    waterLiters: { type: Number, default: null },

    averageWeight: { type: Number, default: null },

    temperature: { type: Number, default: null },
    humidity: { type: Number, default: null },
    waterTDS: { type: Number, default: null },
    waterPH: { type: Number, default: null },

    notes: { type: String, default: null, trim: true },
    photos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media',
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

dailyLogSchema.index(
  { user_id: 1, batch: 1, house: 1, date: 1, logType: 1 },
  { unique: true }
);
dailyLogSchema.index({ batch: 1, house: 1 });

dailyLogSchema.statics.LOG_TYPES = LOG_TYPES;

export default mongoose.model('DailyLog', dailyLogSchema);
