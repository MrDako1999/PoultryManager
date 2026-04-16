import mongoose from 'mongoose';

const otherDocSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    media_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      required: true,
    },
  },
  { _id: false }
);

const workerSchema = new mongoose.Schema(
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
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null,
    },
    photo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    role: {
      type: String,
      enum: ['manager', 'supervisor', 'labourer', 'driver', 'veterinarian', 'other'],
      default: 'labourer',
    },
    linkedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    houseAssignments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'House' }],
      default: [],
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    emiratesIdNumber: {
      type: String,
      trim: true,
      default: '',
    },
    emiratesIdExpiry: {
      type: String,
      default: '',
    },
    passportNumber: {
      type: String,
      trim: true,
      default: '',
    },
    passportCountry: {
      type: String,
      trim: true,
      default: '',
    },
    passportExpiry: {
      type: String,
      default: '',
    },
    compensation: {
      type: Number,
      default: null,
    },
    eidFront: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    eidBack: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    visa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    passportPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    otherDocs: [otherDocSchema],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

workerSchema.index({ user_id: 1, lastName: 1, firstName: 1 });

export default mongoose.model('Worker', workerSchema);
