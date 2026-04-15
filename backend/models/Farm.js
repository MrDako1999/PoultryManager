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

const farmSchema = new mongoose.Schema(
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
      default: null,
    },
    farmName: {
      type: String,
      required: [true, 'Farm name is required'],
      trim: true,
    },
    farmType: {
      type: String,
      enum: ['broiler', 'hatchery', 'free_range', 'layer_eggs', 'slaughterhouse'],
      default: 'broiler',
    },
    nickname: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [8, 'Nickname must be at most 8 characters'],
      default: '',
    },
    logo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null,
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      placeName: { type: String, trim: true, default: '' },
    },
    otherDocs: [otherDocSchema],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

farmSchema.index({ user_id: 1, farmName: 1 });

export default mongoose.model('Farm', farmSchema);
