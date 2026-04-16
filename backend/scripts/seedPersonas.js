import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Business from '../models/Business.js';
import Contact from '../models/Contact.js';
import Worker from '../models/Worker.js';

const OWNER_EMAIL = 'owner@persona.test';
const DEFAULT_PASSWORD = 'Persona1!';

const PERSONAS = [
  { email: 'owner@persona.test',        firstName: 'Owner',       accountRole: 'owner',        modules: ['broiler'] },
  { email: 'manager@persona.test',      firstName: 'Manager',      accountRole: 'manager',      modules: ['broiler'] },
  { email: 'accountant@persona.test',   firstName: 'Accountant',   accountRole: 'accountant',   modules: ['broiler'] },
  { email: 'vet@persona.test',          firstName: 'Vet',          accountRole: 'veterinarian', modules: ['broiler'] },
  { email: 'worker@persona.test',       firstName: 'Worker',       accountRole: 'ground_staff', modules: ['broiler'] },
  { email: 'viewer@persona.test',       firstName: 'Viewer',       accountRole: 'viewer',       modules: ['broiler'] },
];

async function run() {
  await connectDB();
  console.log('[seedPersonas] connected');

  let owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    owner = await User.create({
      firstName: 'Owner',
      lastName: 'Persona',
      email: OWNER_EMAIL,
      password: DEFAULT_PASSWORD,
      accountRole: 'owner',
      modules: ['broiler'],
      companyName: 'Persona Farms',
    });

    const biz = await Business.create({
      user_id: owner._id,
      createdBy: owner._id,
      companyName: 'Persona Farms',
      isAccountBusiness: true,
    });
    owner.accountBusiness = biz._id;
    await owner.save();
    console.log('[seedPersonas] owner created:', OWNER_EMAIL);
  } else {
    console.log('[seedPersonas] owner already exists:', OWNER_EMAIL);
  }

  for (const p of PERSONAS) {
    if (p.email === OWNER_EMAIL) continue;

    const existing = await User.findOne({ email: p.email });
    if (existing) {
      console.log('[seedPersonas] skip existing:', p.email);
      continue;
    }

    const user = await User.create({
      firstName: p.firstName,
      lastName: 'Persona',
      email: p.email,
      password: DEFAULT_PASSWORD,
      accountRole: p.accountRole,
      modules: p.modules,
      createdBy: owner._id,
      companyName: owner.companyName,
      mustChangePassword: false,
    });

    const contact = await Contact.create({
      user_id: owner._id,
      createdBy: owner._id,
      firstName: p.firstName,
      lastName: 'Persona',
      email: p.email,
      jobTitle: p.accountRole,
      linkedUser: user._id,
      businesses: owner.accountBusiness ? [owner.accountBusiness] : [],
    });

    if (p.accountRole === 'ground_staff' || p.accountRole === 'veterinarian') {
      await Worker.create({
        user_id: owner._id,
        createdBy: owner._id,
        firstName: p.firstName,
        lastName: 'Persona',
        role: p.accountRole === 'ground_staff' ? 'labourer' : 'veterinarian',
        linkedUser: user._id,
        houseAssignments: [],
        contact: contact._id,
      });
    }

    console.log('[seedPersonas] created:', p.email, `(${p.accountRole})`);
  }

  console.log('');
  console.log('[seedPersonas] done.');
  console.log('  owner:      owner@persona.test');
  console.log('  manager:    manager@persona.test');
  console.log('  accountant: accountant@persona.test');
  console.log('  vet:        vet@persona.test');
  console.log('  worker:     worker@persona.test');
  console.log('  viewer:     viewer@persona.test');
  console.log(`  password (all): ${DEFAULT_PASSWORD}`);
  console.log('');
  console.log('  dev login-as: POST /api/dev/login-as { "email": "worker@persona.test" }');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
