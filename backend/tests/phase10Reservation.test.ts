// backend/tests/phase10Reservation.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Reservation } from '../src/models/Reservation';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';
import { signToken } from '../src/utils/jwt';

describe('Phase 10: Medicine Reservation Hold Service (P1 Gate)', () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const pharmacyId = new mongoose.Types.ObjectId().toString();
  const medicineId = new mongoose.Types.ObjectId().toString();
  const customerToken = signToken({
    userId: customerId,
    email: 'patient@example.com',
    role: 'customer',
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects unauthenticated reservation requests with 401', async () => {
    const res = await request(app).post('/api/v1/reservations').send({
      pharmacyId,
      medicineId,
      quantity: 1,
    });
    expect(res.status).toBe(401);
  });

  it('rejects reservation if pharmacy is unverified with 400', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        pharmacyId,
        medicineId,
        quantity: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('verified pharmacies');
  });

  it('rejects reservation exceeding 2 active customer holds with 429', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue({ _id: pharmacyId } as any);
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId } as any);
    jest.spyOn(Reservation, 'countDocuments').mockResolvedValue(2);

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        pharmacyId,
        medicineId,
        quantity: 1,
      });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('LIMIT_EXCEEDED');
  });

  it('successfully creates 2-hour reservation with 4-digit pickup code', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue({ _id: pharmacyId, verificationStatus: 'Verified' } as any);
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId, active: true } as any);
    jest.spyOn(Reservation, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Stock, 'findOne').mockResolvedValue({
      pharmacyId,
      medicineId,
      stockStatus: 'available',
      quantity: 10,
    } as any);

    jest.spyOn(Reservation.prototype, 'save').mockImplementation(function (this: any) {
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        pharmacyId,
        medicineId,
        quantity: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pickupCode).toHaveLength(4);
    expect(res.body.data.status).toBe('active');
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('allows customer to safely cancel active reservation with audit reason', async () => {
    const reservationId = new mongoose.Types.ObjectId().toString();
    const mockReservation = {
      _id: reservationId,
      customerId,
      status: 'active',
      save: jest.fn().mockResolvedValue(true),
    };

    jest.spyOn(Reservation, 'findOne').mockResolvedValue(mockReservation as any);

    const res = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Found medicine closer to home' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockReservation.status).toBe('cancelled');
  });
});
