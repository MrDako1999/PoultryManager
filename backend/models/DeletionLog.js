import mongoose from 'mongoose';

const deletionLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  entityType: {
    type: String,
    required: true,
    index: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: false });

deletionLogSchema.index({ user_id: 1, deletedAt: 1 });

export default mongoose.model('DeletionLog', deletionLogSchema);
