// backend/tests/auth.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { User } from '../src/models/User';
import { authService } from '../src/services/authService';
import bcrypt from 'bcrypt';

describe('Phase 3: Customer Authentication & Session Lifecycle', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects public registration for admin role with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'admin@medifind.com',
        password: 'Password123!',
        name: 'Hacker Admin',
        role: 'admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects registration with short password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer@medifind.com',
        password: '123',
        name: 'Customer One',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('successfully registers valid customer and returns JWT', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null as any);
    jest.spyOn(User.prototype, 'save').mockImplementation(function (this: any) {
      this._id = '654321654321654321654321';
      return Promise.resolve(this);
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'patient@example.com',
        password: 'SecurePassword123!',
        name: 'Sarah Connor',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user.email).toBe('patient@example.com');
  });

  it('rejects login for blocked user with 403', async () => {
    const mockBlockedUser = {
      _id: '654321654321654321654321',
      email: 'blocked@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      status: 'blocked',
      role: 'customer',
    };
    jest.spyOn(User, 'findOne').mockResolvedValue(mockBlockedUser as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'blocked@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED');
  });

  it('rejects login with wrong password with 401', async () => {
    const mockUser = {
      _id: '654321654321654321654321',
      email: 'valid@example.com',
      passwordHash: await bcrypt.hash('correctPassword', 10),
      status: 'active',
      role: 'customer',
    };
    jest.spyOn(User, 'findOne').mockResolvedValue(mockUser as any);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'valid@example.com',
        password: 'wrongPassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/logout returns 200 with success confirmation', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
