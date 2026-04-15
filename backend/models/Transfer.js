import mongoose from 'mongoose';

const TRANSFER_TYPES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT'];

const transferSchema = new mongoose.Schema(
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
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business is required'],
    },
    transferDate: {
      type: Date,
      required: [true, 'Transfer date is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    transferType: {
      type: String,
      enum: TRANSFER_TYPES,
      default: 'CASH',
    },
    transferProof: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    receiptDoc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

transferSchema.index({ user_id: 1, business: 1 });

transferSchema.statics.TRANSFER_TYPES = TRANSFER_TYPES;

export default mongoose.model('Transfer', transferSchema);
