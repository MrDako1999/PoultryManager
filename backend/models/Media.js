import mongoose from 'mongoose';

const MEDIA_TYPES = ['image', 'document', 'report', 'invoice', 'receipt'];

const mediaSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
    },
    key: {
      type: String,
      required: [true, 'S3 key is required'],
      unique: true,
    },
    filename: {
      type: String,
      required: [true, 'Filename is required'],
    },
    original_filename: {
      type: String,
      default: '',
    },
    file_size: {
      type: Number,
    },
    mime_type: {
      type: String,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    media_type: {
      type: String,
      enum: MEDIA_TYPES,
    },
    category: {
      type: String,
    },
    entity_type: {
      type: String,
    },
    entity_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    storage_provider: {
      type: String,
      default: 'hetzner',
    },
  },
  { timestamps: true }
);

mediaSchema.index({ user_id: 1, entity_type: 1, entity_id: 1 });

mediaSchema.statics.MEDIA_TYPES = MEDIA_TYPES;

export default mongoose.model('Media', mediaSchema);
