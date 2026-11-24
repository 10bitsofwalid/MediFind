// backend/tests/phase7Freshness.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';

describe('Phase 7: Freshness, Stale Stock & Operating Hours Engine', () => {
  const medicineId = new mongoose.Types.ObjectId().toString();
  const pharmacyId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('marks stock updated >= 24 hours ago as isStale: true', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      active: true,
    } as any);

    const oldTimestamp = new Date(Date.now() - 36 * 60 * 60 * 1000); // 36 hours ago

    jest.spyOn(Pharmacy, 'find').mockResolvedValue([
      {
        _id: pharmacyId,
        name: 'CarePoint Pharmacy',
        address: '28 Road 7A, Dhanmondi',
        area: 'Dhanmondi',
        phone: '+8801700000002',
        location: { type: 'Point', coordinates: [90.3742, 23.7461] },
        verificationStatus: 'Verified',
        operatingHours: {},
        updatedAt: oldTimestamp,
      },
    ] as any);

    jest.spyOn(Stock, 'find').mockResolvedValue([
      {
        pharmacyId,
        medicineId,
        stockStatus: 'available',
        quantity: 10,
        updatedAt: oldTimestamp,
      },
    ] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&area=Dhanmondi`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBe(1);
    expect(res.body.data.results[0].isStale).toBe(true);
  });

  it('marks stock updated recently (< 24 hours ago) as isStale: false', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      active: true,
    } as any);

    const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    jest.spyOn(Pharmacy, 'find').mockResolvedValue([
      {
        _id: pharmacyId,
        name: 'Fresh Pharmacy',
        address: '10 Mirpur Road',
        area: 'Dhanmondi',
        phone: '+8801700000003',
        location: { type: 'Point', coordinates: [90.3742, 23.7461] },
        verificationStatus: 'Verified',
        operatingHours: {},
        updatedAt: recentTimestamp,
      },
    ] as any);

    jest.spyOn(Stock, 'find').mockResolvedValue([
      {
        pharmacyId,
        medicineId,
        stockStatus: 'available',
        quantity: 25,
        updatedAt: recentTimestamp,
      },
    ] as any);

    const res = await request(app).get(
      `/api/v1/availability?medicineId=${medicineId}&area=Dhanmondi`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].isStale).toBe(false);
  });
});
