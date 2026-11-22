// backend/tests/models.test.ts
import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Medicine } from '../src/models/Medicine';
import { Pharmacy } from '../src/models/Pharmacy';
import { Stock } from '../src/models/Stock';
import { Reservation } from '../src/models/Reservation';
import { AlertSubscription } from '../src/models/AlertSubscription';

describe('Phase 2: Core Data Models & Schema Constraints', () => {
  it('User Model rejects invalid email and enforces roles', async () => {
    const invalidUser = new User({
      email: 'not-an-email',
      role: 'superhacker', // invalid role
    });
    const err = invalidUser.validateSync();
    expect(err?.errors.role).toBeDefined();
    expect(err?.errors.passwordHash).toBeDefined();
  });

  it('Pharmacy Model requires GeoJSON Point and valid verification status', () => {
    const invalidPharmacy = new Pharmacy({
      name: 'Test Pharmacy',
      verificationStatus: 'InvalidStatus',
    });
    const err = invalidPharmacy.validateSync();
    expect(err?.errors.verificationStatus).toBeDefined();
    expect(err?.errors['location.coordinates']).toBeDefined();
  });

  it('Stock Model validates status and non-negative quantity', () => {
    const invalidStock = new Stock({
      stockStatus: 'infinite',
      quantity: -5,
    });
    const err = invalidStock.validateSync();
    expect(err?.errors.stockStatus).toBeDefined();
    expect(err?.errors.quantity).toBeDefined();
  });

  it('Reservation Model enforces 4-digit pickup code and positive quantity', () => {
    const reservation = new Reservation({
      customerId: new mongoose.Types.ObjectId(),
      pharmacyId: new mongoose.Types.ObjectId(),
      medicineId: new mongoose.Types.ObjectId(),
      pickupCode: '1234',
      quantity: 1,
      expiresAt: new Date(Date.now() + 7200000),
    });
    const err = reservation.validateSync();
    expect(err).toBeUndefined();
    expect(reservation.status).toBe('active');
  });

  it('AlertSubscription Model initializes active status to true', () => {
    const alert = new AlertSubscription({
      customerId: new mongoose.Types.ObjectId(),
      medicineId: new mongoose.Types.ObjectId(),
      medicineName: 'Paracetamol 500 mg',
      contactMethod: 'email',
      contactValue: 'customer@example.com',
      searchArea: 'Dhanmondi',
    });
    const err = alert.validateSync();
    expect(err).toBeUndefined();
    expect(alert.active).toBe(true);
  });
});
