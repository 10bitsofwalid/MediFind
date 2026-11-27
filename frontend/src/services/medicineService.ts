// frontend/src/services/medicineService.ts
import { api } from './api';
import type { NearbyPharmacyResult, MedicineSuggestion } from '../features/customer/types';
import type { StockStatus, Pharmacy } from '../types/pharmacy';
import type { StockInventoryRecord } from '../types/medicine';
import { calculateDistanceKm, resolveAreaCoordinates } from '../features/customer/utils/geoUtils';
import { isMockApiEnabled } from './pharmacyService';

export interface MedicineCatalogueDetails extends MedicineSuggestion {
  manufacturer?: string;
  isCatalogueVerified: boolean;
  sameGenericAlternatives?: string[];
  description?: string;
}

// Core medicine catalogue
const MASTER_MEDICINE_CATALOGUE: MedicineCatalogueDetails[] = [
  {
    id: 'med_001',
    name: 'Napa Extra 500 mg tablet',
    genericName: 'Paracetamol + Caffeine',
    form: 'Tablet',
    strength: '500 mg + 65 mg',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Ace Plus 500 mg', 'Fast Plus', 'Ge-Napa Extra'],
    description: 'Fast-acting analgesic and antipyretic for fever, headache, and body aches.',
  },
  {
    id: 'med-paracetamol-500',
    name: 'Paracetamol 500 mg tablet',
    genericName: 'Paracetamol',
    form: 'Tablet',
    strength: '500 mg',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Napa 500 mg', 'Ace 500 mg', 'Panadol 500 mg', 'Fast 500 mg'],
    description: 'Standard oral pain reliever and fever reducer.',
  },
  {
    id: 'med-panadol-500',
    name: 'Panadol 500 mg tablet',
    genericName: 'Paracetamol',
    form: 'Tablet',
    strength: '500 mg',
    manufacturer: 'GSK Consumer Healthcare',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Paracetamol 500 mg', 'Napa 500 mg', 'Ace 500 mg'],
    description: 'Microencapsulated paracetamol tablet formulation.',
  },
  {
    id: 'med-amoxicillin-500',
    name: 'Amoxicillin 500 mg capsule',
    genericName: 'Amoxicillin',
    form: 'Capsule',
    strength: '500 mg',
    manufacturer: 'Beximco Pharma',
    isCatalogueVerified: true,
    prescriptionRequired: true,
    sameGenericAlternatives: ['Moxacil 500 mg', 'Tyclav 500 mg', 'Fimoxyl 500 mg'],
    description: 'Moderate-spectrum bactericidal penicillin class antibiotic.',
  },
  {
    id: 'med-cetirizine-10',
    name: 'Cetirizine 10 mg tablet',
    genericName: 'Cetirizine Hydrochloride',
    form: 'Tablet',
    strength: '10 mg',
    manufacturer: 'Incepta Pharmaceuticals Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Alatrol 10 mg', 'Cetriz 10 mg', 'Atrizin 10 mg'],
    description: 'Non-sedating selective H1 receptor antihistamine for allergies.',
  },
  {
    id: 'med-seclo-20',
    name: 'Seclo 20 mg capsule',
    genericName: 'Omeprazole',
    form: 'Capsule',
    strength: '20 mg',
    manufacturer: 'Square Pharmaceuticals Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Losectil 20 mg', 'Proceptin 20 mg', 'Omez 20 mg'],
    description: 'Proton pump inhibitor (PPI) reducing stomach acid production.',
  },
  {
    id: 'med-azithrocin-500',
    name: 'Azithrocin 500 mg tablet',
    genericName: 'Azithromycin',
    form: 'Tablet',
    strength: '500 mg',
    manufacturer: 'Aristopharma Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: true,
    sameGenericAlternatives: ['Zimax 500 mg', 'Tridosil 500 mg'],
    description: 'Macrolide antibacterial agent.',
  },
  {
    id: 'med-ibuprofen-200',
    name: 'Ibuprofen 200 mg tablet',
    genericName: 'Ibuprofen',
    form: 'Tablet',
    strength: '200 mg',
    manufacturer: 'Renata Limited',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Flamyd 200 mg', 'Profen 200 mg'],
    description: 'NSAID for pain, inflammation, and stiffness relief.',
  },
  {
    id: 'med-vitamin-d-1000',
    name: 'Vitamin D3 1000 IU capsule',
    genericName: 'Cholecalciferol',
    form: 'Capsule',
    strength: '1000 IU',
    manufacturer: 'Healthcare Pharmaceuticals Ltd.',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['D-Rise 1000 IU', 'Ostocal D'],
    description: 'Fat-soluble vitamin D3 supplement.',
  },
];

