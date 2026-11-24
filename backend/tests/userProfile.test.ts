// backend/tests/userProfile.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { User } from '../src/models/User';
import { signToken } from '../src/utils/jwt';
import bcrypt from 'bcrypt';

describe('Phase 4: Customer Profile & Security Invariants', () => {
  const customerId = '654321654321654321654321';
  const customerToken = signToken({
    userId: customerId,
    email: 'customer@medifind.com',
    role: 'customer',
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/v1/users/me returns 401 without bearer token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/users/me returns sanitized profile without passwordHash', async () => {
    const mockUser = {
      _id: customerId,
      email: 'customer@medifind.com',
      name: 'John Doe',
      phone: '+8801700000000',
      role: 'customer',
      status: 'active',
      createdAt: new Date(),
    };

    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    } as any);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('customer@medifind.com');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('PATCH /api/v1/users/me rejects attempts to escalate role with 403', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/users/change-password validates current password', async () => {
    const mockUser = {
      _id: customerId,
      passwordHash: await bcrypt.hash('correctOldPassword', 10),
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

    const resWrong = await request(app)
      .post('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        currentPassword: 'wrongPassword',
        newPassword: 'BrandNewPassword123!',
      });

    expect(resWrong.status).toBe(400);
    expect(resWrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const resSuccess = await request(app)
      .post('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        currentPassword: 'correctOldPassword',
        newPassword: 'BrandNewPassword123!',
      });

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.success).toBe(true);
  });
});
