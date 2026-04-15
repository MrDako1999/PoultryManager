import mongoose from 'mongoose';

const FEED_TYPES = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];
const QUANTITY_UNITS = ['KG', 'LB', 'G', 'TON'];

const feedOrderItemSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    feedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedOrder',
      required: [true, 'Feed order is required'],
      index: true,
    },
    feedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedItem',
      required: [true, 'Feed item is required'],
    },
    feedType: {
      type: String,
      enum: FEED_TYPES,
      required: [true, 'Feed type is required'],
    },
    feedDescription: {
      type: String,
      trim: true,
      default: '',
    },
    pricePerBag: {
      type: Number,
      default: 0,
    },
    quantitySize: {
      type: Number,
      default: 50,
    },
    quantityUnit: {
      type: String,
      enum: QUANTITY_UNITS,
      default: 'KG',
    },
    bags: {
      type: Number,
      required: [true, 'Bag quantity is required'],
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
    lineTotal: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

feedOrderItemSchema.index({ feedItem: 1 });

export default mongoose.model('FeedOrderItem', feedOrderItemSchema);