// Baseline verified pharmacies in Dhaka
const BASELINE_PHARMACIES: Pharmacy[] = [
  {
    _id: 'pharma-1',
    id: 'pharma-1',
    name: 'Green Cross Pharmacy',
    phone: '+8801711000001',
    address: '14 Lake Road, Dhanmondi, Dhaka',
    formattedAddress: '14 Lake Road, Dhanmondi, Dhaka',
    latitude: 23.7461,
    longitude: 90.3742,
    location: { type: 'Point', coordinates: [90.3742, 23.7461] },
    openingHours: 'Mon-Sun: 08:00 - 22:00',
    status: 'verified',
    licenseNo: 'DGDA-DH-48912',
  },
  {
    _id: 'pharma-2',
    id: 'pharma-2',
    name: 'CarePoint Pharmacy',
    phone: '+8801711000002',
    address: '28 Road 7A, Dhanmondi, Dhaka',
    formattedAddress: '28 Road 7A, Dhanmondi, Dhaka',
    latitude: 23.7505,
    longitude: 90.3795,
    location: { type: 'Point', coordinates: [90.3795, 23.7505] },
    openingHours: 'Mon-Sun: 09:00 - 21:00',
    status: 'verified',
    licenseNo: 'DGDA-DH-51204',
  },
  {
    _id: 'pharma-3',
    id: 'pharma-3',
    name: 'CityWell Pharmacy',
    phone: '+8801711000003',
    address: 'Plot 12, Mirpur Road, Dhaka',
    formattedAddress: 'Plot 12, Mirpur Road, Dhaka',
    latitude: 23.7550,
    longitude: 90.3850,
    location: { type: 'Point', coordinates: [90.3850, 23.7550] },
    openingHours: 'Mon-Sun: 08:30 - 23:00',
    status: 'verified',
    licenseNo: 'DGDA-DH-39821',
  },
  {
    _id: 'pharma-unverified-4',
    id: 'pharma-unverified-4',
    name: 'Metro Care Chemists (Pending Verification)',
    phone: '+8801711999999',
    address: '32 Central Road, Dhanmondi, Dhaka',
    formattedAddress: '32 Central Road, Dhanmondi, Dhaka',
    latitude: 23.7410,
    longitude: 90.3800,
    location: { type: 'Point', coordinates: [90.3800, 23.7410] },
    openingHours: 'Mon-Sun: 10:00 - 20:00',
    status: 'pending', // Must NEVER show as verified!
    licenseNo: 'DGDA-PENDING-001',
  },
];

