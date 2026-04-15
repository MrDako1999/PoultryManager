import mongoose from 'mongoose';

const SALE_METHODS = ['SLAUGHTERED', 'LIVE_BY_PIECE', 'LIVE_BY_WEIGHT'];
const INVOICE_TYPES = ['VAT_INVOICE', 'CASH_MEMO'];
const PART_TYPES = [
  'LIVER', 'GIZZARD', 'HEART', 'BREAST', 'LEG', 'WING',
  'BONE', 'THIGH', 'DRUMSTICK', 'BONELESS_THIGH', 'NECK', 'MINCE',
];

const otherDocSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    media_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
  },
  { _id: false }
);

const wholeChickenItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, default: '' },
    weightKg: { type: Number, default: 0 },
    ratePerKg: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const portionSchema = new mongoose.Schema(
  {
    partType: { type: String, enum: PART_TYPES, required: true },
    quantity: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const slaughterSchema = new mongoose.Schema(
  {
    method: { type: String, enum: SALE_METHODS, default: 'SLAUGHTERED' },
    date: { type: Date, default: null },
    slaughterhouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    invoiceRef: { type: String, trim: true, default: '' },
    reportDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    processingCost: { type: Number, default: 0 },
    relatedExpense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
  },
  { _id: false }
);

const countsSchema = new mongoose.Schema(
  {
    chickensSent: { type: Number, default: 0 },
    condemnation: { type: Number, default: 0 },
    deathOnArrival: { type: Number, default: 0 },
    rejections: { type: Number, default: 0 },
    shortage: { type: Number, default: 0 },
    bGrade: { type: Number, default: 0 },
  },
  { _id: false }
);

const liveWeightItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, default: '' },
    weightKg: { type: Number, default: 0 },
    ratePerKg: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const liveSchema = new mongoose.Schema(
  {
    birdCount: { type: Number, default: 0 },
    ratePerBird: { type: Number, default: 0 },
    weightItems: [liveWeightItemSchema],
  },
  { _id: false }
);

const transportSchema = new mongoose.Schema(
  {
    truckCount: { type: Number, default: 0 },
    ratePerTruck: { type: Number, default: 0 },
  },
  { _id: false }
);

const discountItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const totalsSchema = new mongoose.Schema(
  {
    wholeChicken: { type: Number, default: 0 },
    portions: { type: Number, default: 0 },
    liveSales: { type: Number, default: 0 },
    grossSales: { type: Number, default: 0 },
    transportDeduction: { type: Number, default: 0 },
    discounts: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleOrderSchema = new mongoose.Schema(
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
    saleNumber: { type: String, trim: true, default: '' },
    saleMethod: {
      type: String,
      enum: SALE_METHODS,
      required: [true, 'Sale method is required'],
    },
    invoiceType: {
      type: String,
      enum: INVOICE_TYPES,
      required: [true, 'Invoice type is required'],
    },
    saleDate: {
      type: Date,
      required: [true, 'Sale date is required'],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },

    slaughter: { type: slaughterSchema, default: null },
    live: { type: liveSchema, default: null },
    counts: { type: countsSchema, default: () => ({}) },
    transport: { type: transportSchema, default: () => ({}) },
    discounts: [discountItemSchema],
    totals: { type: totalsSchema, default: () => ({}) },

    wholeChickenItems: [wholeChickenItemSchema],
    portions: [portionSchema],

    notes: { type: String, trim: true, default: '' },
    invoiceDocs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    transferProofs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],
    otherDocs: [otherDocSchema],
  },
  { timestamps: true }
);

saleOrderSchema.index({ user_id: 1, batch: 1 });

saleOrderSchema.statics.SALE_METHODS = SALE_METHODS;
saleOrderSchema.statics.INVOICE_TYPES = INVOICE_TYPES;
saleOrderSchema.statics.PART_TYPES = PART_TYPES;

export default mongoose.model('SaleOrder', saleOrderSchema);
