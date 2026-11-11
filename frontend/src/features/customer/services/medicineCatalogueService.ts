// frontend/src/features/customer/services/medicineCatalogueService.ts
import { api } from '../../../services/api';
import type { MedicineSuggestion } from '../types';

export interface MedicineCatalogueItem extends MedicineSuggestion {
  manufacturer?: string;
  isCatalogueVerified: boolean;
  sameGenericAlternatives?: string[];
  description?: string;
}

// Seeded catalogue items adhering to DGDA essential drugs / MediFind catalogue
const CATALOGUE_SEED: MedicineCatalogueItem[] = [
  {
    id: 'med-paracetamol-500',
    name: 'Paracetamol 500 mg tablet',
    genericName: 'Paracetamol',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'Square Pharmaceuticals',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Generic Paracetamol', 'Panadol 500 mg', 'Napa 500 mg', 'Ace 500 mg'],
    description: 'Oral analgesic and antipyretic agent.',
  },
  {
    id: 'med-panadol-500',
    name: 'Panadol 500 mg tablet',
    genericName: 'Paracetamol',
    strength: '500 mg',
    form: 'Tablet',
    manufacturer: 'GSK Consumer Healthcare',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Paracetamol 500 mg', 'Napa 500 mg', 'Ace 500 mg'],
    description: 'Brand formulated paracetamol for pain and fever relief.',
  },
  {
    id: 'med-amoxicillin-500',
    name: 'Amoxicillin 500 mg capsule',
    genericName: 'Amoxicillin',
    strength: '500 mg',
    form: 'Capsule',
    manufacturer: 'Beximco Pharma',
    isCatalogueVerified: true,
    prescriptionRequired: true,
    sameGenericAlternatives: ['Moxacil 500 mg', 'Tyclav 500 mg'],
    description: 'Broad-spectrum beta-lactam antibacterial.',
  },
  {
    id: 'med-cetirizine-10',
    name: 'Cetirizine 10 mg tablet',
    genericName: 'Cetirizine Hydrochloride',
    strength: '10 mg',
    form: 'Tablet',
    manufacturer: 'Incepta Pharmaceuticals',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Alatrol 10 mg', 'Cetriz 10 mg'],
    description: 'Second-generation non-sedating antihistamine.',
  },
  {
    id: 'med-ibuprofen-200',
    name: 'Ibuprofen 200 mg tablet',
    genericName: 'Ibuprofen',
    strength: '200 mg',
    form: 'Tablet',
    manufacturer: 'Renata Limited',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['Flamyd 200 mg', 'Profen 200 mg'],
    description: 'Nonsteroidal anti-inflammatory drug (NSAID).',
  },
  {
    id: 'med-vitamin-d-1000',
    name: 'Vitamin D3 1000 IU capsule',
    genericName: 'Cholecalciferol',
    strength: '1000 IU',
    form: 'Capsule',
    manufacturer: 'Healthcare Pharmaceuticals',
    isCatalogueVerified: true,
    prescriptionRequired: false,
    sameGenericAlternatives: ['D-Rise 1000 IU', 'Ostocal D'],
    description: 'Dietary vitamin D3 supplement.',
  },
];

export const medicineCatalogueService = {
  /**
   * Search medicine catalogue by brand name, generic name, or strength.
   * Tries backend GET /api/medicines/search first; falls back gracefully to CATALOGUE_SEED.
   */
  async searchSuggestions(searchTerm: string): Promise<MedicineCatalogueItem[]> {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    try {
      const response = await api.get('/medicines/search', { params: { q: query } });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch {
      // Backend not yet available or offline - use seeded catalogue fallback
    }

    return CATALOGUE_SEED.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.genericName.toLowerCase().includes(query) ||
        item.strength.toLowerCase().includes(query)
    );
  },

  /**
   * Get specific medicine details from catalogue
   */
  async getMedicineById(id: string): Promise<MedicineCatalogueItem | null> {
    try {
      const response = await api.get(`/medicines/${id}`);
      if (response.data) return response.data;
    } catch {
      // Fallback
    }

    const found = CATALOGUE_SEED.find((item) => item.id === id);
    if (found) return found;

    // Default fallback if id matches a name query
    const nameMatch = CATALOGUE_SEED.find((item) => item.name.toLowerCase().includes(id.toLowerCase()));
    return nameMatch || CATALOGUE_SEED[0];
  },
};