export const medicineService = {
  /**
   * Get medicine specifications by ID or name
   */
  async getMedicineById(idOrName: string): Promise<MedicineCatalogueDetails | null> {
    const target = idOrName.trim().toLowerCase();
    if (!target) return null;

    if (!isMockApiEnabled()) {
      try {
        const res = await api.get(`/medicines/${encodeURIComponent(target)}`);
        if (res.data) return res.data;
      } catch {
        // Fallback
      }
    }

    const exactMatch = MASTER_MEDICINE_CATALOGUE.find(
      (m) => m.id === idOrName || m.name.toLowerCase() === target
    );
    if (exactMatch) return exactMatch;

    const partialMatch = MASTER_MEDICINE_CATALOGUE.find(
      (m) => m.name.toLowerCase().includes(target) || m.genericName.toLowerCase().includes(target)
    );
    return partialMatch || MASTER_MEDICINE_CATALOGUE[1]; // default Paracetamol 500mg
  },

  /**
   * Database-backed search for nearby pharmacies reporting stock for a medicine.
   * Consumes live inventory updates from Dev 2's stock storage.
   */
  async searchNearbyPharmacies(params: {
    query: string;
    area?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  }): Promise<{ medicine: MedicineCatalogueDetails | null; results: NearbyPharmacyResult[] }> {
    const queryTrimmed = params.query.trim();
    if (!queryTrimmed) {
      return { medicine: null, results: [] };
    }

    // Resolve search medicine from catalogue
    const medicine = await this.getMedicineById(queryTrimmed);

    // Resolve coordinates from params or area fallback
    const coords =
      params.latitude && params.longitude
        ? { lat: params.latitude, lng: params.longitude }
        : resolveAreaCoordinates(params.area);

    const radius = params.radiusKm || 15;

    // Try live API if mock is disabled
    if (!isMockApiEnabled()) {
      try {
        const response = await api.get('/pharmacies/nearby', {
          params: {
            q: queryTrimmed,
            medicineId: medicine?.id,
            lat: coords.lat,
            lng: coords.lng,
            radiusKm: radius,
          },
        });
        if (response.data && Array.isArray(response.data.results)) {
          return { medicine, results: response.data.results };
        }
      } catch {
        // Graceful fallback to database / local stock store
      }
    }

    // In development mode, retrieve registered pharmacies (including any added by Dev 2 onboarding)
    const allPharmacies: Pharmacy[] = [...BASELINE_PHARMACIES];

    // Check if current user has registered a pharmacy in Dev 2 flow
    try {
      const storedAppRaw = localStorage.getItem('medifind_mock_pharmacy_application');
      if (storedAppRaw) {
        const parsedApp = JSON.parse(storedAppRaw);
        if (parsedApp?.data?.name) {
          allPharmacies.push({
            _id: parsedApp.pharmacyId || 'pharma-local-registered',
            id: parsedApp.pharmacyId || 'pharma-local-registered',
            name: parsedApp.data.name,
            phone: parsedApp.data.phone || '+8801711000099',
            address: parsedApp.data.formattedAddress || parsedApp.data.streetAddress,
            formattedAddress: parsedApp.data.formattedAddress,
            latitude: parsedApp.data.latitude || 23.748,
            longitude: parsedApp.data.longitude || 90.376,
            location: {
              type: 'Point',
              coordinates: [parsedApp.data.longitude || 90.376, parsedApp.data.latitude || 23.748],
            },
            openingHours: parsedApp.data.openingHours || 'Mon-Sun: 09:00 - 21:00',
            status: parsedApp.status || 'pending',
            licenseNo: parsedApp.data.licenseNo,
          });
        }
      }
    } catch {
      // Ignore parse error
    }

    // Query query matches against medicines
    const queryLower = queryTrimmed.toLowerCase();
    const isErrorTrigger = queryLower === 'error_trigger' || queryLower === 'network_failure';
    if (isErrorTrigger) {
      throw new Error('Network connection timeout: Unable to query nearby pharmacy inventory.');
    }

    const results: NearbyPharmacyResult[] = [];

    for (const pharmacy of allPharmacies) {
      const pharmaLat = pharmacy.latitude || pharmacy.location?.coordinates[1] || 23.7461;
      const pharmaLng = pharmacy.longitude || pharmacy.location?.coordinates[0] || 90.3742;

      const distance = calculateDistanceKm(coords.lat, coords.lng, pharmaLat, pharmaLng);
      if (distance > radius) continue;

      // Check Dev 2's stock storage for this pharmacy
      let stockStatus: StockStatus = 'available';
      let quantity = 12;
      let updatedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 mins ago
      let isStale = false;

      const pharmaId = pharmacy.id || pharmacy._id;
      const stockRaw = localStorage.getItem(`medifind_mock_stock_inventory_${pharmaId}`);
      if (stockRaw) {
        try {
          const records: StockInventoryRecord[] = JSON.parse(stockRaw);
          const matched = records.find(
            (r) =>
              r.medicineName.toLowerCase().includes(queryLower) ||
              r.genericName.toLowerCase().includes(queryLower) ||
              (medicine && r.medicineId === medicine.id)
          );
          if (matched) {
            stockStatus = matched.status;
            quantity = matched.quantity || 0;
            updatedAt = matched.updatedAt;
            isStale = !!matched.isStale;
          }
        } catch {
          // Fallback to default
        }
      } else {
        // Preset seed variation matching UI Design Page 4
        if (pharmaId === 'pharma-2') {
          stockStatus = 'low';
          quantity = 4;
          updatedAt = new Date(Date.now() - 34 * 60 * 1000).toISOString();
        } else if (pharmaId === 'pharma-3') {
          stockStatus = 'available';
          quantity = 8;
          updatedAt = new Date(Date.now() - 26 * 3600 * 1000).toISOString(); // Stale
          isStale = true;
        } else if (pharmaId === 'pharma-unverified-4') {
          stockStatus = 'unverified';
          quantity = 0;
          updatedAt = new Date(Date.now() - 50 * 3600 * 1000).toISOString();
          isStale = true;
        }
      }

      // Check if medicine matches known drugs
      const queryWords = queryLower.split(/\s+/).filter(Boolean);
      const isKnown = MASTER_MEDICINE_CATALOGUE.some((m) => {
        const targetString = `${m.name} ${m.genericName} ${m.strength}`.toLowerCase();
        return queryWords.every((word) => targetString.includes(word));
      });

      if (!isKnown) {
        continue;
      }

      // Trust Boundary rule: strictly enforce verification status
      const isVerified = pharmacy.status === 'verified';

      results.push({
        id: `res_${pharmaId}_${medicine?.id || 'med'}`,
        pharmacyId: pharmaId,
        pharmacyName: pharmacy.name,
        isVerified,
        address: pharmacy.formattedAddress || pharmacy.address,
        phone: pharmacy.phone,
        latitude: pharmaLat,
        longitude: pharmaLng,
        distanceKm: distance,
        isOpen: true,
        openingHoursText: pharmacy.openingHours || 'Open until 10:00 PM',
        stockStatus,
        quantity,
        updatedAt,
        isStale,
        medicineId: medicine?.id || 'med-paracetamol-500',
        medicineName: medicine?.name || 'Paracetamol 500 mg',
        genericName: medicine?.genericName || 'Paracetamol',
        strength: medicine?.strength || '500 mg',
        form: medicine?.form || 'Tablet',
        isDemoData: true,
      });
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    return { medicine, results };
  },
};

