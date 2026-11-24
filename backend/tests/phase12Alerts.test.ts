import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { AlertSubscription } from '../src/models/AlertSubscription';
import { Medicine } from '../src/models/Medicine';
import { signToken } from '../src/utils/jwt';

describe('Phase 12: Restock Alert Subscription Service', () => {
  const customerId = new mongoose.Types.ObjectId().toString();
  const medicineId = new mongoose.Types.ObjectId().toString();
  const token = signToken({ userId: customerId, email: 'subscriber@test.com', role: 'customer' });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects unauthenticated requests to subscribe with 401', async () => {
    const res = await request(app).post('/api/v1/subscriptions').send({
      medicineId,
      contactMethod: 'email',
      contactValue: 'subscriber@test.com',
      searchArea: 'Dhanmondi',
    });
    expect(res.status).toBe(401);
  });

  it('rejects duplicate active subscription for identical medicine with 409', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId, brandName: 'Napa', strength: '500 mg' } as any);
    jest.spyOn(AlertSubscription, 'findOne').mockResolvedValue({ _id: 'sub123', active: true } as any);

    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', 'Bearer ' + token)
      .send({
        medicineId,
        contactMethod: 'email',
        contactValue: 'subscriber@test.com',
        searchArea: 'Dhanmondi',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SUBSCRIPTION');
  });

  it('successfully registers new restock alert subscription', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue({ _id: medicineId, brandName: 'Napa', strength: '500 mg' } as any);
    jest.spyOn(AlertSubscription, 'findOne').mockResolvedValue(null);
    jest.spyOn(AlertSubscription.prototype, 'save').mockImplementation(function (this: any) {
      this._id = new mongoose.Types.ObjectId();
      return Promise.resolve(this);
    });

    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', 'Bearer ' + token)
      .send({
        medicineId,
        contactMethod: 'email',
        contactValue: 'subscriber@test.com',
        searchArea: 'Dhanmondi',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.contactValue).toBe('subscriber@test.com');
  });

  it('allows customer to cancel their active subscription', async () => {
    const subId = new mongoose.Types.ObjectId().toString();
    const mockSub = { _id: subId, customerId, active: true, save: jest.fn().mockResolvedValue(true) };
    jest.spyOn(AlertSubscription, 'findOne').mockResolvedValue(mockSub as any);

    const res = await request(app)
      .patch('/api/v1/subscriptions/' + subId + '/cancel')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSub.active).toBe(false);
  });
});