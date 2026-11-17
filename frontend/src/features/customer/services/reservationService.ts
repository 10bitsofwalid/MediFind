// frontend/src/features/customer/services/reservationService.ts
// Customer reservation management service for medicine pickup holds

export interface CreateReservationPayload {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  strength?: string;
  quantity: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'expired';

export interface ReservationRecord extends CreateReservationPayload {
  id: string;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string; // Typically 2 hours from creation for Dhaka pharmacy holds
  pickupCode: string; // 4-digit code to present at pharmacy counter
}

const STORAGE_KEY = 'medifind_customer_reservations';

export const reservationService = {
  /**
   * Submit a new customer medicine hold reservation
   */
  async createReservation(payload: CreateReservationPayload): Promise<ReservationRecord> {
    if (!payload.pharmacyId) {
      throw new Error('Pharmacy ID is required to create a reservation.');
    }
    if (!payload.medicineName) {
      throw new Error('Medicine name is required to create a reservation.');
    }
    if (!payload.quantity || payload.quantity < 1) {
      throw new Error('Reservation quantity must be at least 1.');
    }

    const now = new Date();
    // Default expiration is 2 hours from creation
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

    const record: ReservationRecord = {
      ...payload,
      id: `resv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt,
      pickupCode,
    };

    try {
      const existing = this.getStoredReservations();
      existing.unshift(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      // Also dispatch a browser custom event so other components can react
      window.dispatchEvent(new CustomEvent('medifind:reservation_created', { detail: record }));
    } catch (e) {
      console.warn('Unable to persist reservation to storage:', e);
    }

    return record;
  },

  /**
   * Get all reservations for the current customer session
   */
  getStoredReservations(): ReservationRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Cancel an active reservation
   */
  async cancelReservation(reservationId: string, reason?: string): Promise<ReservationRecord> {
    const list = this.getStoredReservations();
    const target = list.find((r) => r.id === reservationId);

    if (!target) {
      throw new Error(`Reservation ${reservationId} not found.`);
    }

    if (target.status === 'completed' || target.status === 'cancelled') {
      throw new Error(`Reservation is already ${target.status}.`);
    }

    target.status = 'cancelled';
    if (reason) {
      target.notes = target.notes ? `${target.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('medifind:reservation_updated', { detail: target }));
    return target;
  },

  /**
   * Helper to check if a reservation has expired
   */
  isExpired(reservation: ReservationRecord): boolean {
    if (reservation.status === 'completed' || reservation.status === 'cancelled') {
      return false;
    }
    return new Date(reservation.expiresAt).getTime() < Date.now();
  },

  /**
   * Clear all reservations (for tests and teardown)
   */
  clearReservations(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
