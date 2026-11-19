// backend/src/fixtures/syntheticFixtures.ts
import type {
  LocationGeoJSON,
  Pharmacy,
  PharmacyApplicationPayload,
  PharmacyApplicationResponse,
  WeeklyHours,
} from '../types/pharmacy';
import type {
  Medicine,
  StockHistoryRecord,
  StockInventoryRecord,
} from '../types/stock';
import { createDefaultWeeklyHours, formatWeeklyHours } from '../validation/commonValidators';

/**
 * Standard Dhaka weekly operating hours fixture.
 */
export const syntheticWeeklyHours: WeeklyHours = createDefaultWeeklyHours();

/**
 * 24/7 round-the-clock weekly operating hours fixture.
 */
export const synthetic24HourWeeklyHours: WeeklyHours = {
  monday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  tuesday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  wednesday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  thursday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  friday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  saturday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
  sunday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
};

/**
 * Synthetic Dhanmondi, Dhaka GeoJSON location.
 */
export const syntheticDhakaLocation: LocationGeoJSON = {
  type: 'Point',
  coordinates: [90.3760, 23.7465], // [longitude, latitude]
};

/**
 * Synthetic Pharmacy Application Payload (Dhanmondi, Dhaka).
 */
export const syntheticPharmacyApplicationPayload: PharmacyApplicationPayload = {
  name: 'Green Life Model Pharmacy',
  ownerName: 'Dr. Rafiqul Islam',
  phone: '+8801712345678',
  email: 'rafiqul.islam@greenlife.example',
  streetAddress: 'House 42, Road 9A, Dhanmondi',
  city: 'Dhaka',
  area: 'Dhanmondi',
  postalCode: '1209',
  formattedAddress: 'House 42, Road 9A, Dhanmondi, Dhaka - 1209',
  licenseNo: 'DGDA/DA-2024-8901',
  issuingAuthority: 'Directorate General of Drug Administration (DGDA)',
  licenseExpiryDate: '2028-12-31',
  licenseType: 'Retail Drug Licence (Form 24)',
  latitude: 23.7465,
  longitude: 90.3760,
  location: syntheticDhakaLocation,
  openingHours: formatWeeklyHours(syntheticWeeklyHours),
  structuredHours: syntheticWeeklyHours,
  notes: 'Registered model pharmacy equipped with dedicated temperature-controlled cold storage.',
};

/**
 * Synthetic Pending Application Response.
 */
export const syntheticPendingApplication: PharmacyApplicationResponse = {
  applicationId: 'app_673e1a0b1234567890abcdef',
  pharmacyId: 'ph_673e1a0b1234567890fedcba',
  status: 'pending',
  submittedAt: '2026-11-19T06:00:00.000Z',
  message: 'Pharmacy application submitted successfully and is pending administrator review.',
  data: syntheticPharmacyApplicationPayload,
};

/**
 * Synthetic Rejected Application Response.
 */
export const syntheticRejectedApplication: PharmacyApplicationResponse = {
  applicationId: 'app_673e1a0b1234567890rejected',
  pharmacyId: 'ph_673e1a0b1234567890rejected',
  status: 'rejected',
  submittedAt: '2026-11-17T09:30:00.000Z',
  message: 'Pharmacy application requires revision before approval can be granted.',
  data: {
    ...syntheticPharmacyApplicationPayload,
    name: 'Al-Madina Dispensary',
    licenseNo: 'DGDA/DA-2023-4120',
  },
  verificationReason: 'DGDA trade licence document upload was blurry and illegible.',
  decisionReason: 'DGDA trade licence document upload was blurry and illegible.',
  nextStep: 'Please upload a clear high-resolution PDF scan of your Form 24 licence certificate and resubmit.',
};

/**
 * Synthetic Verified Pharmacy Profile.
 */
