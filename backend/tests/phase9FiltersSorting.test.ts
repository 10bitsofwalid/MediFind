// backend/tests/phase9FiltersSorting.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';

describe('Phase 9: Multi-parameter Search Filters, Radius Thresholds & Sorting', () => {
  const medicineId = new mongoose.Types.ObjectId().toString();
  const pharm1Id = new mongoose.Types.ObjectId().toString();
  const pharm2Id = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('filters results by availability status (e.g. available only)', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      active: true,
    } as any);

    const p1 = {
      _id: pharm1Id,
      name: 'Pharm Available',
      address: 'Dhanmondi',
      area: 'Dhanmondi',
      phone: '111',
      location: { type: 'Point', coordinates: [90.3742, 23.7461] },
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    };

    const p2 = {
      _id: pharm2Id,
      name: 'Pharm Out',
      address: 'Dhanmondi',
      area: 'Dhanmondi',
      phone: '222',
      location: { type: 'Point', coordinates: [90.375, 23.747] },
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    };

    jest.spyOn(Pharmacy, 'find').mockResolvedValue([p1, p2] as any);

    jest.spyOn(Stock, 'find').mockResolvedValue([
      { pharmacyId: pharm1Id, medicineId, stockStatus: 'available', quantity: 10, updatedAt: new Date() },
      { pharmacyId: pharm2Id, medicineId, stockStatus: 'out', quantity: 0, updatedAt: new Date() },
    ] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&area=Dhanmondi&availability=available`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBe(1);
    expect(res.body.data.results[0].pharmacyName).toBe('Pharm Available');
    expect(res.body.data.results[0].stockStatus).toBe('available');
  });

  it('sorts results by distance (closest first by default)', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      active: true,
    } as any);

    // Origin is at 23.7461, 90.3742 (Dhanmondi centroid)
    const pFar = {
      _id: pharm1Id,
      name: 'Pharm Far',
      address: 'Gulshan',
      area: 'Gulshan',
      phone: '111',
      location: { type: 'Point', coordinates: [90.4078, 23.7925] }, // ~6.3 km
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    };

    const pNear = {
      _id: pharm2Id,
      name: 'Pharm Near',
      address: 'Dhanmondi Lake',
      area: 'Dhanmondi',
      phone: '222',
      location: { type: 'Point', coordinates: [90.375, 23.7465] }, // ~0.1 km
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    };

    // Return in reverse order from DB
    jest.spyOn(Pharmacy, 'find').mockResolvedValue([pFar, pNear] as any);
    jest.spyOn(Stock, 'find').mockResolvedValue([] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&area=Dhanmondi&sortBy=distance`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBe(2);
    expect(res.body.data.results[0].pharmacyName).toBe('Pharm Near');
    expect(res.body.data.results[1].pharmacyName).toBe('Pharm Far');
  });
});
