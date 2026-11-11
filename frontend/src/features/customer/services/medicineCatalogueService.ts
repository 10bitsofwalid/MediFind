// frontend/src/features/customer/services/medicineCatalogueService.ts
import { api } from '../../../services/api';
import { isMockApiEnabled } from '../../../services/pharmacyService';
import { getStoredCatalogue } from '../../../services/adminService';
import type { MedicineSuggestion } from '../types';

export interface MedicineCatalogueItem extends MedicineSuggestion {
  manufacturer?: string;
  isCatalogueVerified: boolean;
  sameGenericAlternatives?: string[];
  description?: string;
}

export const medicineCatalogueService = {
  /**
   * Search medicine catalogue by brand name, generic name, or strength.
   * Calls backend GET /api/medicines/search and returns an empty array if offline or no matches.
   */
  async searchSuggestions(searchTerm: string): Promise<MedicineCatalogueItem[]> {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    if (isMockApiEnabled()) {
      return getStoredCatalogue()
        .filter(
          (item) =>
            item.active &&
            (item.name.toLowerCase().includes(query) ||
              item.genericName.toLowerCase().includes(query) ||
              item.strength.toLowerCase().includes(query))
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          genericName: item.genericName,
          strength: item.strength,
          form: item.form,
          manufacturer: item.manufacturer,
          description: item.description,
          prescriptionRequired: item.prescriptionRequired,
          isCatalogueVerified: true,
        }));
    }

    try {
      const response = await api.get('/medicines/search', { params: { q: query } });
      const data = response.data?.data || response.data;
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Get specific medicine details from catalogue
   */
  async getMedicineById(id: string): Promise<MedicineCatalogueItem | null> {
    if (!id.trim()) return null;

    if (isMockApiEnabled()) {
      const found = getStoredCatalogue().find((item) => item.id === id && item.active);
      if (!found) return null;
      return {
        id: found.id,
        name: found.name,
        genericName: found.genericName,
        strength: found.strength,
        form: found.form,
        manufacturer: found.manufacturer,
        description: found.description,
        prescriptionRequired: found.prescriptionRequired,
        isCatalogueVerified: true,
      };
    }

    try {
      const response = await api.get(`/medicines/${id}`);
      const data = response.data?.data || response.data;
      return data || null;
    } catch {
      return null;
    }
  },
};
