// TODO: FeedCatalogueBase - see FEED_CATALOGUE_BASE.md
import mongoose from 'mongoose';

const FEED_TYPES = ['STARTER', 'GROWER', 'FINISHER', 'OTHER'];
const QUANTITY_UNITS = ['KG', 'LB', 'G', 'TON'];

const feedItemSchema = new mongoose.Schema(
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
    feedCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Feed company is required'],
    },
    feedDescription: {
      type: String,
      required: [true, 'Feed description is required'],
      trim: true,
    },
    feedType: {
      type: String,
      enum: FEED_TYPES,
      required: [true, 'Feed type is required'],
    },
    pricePerQty: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

feedItemSchema.index({ user_id: 1, feedCompany: 1 });

feedItemSchema.statics.FEED_TYPES = FEED_TYPES;
feedItemSchema.statics.QUANTITY_UNITS = QUANTITY_UNITS;

export default mongoose.model('FeedItem', feedItemSchema);
