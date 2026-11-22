// backend/src/services/medicineService.ts
import { Medicine, IMedicine } from '../models/Medicine';

export interface MedicineQueryFilters {
  query?: string;
  strength?: string;
  dosageForm?: string;
  limit?: number;
}

export class MedicineCatalogueService {
  /**
   * Deterministic search matching tokens across brandName and genericName
   * Only active curated catalogue items are returned.
   */
  async searchMedicines(filters: MedicineQueryFilters): Promise<IMedicine[]> {
    const filterObj: Record<string, any> = { active: true };

    if (filters.strength) {
      filterObj.strength = new RegExp(filters.strength.trim(), 'i');
    }

    if (filters.dosageForm) {
      filterObj.dosageForm = new RegExp(filters.dosageForm.trim(), 'i');
    }

    if (filters.query && filters.query.trim()) {
      const tokens = filters.query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      // Deterministic multi-token matching: each token must match either brandName or genericName
      const tokenConditions = tokens.map((token) => ({
        $or: [
          { brandName: { $regex: token, $options: 'i' } },
          { genericName: { $regex: token, $options: 'i' } },
          { strength: { $regex: token, $options: 'i' } },
        ],
      }));

      filterObj.$and = tokenConditions;
    }

    const limit = Math.min(filters.limit || 50, 100);
    return Medicine.find(filterObj).limit(limit).sort({ brandName: 1 });
  }

  /**
   * Get medicine detail by ID with curated generic equivalents (informational only)
   */
  async getMedicineById(id: string): Promise<{
    medicine: IMedicine;
    sameGenericAlternatives: IMedicine[];
  } | null> {
    const medicine = await Medicine.findOne({ _id: id, active: true });
    if (!medicine) return null;

    // Retrieve other brands with identical genericName (informational only, not medical substitution advice)
    const alternatives = await Medicine.find({
      genericName: medicine.genericName,
      _id: { $ne: medicine._id },
      active: true,
    })
      .limit(6)
      .sort({ brandName: 1 });

    return {
      medicine,
      sameGenericAlternatives: alternatives,
    };
  }
}

export const medicineService = new MedicineCatalogueService();
