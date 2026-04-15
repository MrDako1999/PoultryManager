import mongoose from 'mongoose';

const BATCH_STATUSES = ['NEW', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'OTHER'];

const batchSchema = new mongoose.Schema(
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
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: [true, 'Farm is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    sequenceNumber: {
      type: Number,
      required: true,
    },
    batchName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: BATCH_STATUSES,
      default: 'NEW',
    },
    houses: [
      {
        house: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'House',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

batchSchema.index({ user_id: 1, farm: 1 });

batchSchema.statics.BATCH_STATUSES = BATCH_STATUSES;

export default mongoose.model('Batch', batchSchema);
