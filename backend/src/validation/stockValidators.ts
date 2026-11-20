// backend/src/validation/stockValidators.ts
import type { StockStatus } from '../types/pharmacy';
import type {
  AddInventoryMedicinePayload,
  ReconfirmStockPayload,
  UpdateInventoryMedicinePayload,
} from '../types/stock';
import { ValidationError } from './validationError';

export const VALID_STOCK_STATUSES: StockStatus[] = ['available', 'low', 'out', 'unverified'];
export const OWNER_WRITABLE_STATUSES: StockStatus[] = ['available', 'low', 'out'];

/**
 * Validates stock status enum. Ensures owners only submit owner-writable statuses.
 */
export function validateStockStatus(
  status: unknown,
  allowUnverified: boolean = false
): StockStatus {
  if (typeof status !== 'string') {
    throw new ValidationError('Status must be Available, Low, or Out of Stock.', {
      status: 'Select Available, Low, or Out of Stock.',
    }, 'INVALID_STATUS');
  }

  const normalized = status.trim().toLowerCase() as StockStatus;

  if (allowUnverified && normalized === 'unverified') {
    return 'unverified';
  }

  if (!OWNER_WRITABLE_STATUSES.includes(normalized)) {
    throw new ValidationError('Status must be Available, Low, or Out of Stock.', {
      status: 'Select Available, Low, or Out of Stock.',
    }, 'INVALID_STATUS');
  }

  return normalized;
}

/**
 * Validates optional non-negative integer quantity.
 */
export function validateQuantity(quantity: unknown): number | undefined {
  if (quantity === undefined || quantity === null || quantity === '') {
    return undefined;
  }

  const num = typeof quantity === 'number' ? quantity : Number(quantity);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    throw new ValidationError('Quantity must be a whole number of 0 or greater.', {
      quantity: 'Quantity must be a whole number of 0 or greater.',
    });
  }

  return num;
}

/**
 * Validates optional non-negative price.
 */
export function validatePrice(price: unknown): number | undefined {
  if (price === undefined || price === null || price === '') {
    return undefined;
  }

  const num = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError('Price must be 0 or greater.', {
      price: 'Price must be 0 or greater.',
    });
  }

  return num;
}

/**
 * Validates payload for POST /owner/inventory (adding catalogue medicine to pharmacy inventory).
 */
export function validateAddInventoryPayload(payload: unknown): AddInventoryMedicinePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Add inventory payload must be a non-null object.');
  }

  const data = payload as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const medicineId = typeof data.medicineId === 'string' ? data.medicineId.trim() : '';
  if (!medicineId) {
    fields.medicineId = 'Medicine identifier is required.';
  }

  let status: StockStatus = 'available';
  if (data.status !== undefined) {
    try {
      status = validateStockStatus(data.status, false);
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fields, err.fields);
      } else {
        fields.status = 'Status must be Available, Low, or Out of Stock.';
      }
    }
  }

  let quantity: number | undefined;
  if (data.quantity !== undefined && data.quantity !== null && data.quantity !== '') {
    try {
      quantity = validateQuantity(data.quantity);
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fields, err.fields);
      }
    }
  }

  let price: number | undefined;
  if (data.price !== undefined && data.price !== null && data.price !== '') {
    try {
      price = validatePrice(data.price);
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fields, err.fields);
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    let code = 'VALIDATION_ERROR';
    if (fields.medicineId) {
      code = 'MEDICINE_ID_REQUIRED';
    } else if (fields.status) {
      code = 'INVALID_STATUS';
    }
    const message = Object.values(fields)[0] || 'Please review the highlighted fields.';
    throw new ValidationError(message, fields, code);
  }

  return {
    medicineId,
    medicineName: typeof data.medicineName === 'string' ? data.medicineName.trim() : undefined,
    genericName: typeof data.genericName === 'string' ? data.genericName.trim() : undefined,
    strength: typeof data.strength === 'string' ? data.strength.trim() : undefined,
    form: typeof data.form === 'string' ? data.form.trim() : undefined,
    manufacturer: typeof data.manufacturer === 'string' ? data.manufacturer.trim() : undefined,
    prescriptionRequired:
      typeof data.prescriptionRequired === 'boolean' ? data.prescriptionRequired : undefined,
    status,
    quantity,
    price,
    notes: typeof data.notes === 'string' ? data.notes.trim() : undefined,
  };
}

/**
 * Validates payload for PATCH /owner/inventory/:stockId.
 */
export function validateUpdateInventoryPayload(payload: unknown): UpdateInventoryMedicinePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Update payload must be a non-null object.');
  }

  const data = payload as Record<string, unknown>;
  const fields: Record<string, string> = {};

  let status: StockStatus | undefined;
  if (data.status !== undefined) {
    try {
      status = validateStockStatus(data.status, false);
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fields, err.fields);
      }
    }
  }

  let quantity: number | null | undefined;
  if (data.quantity !== undefined) {
    if (data.quantity === null) {
      quantity = null;
    } else {
      try {
        quantity = validateQuantity(data.quantity);
      } catch (err) {
        if (err instanceof ValidationError) {
          Object.assign(fields, err.fields);
        }
      }
    }
  }

  let price: number | null | undefined;
  if (data.price !== undefined) {
    if (data.price === null) {
      price = null;
    } else {
      try {
        price = validatePrice(data.price);
      } catch (err) {
        if (err instanceof ValidationError) {
          Object.assign(fields, err.fields);
        }
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    const message = Object.values(fields)[0] || 'Please review the highlighted fields.';
    throw new ValidationError(message, fields);
  }

  return {
    status,
    quantity,
    price,
    notes: typeof data.notes === 'string' ? data.notes.trim() : undefined,
  };
}

/**
 * Validates payload for POST /owner/inventory/:stockId/reconfirm.
 */
export function validateReconfirmStockPayload(payload: unknown): ReconfirmStockPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const data = payload as Record<string, unknown>;
  const fields: Record<string, string> = {};

  let status: 'available' | 'low' | 'out' | undefined;
  if (data.status !== undefined) {
    try {
      status = validateStockStatus(data.status, false) as 'available' | 'low' | 'out';
    } catch (err) {
      if (err instanceof ValidationError) {
        Object.assign(fields, err.fields);
      }
    }
  }

  let quantity: number | null | undefined;
  if (data.quantity !== undefined) {
    if (data.quantity === null) {
      quantity = null;
    } else {
      try {
        quantity = validateQuantity(data.quantity);
      } catch (err) {
        if (err instanceof ValidationError) {
          Object.assign(fields, err.fields);
        }
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    const message = Object.values(fields)[0] || 'Please review the highlighted fields.';
    throw new ValidationError(message, fields);
  }

  return {
    status,
    quantity,
  };
}
