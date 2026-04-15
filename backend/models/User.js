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
    saleDefaults: {
      portionRates: {
        type: Map,
        of: Number,
        default: () => new Map([
          ['LIVER', 0], ['GIZZARD', 0], ['HEART', 0], ['BREAST', 0],
          ['LEG', 0], ['WING', 0], ['BONE', 0], ['THIGH', 0],
          ['DRUMSTICK', 0], ['BONELESS_THIGH', 0], ['NECK', 0], ['MINCE', 0],
        ]),
      },
      transportRatePerTruck: {
        type: Number,
        default: 0,
      },
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
