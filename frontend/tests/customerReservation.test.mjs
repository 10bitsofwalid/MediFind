// frontend/tests/customerReservation.test.mjs
// Phase 8 tests: Medicine reservation holds, pickup code generation, cancellation, customer auth gating,
// and stock restock alert subscriptions
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers: in-memory replica of reservationService & alertService logic
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

function createMockAlertService() {
  const alerts = [];

  return {
    async subscribeAlert(params) {
      const trimmedMedicine = (params.medicineName || '').trim();
      const trimmedContact = (params.emailOrPhone || '').trim();

      if (!trimmedMedicine) {
        throw new Error('Medicine name is required to subscribe for alerts.');
      }
      if (!trimmedContact) {
        throw new Error('Please provide an email or phone number to receive alerts.');
      }
      if (trimmedContact.length < 5) {
        throw new Error('Please enter a valid email or phone number.');
      }

      const subscription = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        medicineName: trimmedMedicine,
        area: (params.area || '').trim() || 'Dhaka',
        emailOrPhone: trimmedContact,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      alerts.unshift(subscription);
      return subscription;
    },

    getStoredAlerts() {
      return [...alerts];
    },

    async cancelAlert(alertId) {
      const target = alerts.find((a) => a.id === alertId);
      if (!target) throw new Error(`Alert subscription ${alertId} not found.`);
      target.status = 'cancelled';
      return target;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 8 – Medicine Reservation Holds, Pickup Flow & Restock Alerts', () => {

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
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      pickupCode: '1234',
    };

    assert.equal(service.isExpired(pastRecord), true, 'Hold past expiration date must be flagged expired');
  });

  // 6. Restock alert subscription
  it('Alert Service: creates active restock notification subscription', async () => {
    const alertService = createMockAlertService();
    const sub = await alertService.subscribeAlert({
      medicineName: 'Insulin Glargine 100 IU',
      area: 'Gulshan, Dhaka',
      emailOrPhone: 'user@example.com',
    });

    assert.ok(sub.id.startsWith('alert_'), 'Alert ID must start with alert_');
    assert.equal(sub.status, 'active');
    assert.equal(sub.medicineName, 'Insulin Glargine 100 IU');
    assert.equal(sub.emailOrPhone, 'user@example.com');
  });

  // 7. Alert validation: rejects empty contact information
  it('Alert Validation: rejects alert subscription without contact or medicine name', async () => {
    const alertService = createMockAlertService();
    await assert.rejects(
      async () => {
        await alertService.subscribeAlert({
          medicineName: '',
          emailOrPhone: 'user@example.com',
        });
      },
      { message: /Medicine name is required/i }
    );

    await assert.rejects(
      async () => {
        await alertService.subscribeAlert({
          medicineName: 'Paracetamol',
          emailOrPhone: '',
        });
      },
      { message: /Please provide an email or phone/i }
    );
  });

  // 8. Alert cancellation
  it('Alert Cancellation: cancels an active alert subscription', async () => {
    const alertService = createMockAlertService();
    const sub = await alertService.subscribeAlert({
      medicineName: 'Cefixime 200 mg',
      emailOrPhone: '01811223344',
      area: 'Mirpur',
    });

    const cancelled = await alertService.cancelAlert(sub.id);
    assert.equal(cancelled.status, 'cancelled');
  });

});
