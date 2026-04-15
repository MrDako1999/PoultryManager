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

const sourceSchema = new mongoose.Schema(
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
    sourceFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },
    invoiceType: {
      type: String,
      enum: ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'],
      default: 'TAX_INVOICE',
    },
    taxInvoiceId: {
      type: String,
      trim: true,
      default: '',
    },
    chicksRate: {
      type: Number,
      default: 0,
    },
    quantityPurchased: {
      type: Number,
      default: 0,
    },
    focPercentage: {
      type: Number,
      default: 0,
    },
    totalChicks: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    deliveryDate: {
      type: Date,
      default: null,
    },
    taxInvoiceDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    transferProofs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    deliveryNoteDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    otherDocs: [otherDocSchema],
  },
  { timestamps: true }
);

sourceSchema.index({ user_id: 1, batch: 1 });

export default mongoose.model('Source', sourceSchema);
