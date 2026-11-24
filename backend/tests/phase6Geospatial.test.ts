// backend/tests/phase6Geospatial.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';

describe('Phase 6: Geospatial Availability & Verified Pharmacy Query', () => {
  const medicineId = new mongoose.Types.ObjectId().toString();
  const verifiedPharmacyId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects missing medicineId query parameter with 400', async () => {
    const res = await request(app).get('/api/v1/availability');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns only verified pharmacies in geospatial discovery', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      brandName: 'Napa',
      genericName: 'Paracetamol',
      strength: '500 mg',
      active: true,
    } as any);

    const mockVerifiedPharm = {
      _id: verifiedPharmacyId,
      name: 'Green Cross Pharmacy',
      licenseNumber: 'LIC-1001',
      address: '14 Lake Road, Dhanmondi',
      area: 'Dhanmondi',
      phone: '+8801711000001',
      location: {
        type: 'Point',
        coordinates: [90.3742, 23.7461], // [lng, lat]
      },
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    };

    const mockPharmacyFind = jest.spyOn(Pharmacy, 'find').mockResolvedValue([mockVerifiedPharm] as any);
    jest.spyOn(Stock, 'find').mockResolvedValue([
      {
        pharmacyId: verifiedPharmacyId,
        medicineId,
        stockStatus: 'available',
        quantity: 15,
        price: 10,
        updatedAt: new Date(),
      },
    ] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&lat=23.7461&lng=90.3742&radiusKm=10`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Verified filter invariant check
    expect(mockPharmacyFind).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationStatus: 'Verified',
      })
    );
    expect(res.body.data.results.length).toBe(1);
    expect(res.body.data.results[0].pharmacyName).toBe('Green Cross Pharmacy');
    expect(res.body.data.results[0].isVerified).toBe(true);
  });

  it('falls back to manual area centroid when GPS coordinates are omitted', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      active: true,
    } as any);

    jest.spyOn(Pharmacy, 'find').mockResolvedValue([] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&area=Dhanmondi`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.origin.source).toBe('area_centroid');
    expect(res.body.data.origin.lat).toBeCloseTo(23.7461, 3);
  });
});
