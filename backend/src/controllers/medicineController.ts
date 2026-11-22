// backend/src/controllers/medicineController.ts
import { Request, Response, NextFunction } from 'express';
import { medicineService } from '../services/medicineService';

export const searchMedicines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query, strength, form, limit } = req.query;

    const results = await medicineService.searchMedicines({
      query: typeof query === 'string' ? query : undefined,
      strength: typeof strength === 'string' ? strength : undefined,
      dosageForm: typeof form === 'string' ? form : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    // SRS Requirement: Explicit disclaimer on all public medicine discovery endpoints
    res.setHeader(
      'X-Medical-Disclaimer',
      'MediFind provides medicine stock availability information only and does not offer medical advice, diagnosis, or treatment recommendations.'
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      disclaimer:
        'Informational medicine catalogue only. Always consult a licensed healthcare professional or verified pharmacist before purchasing or consuming medication.',
    });
  } catch (err) {
    next(err);
  }
};

export const getMedicineDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await medicineService.getMedicineById(id);

    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MEDICINE_NOT_FOUND',
          message: 'Active curated medicine not found in catalogue.',
        },
      });
      return;
    }

    res.setHeader(
      'X-Medical-Disclaimer',
      'MediFind provides medicine stock availability information only and does not offer medical advice, diagnosis, or treatment recommendations.'
    );

    res.status(200).json({
      success: true,
      data: {
        medicine: result.medicine,
        sameGenericAlternatives: result.sameGenericAlternatives,
      },
      disclaimer:
        'Informational medicine catalogue only. Always consult a licensed healthcare professional or verified pharmacist before purchasing or consuming medication.',
    });
  } catch (err) {
    next(err);
  }
};
