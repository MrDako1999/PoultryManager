import mongoose from 'mongoose';

const EXPENSE_CATEGORIES = [
  'MAINTENANCE',
  'LABOUR',
  'UTILITIES',
  'FUEL',
  'CONSUMABLES',
  'FOOD',
  'RENT',
  'ANIMAL_PROCESSING',
  'ANIMAL_WELFARE',
  'FEED',
  'SOURCE',
  'ASSETS',
  'OTHERS',
];

const INVOICE_TYPES = ['TAX_INVOICE', 'CASH_MEMO', 'NO_INVOICE'];

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

const expenseSchema = new mongoose.Schema(
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
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
    },
    feedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedOrder',
      default: null,
    },
    saleOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleOrder',
      default: null,
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
    },
    invoiceType: {
      type: String,
      enum: INVOICE_TYPES,
      default: 'NO_INVOICE',
    },
    invoiceId: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: 'OTHERS',
    },
    tradingCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    receipts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    transferProofs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    otherDocs: [otherDocSchema],
  },
  { timestamps: true }
);

expenseSchema.index({ user_id: 1, batch: 1 });

expenseSchema.statics.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
expenseSchema.statics.INVOICE_TYPES = INVOICE_TYPES;

export default mongoose.model('Expense', expenseSchema);
