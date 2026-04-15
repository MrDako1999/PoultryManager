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

const feedOrderSchema = new mongoose.Schema(
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
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch is required'],
    },
    feedCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Feed company is required'],
    },
    taxInvoiceId: {
      type: String,
      trim: true,
      default: '',
    },
    orderDate: {
      type: Date,
      default: null,
    },
    deliveryDate: {
      type: Date,
      default: null,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    taxInvoiceDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    transferProofs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    deliveryNoteDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    otherDocs: [otherDocSchema],
  },
  { timestamps: true }
);

feedOrderSchema.index({ user_id: 1, batch: 1 });

export default mongoose.model('FeedOrder', feedOrderSchema);