export const syntheticVerifiedPharmacy: Pharmacy = {
  _id: '673e1a0b1234567890fedcba',
  id: '673e1a0b1234567890fedcba',
  ownerId: '673e1a0b1234567890111111',
  name: 'Green Life Model Pharmacy',
  ownerName: 'Dr. Rafiqul Islam',
  phone: '+8801712345678',
  email: 'rafiqul.islam@greenlife.example',
  address: 'House 42, Road 9A, Dhanmondi, Dhaka - 1209',
  streetAddress: 'House 42, Road 9A, Dhanmondi',
  city: 'Dhaka',
  area: 'Dhanmondi',
  postalCode: '1209',
  formattedAddress: 'House 42, Road 9A, Dhanmondi, Dhaka - 1209',
  licenseNo: 'DGDA/DA-2024-8901',
  issuingAuthority: 'Directorate General of Drug Administration (DGDA)',
  licenseExpiryDate: '2028-12-31',
  licenseType: 'Retail Drug Licence (Form 24)',
  location: syntheticDhakaLocation,
  latitude: 23.7465,
  longitude: 90.3760,
  openingHours: formatWeeklyHours(syntheticWeeklyHours),
  structuredHours: syntheticWeeklyHours,
  status: 'verified',
  verificationReason: 'Licence and premises verified by DGDA Regional Inspector.',
  decisionReason: 'Licence and premises verified by DGDA Regional Inspector.',
  createdAt: '2026-11-15T08:00:00.000Z',
  updatedAt: '2026-11-19T06:30:00.000Z',
};

/**
 * Synthetic Suspended Pharmacy Profile.
 */
export const syntheticSuspendedPharmacy: Pharmacy = {
  _id: '673e1a0b1234567890suspended',
  id: '673e1a0b1234567890suspended',
  ownerId: '673e1a0b1234567890222222',
  name: 'Care & Cure Chemist',
  ownerName: 'Kamal Hossain',
  phone: '+8801819876543',
  email: 'kamal@carecure.example',
  address: '12 Mirpur Road, Mirpur-10, Dhaka - 1216',
  streetAddress: '12 Mirpur Road, Mirpur-10',
  city: 'Dhaka',
  area: 'Mirpur',
  postalCode: '1216',
  formattedAddress: '12 Mirpur Road, Mirpur-10, Dhaka - 1216',
  licenseNo: 'DGDA/DH-2022-7741',
  issuingAuthority: 'Directorate General of Drug Administration (DGDA)',
  location: { type: 'Point', coordinates: [90.3687, 23.8069] },
  latitude: 23.8069,
  longitude: 90.3687,
  openingHours: 'Mon-Sun: 09:00 - 23:00',
  status: 'suspended',
  verificationReason: 'Temporary suspension pending DGDA compliance review of storage temperatures.',
  decisionReason: 'Temporary suspension pending DGDA compliance review of storage temperatures.',
  nextStep: 'Contact MediFind Compliance at compliance@medifind.example for reinstatement procedures.',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-11-18T14:20:00.000Z',
};

/**
 * Curated synthetic medicines for development and staging.
 */
export const syntheticMedicines: Medicine[] = [
  {
    id: 'med_paracetamol_500',
    name: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    description: 'Relief of mild to moderate pain including headache, migraine, toothache, and fever.',
    prescriptionRequired: false,
    active: true,
  },
  {
    id: 'med_omeprazole_20',
    name: 'Seclo 20',
    genericName: 'Omeprazole',
    strength: '20 mg',
    form: 'Capsule',
    manufacturer: 'Square Pharmaceuticals PLC',
    description: 'Proton pump inhibitor for gastric ulcers, GERD, and hypersecretory conditions.',
    prescriptionRequired: false,
    active: true,
  },
  {
    id: 'med_amoxicillin_500',
    name: 'Moxacil 500',
    genericName: 'Amoxicillin Trihydrate',
    strength: '500 mg',
    form: 'Capsule',
    manufacturer: 'Square Pharmaceuticals PLC',
    description: 'Broad-spectrum antibiotic for bacterial infections of ear, nose, throat, and chest.',
    prescriptionRequired: true,
    active: true,
  },
  {
    id: 'med_azithromycin_500',
    name: 'Zimax 500',
    genericName: 'Azithromycin',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'Incepta Pharmaceuticals Ltd.',
    description: 'Macrolide antibiotic for upper and lower respiratory tract infections.',
    prescriptionRequired: true,
    active: true,
  },
  {
    id: 'med_metformin_500',
    name: 'Comet 500',
    genericName: 'Metformin Hydrochloride',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'Square Pharmaceuticals PLC',
    description: 'Antidiabetic medication for glycemic control in type 2 diabetes mellitus.',
    prescriptionRequired: true,
    active: true,
  },
];

