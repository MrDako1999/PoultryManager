import User from '../models/User.js';
import Worker from '../models/Worker.js';
import Contact from '../models/Contact.js';
import Business from '../models/Business.js';
import { sendCredentials } from './emailService.js';
import { invalidateOwnerModulesCache } from '../middleware/modules.js';
import { ACCOUNT_ROLES } from '@poultrymanager/shared';

/**
 * Single source of truth for adding a new team member to an account.
 *
 * Three flows in one function, controlled by `grantAppAccess`:
 *
 *   1. HR-only worker (grantAppAccess=false)
 *      - Creates Contact + Worker
 *      - No User account, no email, no temp password
 *      - Worker.linkedUser stays null
 *
 *   2. Invited team member with app access (grantAppAccess=true)
 *      - Creates User (sub-account, mustChangePassword=true)
 *      - Creates Contact (linkedUser = the new User)
 *      - Creates Worker (linkedUser = the new User, with farm scope)
 *      - Emails temp credentials to the user's email address
 *
 *   3. Upgrade an existing HR worker to invited team member
 *      - Pass `existingWorkerId` to attach to an already-created Worker
 *      - Same as #2 but skips the Worker.create step and instead patches
 *        linkedUser + farmAssignments onto the existing record
 *
 * The acting user (`invitedBy`) becomes the createdBy on every new
 * record. ownerId is stamped onto user_id per DATA_OWNERSHIP.md.
 */

const VALID_NON_OWNER_ROLES = ACCOUNT_ROLES.filter((r) => r !== 'owner');

function generateTempPassword() {
  return Math.random().toString(36).slice(-10) + 'A1!';
}

function normalizePermissions({ allow, deny } = {}) {
  return {
    allow: Array.isArray(allow) ? allow.filter((s) => typeof s === 'string') : [],
    deny: Array.isArray(deny) ? deny.filter((s) => typeof s === 'string') : [],
  };
}

export async function inviteWorker({
  ownerId,
  invitedBy,
  // person fields
  firstName,
  lastName,
  email,
  phone,
  photo,
  // worker (HR) fields
  workerRole,                 // 'manager' | 'supervisor' | 'labourer' | 'driver' | 'veterinarian' | 'other'
  jobTitle,
  compensation,
  emiratesIdNumber,
  emiratesIdExpiry,
  passportNumber,
  passportCountry,
  passportExpiry,
  eidFront,
  eidBack,
  visa,
  passportPage,
  otherDocs,
  // app-access fields (only used when grantAppAccess=true)
  grantAppAccess = false,
  accountRole,
  permissions,
  // scope (farm-level only — see WORKERS.md)
  farmAssignments,
  // optional: upgrade an existing HR worker into an invited user
  existingWorkerId,
} = {}) {
  if (!ownerId || !invitedBy) {
    throw new Error('inviteWorker: ownerId and invitedBy are required');
  }
  if (!firstName) {
    throw new Error('inviteWorker: firstName is required');
  }

  const owner = await User.findById(ownerId).select('firstName lastName email companyName accountBusiness modules subscription');
  if (!owner) throw new Error('inviteWorker: owner not found');

  const accountBusinessId = owner.accountBusiness || null;
  const farms = Array.isArray(farmAssignments) ? farmAssignments : [];

  let user = null;
  let tempPassword = null;

  if (grantAppAccess) {
    if (!email) throw new Error('inviteWorker: email is required when grantAppAccess is true');
    if (!accountRole || !VALID_NON_OWNER_ROLES.includes(accountRole)) {
      throw new Error(`inviteWorker: accountRole must be one of ${VALID_NON_OWNER_ROLES.join(', ')}`);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('Email already in use');
      err.code = 'EMAIL_IN_USE';
      throw err;
    }

    tempPassword = generateTempPassword();
    user = await User.create({
      firstName,
      lastName: lastName || '',
      email,
      phone: phone || '',
      password: tempPassword,
      companyName: owner.companyName,
      modules: owner.modules,                  // snapshot at create; live-resolved on auth/me
      accountRole,
      permissions: normalizePermissions(permissions),
      createdBy: ownerId,
      mustChangePassword: true,
    });

    invalidateOwnerModulesCache(ownerId);
  }

  // Contact — always created. Acts as the directory entry for this person.
  const contact = await Contact.create({
    user_id: ownerId,
    createdBy: invitedBy,
    firstName,
    lastName: lastName || '',
    email: email || '',
    phone: phone || '',
    jobTitle: jobTitle || (accountRole ? accountRole.replace('_', ' ') : 'Worker'),
    photo: photo || null,
    linkedUser: user?._id || null,
    businesses: accountBusinessId ? [accountBusinessId] : [],
  });

  if (accountBusinessId) {
    await Business.findByIdAndUpdate(accountBusinessId, { $addToSet: { contacts: contact._id } });
  }

  // Worker — either patch the existing record or create a new one.
  let worker;
  if (existingWorkerId) {
    worker = await Worker.findOne({
      _id: existingWorkerId,
      user_id: ownerId,
      deletedAt: null,
    });
    if (!worker) throw new Error('inviteWorker: existing worker not found');
    if (user) {
      worker.linkedUser = user._id;
      worker.farmAssignments = farms;
    }
    if (jobTitle !== undefined) worker.role = workerRole || worker.role;
    if (workerRole !== undefined) worker.role = workerRole;
    await worker.save();
  } else {
    worker = await Worker.create({
      user_id: ownerId,
      createdBy: invitedBy,
      contact: contact._id,
      role: workerRole || 'labourer',
      linkedUser: user?._id || null,
      farmAssignments: farms,
      firstName,
      lastName: lastName || '',
      phone: phone || '',
      emiratesIdNumber: emiratesIdNumber || '',
      emiratesIdExpiry: emiratesIdExpiry || '',
      passportNumber: passportNumber || '',
      passportCountry: passportCountry || '',
      passportExpiry: passportExpiry || '',
      compensation: compensation ?? null,
      photo: photo || null,
      eidFront: eidFront || null,
      eidBack: eidBack || null,
      visa: visa || null,
      passportPage: passportPage || null,
      otherDocs: Array.isArray(otherDocs) ? otherDocs : [],
    });
  }

  if (user && tempPassword) {
    try {
      await sendCredentials(user, tempPassword, {
        ownerName: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email,
      });
    } catch (err) {
      console.warn('[inviteService] sendCredentials failed:', err?.message);
    }
  }

  return { user, worker, contact, tempPassword };
}

