// backend/tests/health.test.ts
import request from 'supertest';
import { app } from '../src/app';

describe('Phase 1: Backend Health & Readiness Endpoints', () => {
  it('GET /health returns 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('MediFind');
  });

  it('GET /ready returns 200 with uptime', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('GET /non-existent-route returns standard 404 envelope', async () => {
    const res = await request(app).get('/api/v1/unknown');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
