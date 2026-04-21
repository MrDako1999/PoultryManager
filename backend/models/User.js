import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ACCOUNT_ROLES = ['owner', 'manager', 'veterinarian', 'accountant', 'ground_staff', 'viewer'];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    modules: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    accountRole: {
      type: String,
      enum: ACCOUNT_ROLES,
      default: 'owner',
    },
    accountBusiness: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    country: {
      type: String,
      enum: ['AE', 'SA', 'BH', 'OM', 'KW', 'QA', null],
      default: null,
    },
    vatRate: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      default: null,
    },
    invoiceLanguage: {
      type: String,
      enum: ['en'],
      default: 'en',
    },
    moduleSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    // Soft-delete marker. Sub-users author records (DailyLog.createdBy,
    // Media.createdBy, etc.) so we never hard-delete them. See
    // DATA_OWNERSHIP.md Invariant 6 and WORKERS.md.
    //
    // - isActive:false  -> deactivated (login blocked, still listed,
    //   reversible)
    // - deletedAt:Date  -> soft-deleted (login blocked, hidden from
    //   default lists, NOT re-activatable from normal UI, all
    //   createdBy references still resolve)
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Subscription state — only meaningful for owners (createdBy === null).
    // Sub-users inherit access via their owner's subscription. See
    // SUBSCRIPTION.md for the full design and Stripe integration plan.
    //
    // Today every owner defaults to status:'active' so the gate is a
    // no-op until Stripe is wired in.
    subscription: {
      status: {
        type: String,
        enum: [
          'active',
          'trialing',
          'past_due',
          'unpaid',
          'canceled',
          'incomplete',
          'incomplete_expired',
          'paused',
        ],
        default: 'active',
      },
      plan: { type: String, default: null },
      priceIds: { type: [String], default: [] },
      currentPeriodEnd: { type: Date, default: null },
      cancelAt: { type: Date, default: null },
      trialEnd: { type: Date, default: null },
      stripeCustomerId: { type: String, default: null, index: true, sparse: true },
      stripeSubscriptionId: { type: String, default: null, index: true, sparse: true },
      lastWebhookAt: { type: Date, default: null },
      lastFailureReason: { type: String, default: null },
    },
  },
  { timestamps: true }
);

userSchema.statics.ACCOUNT_ROLES = ACCOUNT_ROLES;

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);
