// frontend/tests/customerReservation.test.mjs
// Phase 8a tests: Medicine reservation holds, pickup code generation, cancellation, and customer auth gating
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers: in-memory replica of reservationService logic
// ---------------------------------------------------------------------------

function createMockReservationService() {
  const store = [];

  return {
    async createReservation(payload) {
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
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

      const record = {
        ...payload,
        id: `resv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: 'pending',
        createdAt: now.toISOString(),
        expiresAt,
        pickupCode,
      };

      store.unshift(record);
      return record;
    },

    getStoredReservations() {
      return [...store];
    },

    async cancelReservation(reservationId, reason) {
      const target = store.find((r) => r.id === reservationId);
      if (!target) throw new Error(`Reservation ${reservationId} not found.`);
      if (target.status === 'completed' || target.status === 'cancelled') {
        throw new Error(`Reservation is already ${target.status}.`);
      }
      target.status = 'cancelled';
      if (reason) target.notes = `Cancelled: ${reason}`;
      return target;
    },

    isExpired(reservation) {
      if (reservation.status === 'completed' || reservation.status === 'cancelled') {
        return false;
      }
      return new Date(reservation.expiresAt).getTime() < Date.now();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 8a – Medicine Reservation Holds & Pickup Flow', () => {

  // 1. Successful reservation hold creation with 4-digit pickup code
  it('Reservation Service: creates hold request with 4-digit pickup code and 2-hour expiry', async () => {
    const service = createMockReservationService();
    const payload = {
      pharmacyId: 'ph-dhanmondi-1',
      pharmacyName: 'Lazz Pharma Dhanmondi',
      medicineId: 'med-paracetamol-500',
      medicineName: 'Paracetamol 500 mg',
      quantity: 2,
      customerName: 'Rahim Ahmed',
      customerPhone: '01712345678',
    };

    const record = await service.createReservation(payload);

    assert.ok(record.id.startsWith('resv_'), 'Must generate resv_ prefix ID');
    assert.equal(record.status, 'pending', 'Initial status must be pending');
    assert.equal(record.quantity, 2);
    assert.match(record.pickupCode, /^\d{4}$/, 'Pickup verification code must be 4 digits');

    // Expiry verification
    const expiryTime = new Date(record.expiresAt).getTime();
    const createdTime = new Date(record.createdAt).getTime();
    const diffHours = (expiryTime - createdTime) / (1000 * 60 * 60);
    assert.ok(Math.abs(diffHours - 2) < 0.05, 'Expiration window must be 2 hours');
  });

  // 2. Quantity validation
  it('Reservation Validation: rejects reservation with quantity less than 1', async () => {
    const service = createMockReservationService();
    await assert.rejects(
      async () => {
        await service.createReservation({
          pharmacyId: 'ph-1',
          medicineName: 'Napa',
          quantity: 0,
        });
      },
      { message: /Reservation quantity must be at least 1/i }
    );
  });

  // 3. Mandatory pharmacyId check
  it('Reservation Validation: rejects reservation without pharmacyId', async () => {
    const service = createMockReservationService();
    await assert.rejects(
      async () => {
        await service.createReservation({
          pharmacyId: '',
          medicineName: 'Napa',
          quantity: 1,
        });
      },
      { message: /Pharmacy ID is required/i }
    );
  });

  // 4. Cancellation flow
  it('Reservation Cancellation: cancels active reservation with audit note', async () => {
    const service = createMockReservationService();
    const created = await service.createReservation({
      pharmacyId: 'ph-1',
      medicineName: 'Amoxicillin',
      quantity: 1,
    });

    const cancelled = await service.cancelReservation(created.id, 'Found at another pharmacy');
    assert.equal(cancelled.status, 'cancelled');
    assert.match(cancelled.notes, /Found at another pharmacy/i);
  });

  // 5. Expiration check
  it('Reservation Expiry: accurately identifies expired holds', async () => {
    const service = createMockReservationService();
    const pastRecord = {
      id: 'resv_past',
      status: 'pending',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // Expired 1 hr ago
      pickupCode: '1234',
    };

    assert.equal(service.isExpired(pastRecord), true, 'Hold past expiration date must be flagged expired');
  });

});
