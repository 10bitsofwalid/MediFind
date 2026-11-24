import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';
import { Reservation } from '../src/models/Reservation';
import { signToken } from '../src/utils/jwt';

describe('Phase 14: Comprehensive Concurrency & Invariant Regression Suite', () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const pharmacyId = new mongoose.Types.ObjectId().toString();
  const medicineId = new mongoose.Types.ObjectId().toString();
  const token = signToken({ userId: customerId, email: 'concurrency@test.com', role: 'customer' });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('prevents concurrent reservation race conditions beyond maximum active holds limit', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue({ _id: pharmacyId, verificationStatus: 'Verified' } as any);
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId, active: true } as any);
    jest.spyOn(Stock, 'findOne').mockResolvedValue({ pharmacyId, medicineId, stockStatus: 'available', quantity: 10 } as any);

    let activeHoldsInDb = 0;
    jest.spyOn(Reservation, 'countDocuments').mockImplementation((() => Promise.resolve(activeHoldsInDb)) as any);
    jest.spyOn(Reservation.prototype, 'save').mockImplementation(function(this: any) {
      activeHoldsInDb++;
      return Promise.resolve(this);
    });

    const req1 = await request(app).post('/api/v1/reservations').set('Authorization', 'Bearer ' + token).send({ pharmacyId, medicineId, quantity: 1 });
    const req2 = await request(app).post('/api/v1/reservations').set('Authorization', 'Bearer ' + token).send({ pharmacyId, medicineId, quantity: 1 });
    const req3 = await request(app).post('/api/v1/reservations').set('Authorization', 'Bearer ' + token).send({ pharmacyId, medicineId, quantity: 1 });

    expect(req1.status).toBe(201);
    expect(req2.status).toBe(201);
    expect(req3.status).toBe(429);
    expect(req3.body.error.code).toBe('LIMIT_EXCEEDED');
  });

  it('discovery query rejects unverified pharmacies under all conditions', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId, active: true } as any);
    const unverifiedPharm = {
      _id: pharmacyId,
      name: 'Shady Pharmacy',
      verificationStatus: 'Pending',
      location: { type: 'Point', coordinates: [90.3742, 23.7461] },
    };
    jest.spyOn(Pharmacy, 'find').mockResolvedValue([] as any);

    const res = await request(app).get('/api/v1/availability?medicineId=' + medicineId + '&lat=23.7461&lng=90.3742');
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(0);
  });
});