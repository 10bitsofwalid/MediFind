import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Medicine } from '../src/models/Medicine';
import { Pharmacy } from '../src/models/Pharmacy';
import { Stock } from '../src/models/Stock';

describe('Phase 15: Frontend Integration Contract & Seed Verification', () => {
  const medId = new mongoose.Types.ObjectId().toString();
  const pharmId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('full discovery flow matches frontend CustomerMapView and SearchResultsList schemas', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medId,
      brandName: 'Napa',
      genericName: 'Paracetamol',
      strength: '500 mg',
      active: true,
    } as any);

    jest.spyOn(Pharmacy, 'find').mockResolvedValue([
      {
        _id: pharmId,
        name: 'Green Cross Pharmacy',
        licenseNumber: 'LIC-DHK-001',
        address: '14 Lake Road, Dhanmondi, Dhaka',
        area: 'Dhanmondi',
        phone: '+8801711000001',
        location: { type: 'Point', coordinates: [90.3742, 23.7461] },
        verificationStatus: 'Verified',
        operatingHours: {},
        updatedAt: new Date(),
      },
    ] as any);

    jest.spyOn(Stock, 'find').mockResolvedValue([
      {
        pharmacyId: pharmId,
        medicineId: medId,
        stockStatus: 'available',
        quantity: 12,
        price: 1.2,
        updatedAt: new Date(),
      },
    ] as any);

    const res = await request(app).get(
      '/api/v1/availability?medicineId=' + medId + '&area=Dhanmondi'
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const pharmacyResult = res.body.data.results[0];
    // Verifying direct parity with frontend NearbyPharmacyResult interface
    expect(pharmacyResult).toHaveProperty('pharmacyId');
    expect(pharmacyResult).toHaveProperty('pharmacyName', 'Green Cross Pharmacy');
    expect(pharmacyResult).toHaveProperty('isVerified', true);
    expect(pharmacyResult).toHaveProperty('latitude', 23.7461);
    expect(pharmacyResult).toHaveProperty('longitude', 90.3742);
    expect(pharmacyResult).toHaveProperty('stockStatus', 'available');
    expect(pharmacyResult).toHaveProperty('quantity', 12);
    expect(pharmacyResult).toHaveProperty('isStale', false);
  });
});