/**
 * Reversible: deactivate the linked User account so they can no longer
 * log in, but keep the Worker + Contact alive in the directory. The
 * owner can re-activate at any time.
 */
export async function revokeAccess({ ownerId, workerId }) {
  const worker = await Worker.findOne({
    _id: workerId,
    user_id: ownerId,
    deletedAt: null,
  });
  if (!worker) throw new Error('revokeAccess: worker not found');

  if (!worker.linkedUser) {
    return { worker, user: null, alreadyRevoked: true };
  }

  const user = await User.findOneAndUpdate(
    { _id: worker.linkedUser, createdBy: ownerId },
    { isActive: false },
    { new: true }
  );

  return { worker, user, alreadyRevoked: false };
}

/**
 * Soft-delete a sub-user with cascading deletedAt to their linked
 * Worker and Contact (per DATA_OWNERSHIP.md Invariant 6 — same
 * timestamp across the cascade for future "undo"). Logs each entity
 * type to DeletionLog so mobile sync engines drop them locally.
 *
 * Returns the list of (entityType, id) pairs that were soft-deleted.
 */
export async function softDeleteUser({ ownerId, userId, logDeletion }) {
  const user = await User.findOne({ _id: userId, createdBy: ownerId, deletedAt: null });
  if (!user) throw new Error('softDeleteUser: user not found');

  const now = new Date();
  user.deletedAt = now;
  user.isActive = false;
  await user.save();

  const cascadedWorkers = await Worker.find({
    linkedUser: user._id,
    deletedAt: null,
  }).select('_id');
  await Worker.updateMany(
    { linkedUser: user._id, deletedAt: null },
    { deletedAt: now }
  );

  const cascadedContacts = await Contact.find({
    linkedUser: user._id,
    deletedAt: null,
  }).select('_id');
  await Contact.updateMany(
    { linkedUser: user._id, deletedAt: null },
    { deletedAt: now }
  );

  const deletions = [['user', user._id]];
  for (const w of cascadedWorkers) deletions.push(['worker', w._id]);
  for (const c of cascadedContacts) deletions.push(['contact', c._id]);

  if (typeof logDeletion === 'function') {
    for (const [type, id] of deletions) {
      await logDeletion(ownerId, type, id);
    }
  }

  return { user, deletions };
}
