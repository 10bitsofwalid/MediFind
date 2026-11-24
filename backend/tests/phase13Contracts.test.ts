import request from 'supertest';
import { app } from '../src/app';
import fs from 'fs';
import path from 'path';

describe('Phase 13: End-to-End API Contracts, OpenAPI Specification & Rate Limiting', () => {
  it('OpenAPI 3.0 specification file exists and defines all customer endpoints', () => {
    const specPath = path.resolve(__dirname, '../../docs/api/openapi-customer.yaml');
    expect(fs.existsSync(specPath)).toBe(true);
    const content = fs.readFileSync(specPath, 'utf8');
    expect(content).toContain('/auth/register');
    expect(content).toContain('/availability');
    expect(content).toContain('/reservations');
    expect(content).toContain('/subscriptions');
  });

  it('standard JSON error envelope returned on bad request', async () => {
    const res = await request(app).get('/api/v1/availability');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});