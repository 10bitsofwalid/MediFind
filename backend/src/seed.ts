import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from './config/db';
import { User } from './models/User';
import { Pharmacy } from './models/Pharmacy';
import { Medicine } from './models/Medicine';
import { Stock } from './models/Stock';

export const seedCustomerStagingData = async (): Promise<void> => {
  await connectDB();
  console.log('[Seed] Seeding realistic Dhaka customer demo dataset...');

  // 1. Clear existing customer demo data
  await User.deleteMany({ email: { $in: ['patient.demo@medifind.com', 'owner.greencross@medifind.com'] } });
  await Medicine.deleteMany({ brandName: { $in: ['Napa', 'Napa Extra', 'Ace', 'Ceevit'] } });
  await Pharmacy.deleteMany({ licenseNo: { $in: ['LIC-DHK-001', 'LIC-DHK-002', 'LIC-DHK-003'] } });

  // 2. Create customer and owner
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const customer = await User.create({
    email: 'patient.demo@medifind.com',
    passwordHash,
    name: 'Tamim Iqbal',
    phone: '+8801700000001',
    role: 'customer',
    status: 'active',
  });

  const owner = await User.create({
    email: 'owner.greencross@medifind.com',
    passwordHash,
    name: 'Rafiqul Islam',
    phone: '+8801800000002',
    role: 'pharmacy_owner',
    status: 'active',
  });

  // 3. Create verified Dhaka pharmacies
  const p1 = await Pharmacy.create({
    name: 'Green Cross Pharmacy',
    licenseNo: 'LIC-DHK-001',
    ownerId: owner._id,
    address: '14 Lake Road, Dhanmondi, Dhaka',
    area: 'Dhanmondi',
    phone: '+8801711000001',
    location: { type: 'Point', coordinates: [90.3742, 23.7461] },
    status: 'verified',
    verifiedAt: new Date(),
  });

  const p2 = await Pharmacy.create({
    name: 'CarePoint Pharmacy',
    licenseNo: 'LIC-DHK-002',
    ownerId: owner._id,
    address: '28 Road 7A, Dhanmondi, Dhaka',
    area: 'Dhanmondi',
    phone: '+8801711000002',
    location: { type: 'Point', coordinates: [90.3765, 23.7495] },
    status: 'verified',
    verifiedAt: new Date(),
  });

  // 4. Create Curated Active Medicines
  const m1 = await Medicine.create({
    brandName: 'Napa',
    genericName: 'Paracetamol',
    strength: '500 mg',
    dosageForm: 'Tablet',
    manufacturer: 'Beximco Pharmaceuticals',
    category: 'Analgesic',
    active: true,
  });

  const m2 = await Medicine.create({
    brandName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    dosageForm: 'Tablet',
    manufacturer: 'Beximco Pharmaceuticals',
    category: 'Analgesic',
    active: true,
  });

  // 5. Create stock records
  await Stock.deleteMany({ pharmacyId: { $in: [p1._id, p2._id] } });
  await Stock.create({
    pharmacyId: p1._id,
    medicineId: m1._id,
    stockStatus: 'available',
    quantity: 12,
    price: 1.2,
    updatedBy: owner._id,
    updatedAt: new Date(),
  });

  await Stock.create({
    pharmacyId: p2._id,
    medicineId: m1._id,
    stockStatus: 'low',
    quantity: 4,
    price: 1.2,
    updatedBy: owner._id,
    updatedAt: new Date(),
  });

  console.log('[Seed] Successfully populated Dhaka staging pharmacies, medicines and stock records!');
  await disconnectDB();
};

if (require.main === module) {
  seedCustomerStagingData().then(() => process.exit(0)).catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
}
