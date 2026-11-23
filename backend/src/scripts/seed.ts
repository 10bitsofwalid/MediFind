// backend/src/scripts/seed.ts
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Pharmacy } from '../models/Pharmacy';
import { PharmacyApplication } from '../models/PharmacyApplication';
import { Medicine } from '../models/Medicine';
import { Stock } from '../models/Stock';
import { StockHistory } from '../models/StockHistory';
import { SystemSetting } from '../models/SystemSetting';
import {
  syntheticMedicines,
  syntheticStockItems,
  syntheticStockHistory,
  syntheticDhakaLocation,
  syntheticWeeklyHours,
} from '../fixtures/syntheticFixtures';
import { formatWeeklyHours } from '../validation/commonValidators';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medifind';
const isReset = process.argv.includes('--reset');

// Strict Safety Guard: Never seed against production
if (NODE_ENV === 'production') {
  console.error('[FATAL] Database seeding is strictly forbidden in production (NODE_ENV=production).');
  process.exit(1);
}

// Synthetic Demo Passwords (used strictly for local/staging demonstration)
const DEMO_PASSWORD_RAW = 'MediFind2026!Demo';

async function runSeed() {
  console.log(`[Seed] Environment: ${NODE_ENV}`);
  console.log(`[Seed] Target MongoDB: ${MONGODB_URI}`);
  console.log(`[Seed] Reset mode: ${isReset ? 'ENABLED (cleaning demo fixtures)' : 'DISABLED (upsert mode)'}`);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[Seed] Connected to MongoDB cluster successfully.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Seed] Notice: MongoDB cluster is offline (${msg}).`);
    console.warn('[Seed] In development fallback mode, synthetic fixtures in syntheticFixtures.ts are auto-loaded in memory at runtime.');
    console.warn('[Seed] If you intend to seed a live MongoDB database, please start mongod or provide a valid staging MONGODB_URI.');
    process.exit(0);
  }

  try {
    // 1. Reset existing synthetic data if --reset flag is specified
    if (isReset) {
      console.log('[Seed] Removing existing synthetic demo records...');
      await Promise.all([
        User.deleteMany({ email: { $regex: /@.*\.example$/i } }),
        Pharmacy.deleteMany({ normalizedLicenseNo: { $regex: /^DGDA/i } }),
        PharmacyApplication.deleteMany({ normalizedLicenseNo: { $regex: /^DGDA/i } }),
        Medicine.deleteMany({ source: 'DGDA_Curated' }),
        Stock.deleteMany({}),
        StockHistory.deleteMany({}),
        SystemSetting.deleteMany({}),
      ]);
      console.log('[Seed] Cleaned existing synthetic records.');
    }

    // 2. Safely synchronize database indexes without destructive changes
    console.log('[Seed] Synchronizing schema indexes safely...');
    await Promise.all([
      User.init(),
      Pharmacy.init(),
      PharmacyApplication.init(),
      Medicine.init(),
      Stock.init(),
      StockHistory.init(),
      SystemSetting.init(),
    ]);
    console.log('[Seed] Schema indexes synchronized.');

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD_RAW, 10);
    const now = new Date();

    // 3. Seed Synthetic Platform Administrator Account
    const adminEmail = 'demo.admin@medifind.example';
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Staging Platform Administrator',
        email: adminEmail,
        phone: '+8801700000001',
        password: hashedPassword,
        role: 'ADMIN',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[Seed] Created synthetic Administrator: ${adminEmail}`);
    } else {
      console.log(`[Seed] Administrator account already exists: ${adminEmail}`);
    }

    // 4. Seed Synthetic Verified Pharmacy Owner Account
    const ownerEmail = 'demo.owner@medifind.example';
    let ownerUser = await User.findOne({ email: ownerEmail });
    if (!ownerUser) {
      ownerUser = await User.create({
        name: 'Dr. Rafiqul Islam (Synthetic Demo Owner)',
        email: ownerEmail,
        phone: '+8801712345678',
        password: hashedPassword,
        role: 'PHARMACY',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[Seed] Created synthetic Pharmacy Owner: ${ownerEmail}`);
    } else {
      console.log(`[Seed] Pharmacy Owner account already exists: ${ownerEmail}`);
    }

    // 5. Seed Synthetic Pending Pharmacy Owner Account (for testing verification queue)
    const pendingOwnerEmail = 'demo.pending.owner@medifind.example';
    let pendingOwnerUser = await User.findOne({ email: pendingOwnerEmail });
    if (!pendingOwnerUser) {
      pendingOwnerUser = await User.create({
        name: 'Kamal Hossain (Pending Applicant Demo)',
        email: pendingOwnerEmail,
        phone: '+8801819876543',
        password: hashedPassword,
        role: 'PHARMACY',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[Seed] Created synthetic Pending Applicant: ${pendingOwnerEmail}`);
    }

    // 6. Seed Curated Medicine Catalogue
    console.log('[Seed] Seeding curated medicines catalogue...');
    for (const med of syntheticMedicines) {
      await Medicine.findOneAndUpdate(
        { id: med.id },
        {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          strength: med.strength,
          form: med.form,
          manufacturer: med.manufacturer,
          description: med.description,
          prescriptionRequired: med.prescriptionRequired,
          active: med.active,
          source: 'DGDA_Curated',
        },
        { upsert: true, new: true }
      );
    }
    console.log(`[Seed] Seeded ${syntheticMedicines.length} curated catalogue medicines.`);

    // 7. Seed Verified Demo Pharmacy
    const verifiedLicenseNo = 'DGDA/DA-2024-8901';
    let verifiedPharmacy = await Pharmacy.findOne({ normalizedLicenseNo: verifiedLicenseNo });
    if (!verifiedPharmacy) {
      verifiedPharmacy = await Pharmacy.create({
        ownerId: ownerUser._id,
        name: 'Green Life Model Pharmacy [DEMO STAGING]',
        ownerName: 'Dr. Rafiqul Islam',
        phone: '+8801712345678',
        email: ownerEmail,
        address: 'House 42, Road 9A, Dhanmondi, Dhaka - 1209',
        streetAddress: 'House 42, Road 9A, Dhanmondi',
        city: 'Dhaka',
        area: 'Dhanmondi',
        postalCode: '1209',
        formattedAddress: 'House 42, Road 9A, Dhanmondi, Dhaka - 1209',
        licenseNo: verifiedLicenseNo,
        normalizedLicenseNo: verifiedLicenseNo,
        issuingAuthority: 'Directorate General of Drug Administration (DGDA)',
        licenseExpiryDate: '2028-12-31',
        licenseType: 'Retail Drug Licence (Form 24)',
        location: syntheticDhakaLocation,
        latitude: 23.7465,
        longitude: 90.3760,
        openingHours: formatWeeklyHours(syntheticWeeklyHours),
        structuredHours: syntheticWeeklyHours,
        status: 'verified',
        verificationReason: 'Licence and premises verified by DGDA Regional Inspector [Demo].',
        decisionReason: 'Licence and premises verified by DGDA Regional Inspector [Demo].',
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[Seed] Created verified demo pharmacy: ${verifiedPharmacy.name}`);
    }

    // 8. Seed Pending Application for Admin Queue Walkthrough
    const pendingLicenseNo = 'DGDA/DH-2024-5544';
    let pendingApp = await PharmacyApplication.findOne({ normalizedLicenseNo: pendingLicenseNo });
    if (!pendingApp && pendingOwnerUser) {
      pendingApp = await PharmacyApplication.create({
        ownerId: pendingOwnerUser._id,
        status: 'pending',
        submittedAt: now,
        message: 'Pharmacy application submitted successfully and is pending administrator review.',
        normalizedLicenseNo: pendingLicenseNo,
        data: {
          name: 'Care & Cure Chemist [DEMO PENDING REVIEW]',
          ownerName: 'Kamal Hossain',
          phone: '+8801819876543',
          email: pendingOwnerEmail,
          streetAddress: '12 Mirpur Road, Mirpur-10',
          city: 'Dhaka',
          area: 'Mirpur',
          postalCode: '1216',
          formattedAddress: '12 Mirpur Road, Mirpur-10, Dhaka - 1216',
          licenseNo: pendingLicenseNo,
          issuingAuthority: 'Directorate General of Drug Administration (DGDA)',
          licenseExpiryDate: '2027-06-30',
          licenseType: 'Retail Drug Licence (Form 24)',
          latitude: 23.8069,
          longitude: 90.3687,
          location: { type: 'Point', coordinates: [90.3687, 23.8069] },
          openingHours: 'Mon-Sun: 09:00 - 23:00',
          structuredHours: syntheticWeeklyHours,
          notes: 'Synthetic pending application for administrator verification demo.',
        },
      });
      console.log(`[Seed] Created pending demo application: ${pendingApp.data.name}`);
    }

    // 9. Seed Synthetic Stock Items & History for Verified Pharmacy
    if (verifiedPharmacy) {
      console.log('[Seed] Seeding synthetic inventory and audit history...');
      for (const item of syntheticStockItems) {
        await Stock.findOneAndUpdate(
          { pharmacyId: verifiedPharmacy._id, medicineId: item.medicineId },
          {
            pharmacyId: verifiedPharmacy._id,
            medicineId: item.medicineId,
            status: item.status,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            updatedAt: new Date(item.updatedAt),
          },
          { upsert: true, new: true }
        );
      }

      for (const hist of syntheticStockHistory) {
        await StockHistory.create({
          pharmacyId: verifiedPharmacy._id,
          medicineId: hist.medicineId,
          oldStatus: hist.oldStatus,
          newStatus: hist.newStatus,
          oldQuantity: hist.oldQuantity,
          newQuantity: hist.newQuantity,
          changedBy: ownerUser._id,
          changedByName: 'Dr. Rafiqul Islam (Synthetic Demo Owner)',
          changedAt: new Date(hist.changedAt),
        });
      }
      console.log(`[Seed] Seeded ${syntheticStockItems.length} stock items and ${syntheticStockHistory.length} history records.`);
    }

    // 10. Seed Default System Quality Thresholds
    await SystemSetting.findOneAndUpdate(
      { key: 'quality_thresholds' },
      {
        key: 'quality_thresholds',
        value: {
          staleThresholdHours: 24,
          unverifiedReportThreshold: 3,
        },
        updatedAt: now,
      },
      { upsert: true }
    );
    console.log('[Seed] Seeded default quality thresholds (24h stale threshold, 3 report threshold).');

    console.log('\n======================================================');
    console.log('  MediFind Staging Demo Seed Completed Successfully');
    console.log('======================================================');
    console.log('Synthetic Accounts Created:');
    console.log(`  - Administrator:  ${adminEmail}`);
    console.log(`  - Verified Owner: ${ownerEmail}`);
    console.log(`  - Pending Owner:  ${pendingOwnerEmail}`);
    console.log('Demo Password: [Provided securely to demo presenters: MediFind2026!Demo]');
    console.log('Demo Pharmacy: Green Life Model Pharmacy [DEMO STAGING]');
    console.log('======================================================\n');
  } catch (err: unknown) {
    console.error('[Seed Error] Failed to seed database:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Disconnected from database.');
  }
}

void runSeed();
