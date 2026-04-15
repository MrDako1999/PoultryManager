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

const businessSchema = new mongoose.Schema(
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
    isAccountBusiness: {
      type: Boolean,
      default: false,
    },
    businessType: {
      type: String,
      enum: ['TRADER', 'SUPPLIER'],
      default: 'TRADER',
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    logo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    tradeLicenseNumber: {
      type: String,
      trim: true,
      default: '',
    },
    trnNumber: {
      type: String,
      trim: true,
      default: '',
    },
    trnCertificate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    tradeLicense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      formattedAddress: { type: String, trim: true, default: '' },
      placeId: { type: String, trim: true, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    otherDocs: [otherDocSchema],
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

businessSchema.index({ user_id: 1, companyName: 1 });

export default mongoose.model('Business', businessSchema);