/**
 * Synthetic stock items covering Available, Low, Out of Stock, Stale, and Unverified states.
 */
export const syntheticStockItems: StockInventoryRecord[] = [
  {
    stockId: 'stk_001_napa',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_paracetamol_500',
    medicineName: 'Napa Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500 mg + 65 mg',
    form: 'Tablet',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    prescriptionRequired: false,
    status: 'available',
    quantity: 150,
    price: 3.5,
    notes: 'Fresh batch received today.',
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (fresh)
    isStale: false,
    freshness: 'fresh',
  },
  {
    stockId: 'stk_002_seclo',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_omeprazole_20',
    medicineName: 'Seclo 20',
    genericName: 'Omeprazole',
    strength: '20 mg',
    form: 'Capsule',
    manufacturer: 'Square Pharmaceuticals PLC',
    prescriptionRequired: false,
    status: 'low',
    quantity: 8,
    price: 7.0,
    notes: 'Reorder placed with distributor.',
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago (fresh)
    isStale: false,
    freshness: 'fresh',
  },
  {
    stockId: 'stk_003_moxacil',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_amoxicillin_500',
    medicineName: 'Moxacil 500',
    genericName: 'Amoxicillin Trihydrate',
    strength: '500 mg',
    form: 'Capsule',
    manufacturer: 'Square Pharmaceuticals PLC',
    prescriptionRequired: true,
    status: 'out',
    quantity: 0,
    price: 10.0,
    notes: 'Temporarily out of stock from distributor.',
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    isStale: false,
    freshness: 'fresh',
  },
  {
    stockId: 'stk_004_zimax_stale',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_azithromycin_500',
    medicineName: 'Zimax 500',
    genericName: 'Azithromycin',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'Incepta Pharmaceuticals Ltd.',
    prescriptionRequired: true,
    status: 'available',
    quantity: 35,
    price: 35.0,
    notes: 'Needs physical shelf reconfirmation.',
    updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago (stale > 24h)
    isStale: true,
    freshness: 'stale',
  },
  {
    stockId: 'stk_005_comet_unverified',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_metformin_500',
    medicineName: 'Comet 500',
    genericName: 'Metformin Hydrochloride',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'Square Pharmaceuticals PLC',
    prescriptionRequired: true,
    status: 'unverified',
    quantity: 20,
    price: 5.0,
    notes: 'Customer reported discrepancy — pending physical audit.',
    updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    isStale: false,
    freshness: 'fresh',
  },
];

/**
 * Synthetic Stock History Audit Trail.
 */
export const syntheticStockHistory: StockHistoryRecord[] = [
  {
    historyId: 'hist_001_create',
    stockId: 'stk_001_napa',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_paracetamol_500',
    oldStatus: null,
    newStatus: 'available',
    oldQuantity: null,
    newQuantity: 100,
    changedBy: '673e1a0b1234567890111111',
    changedByName: 'Dr. Rafiqul Islam',
    changedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    historyId: 'hist_002_restock',
    stockId: 'stk_001_napa',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_paracetamol_500',
    oldStatus: 'available',
    newStatus: 'available',
    oldQuantity: 100,
    newQuantity: 150,
    changedBy: '673e1a0b1234567890111111',
    changedByName: 'Dr. Rafiqul Islam',
    changedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    historyId: 'hist_003_seclo_low',
    stockId: 'stk_002_seclo',
    pharmacyId: '673e1a0b1234567890fedcba',
    medicineId: 'med_omeprazole_20',
    oldStatus: 'available',
    newStatus: 'low',
    oldQuantity: 40,
    newQuantity: 8,
    changedBy: '673e1a0b1234567890111111',
    changedByName: 'Dr. Rafiqul Islam',
    changedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
];
