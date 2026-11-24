// backend/tests/medicineSearch.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { Medicine } from '../src/models/Medicine';

describe('Phase 5: Medicine Catalogue & Deterministic Search Engine', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/v1/medicines returns disclaimer header and body notice', async () => {
    jest.spyOn(Medicine, 'find').mockReturnValue({
      limit: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    } as any);

    const res = await request(app).get('/api/v1/medicines?query=Napa');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['x-medical-disclaimer']).toBeDefined();
    expect(res.body.disclaimer).toContain('Informational medicine catalogue only');
  });

  it('GET /api/v1/medicines filters by active curated medicines only', async () => {
    const mockFind = jest.spyOn(Medicine, 'find').mockReturnValue({
      limit: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: 'med1',
            brandName: 'Napa',
            genericName: 'Paracetamol',
            strength: '500 mg',
            active: true,
          },
        ]),
      }),
    } as any);

    const res = await request(app).get('/api/v1/medicines?query=Paracetamol 500');
    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
      })
    );
    expect(res.body.data[0].brandName).toBe('Napa');
  });

  it('GET /api/v1/medicines/:id returns 404 if medicine is inactive or missing', async () => {
    jest.spyOn(Medicine, 'findOne').mockResolvedValue(null);

    const res = await request(app).get('/api/v1/medicines/nonexistentId');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEDICINE_NOT_FOUND');
  });

  it('GET /api/v1/medicines/:id returns medicine with curated same-generic alternatives', async () => {
    const primaryMed = {
      _id: 'med123',
      brandName: 'Ace',
      genericName: 'Paracetamol',
      strength: '500 mg',
      active: true,
    };

    const altMed = {
      _id: 'med456',
      brandName: 'Napa',
      genericName: 'Paracetamol',
      strength: '500 mg',
      active: true,
    };

    jest.spyOn(Medicine, 'findOne').mockResolvedValue(primaryMed as any);
    jest.spyOn(Medicine, 'find').mockReturnValue({
      limit: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([altMed]),
      }),
    } as any);

    const res = await request(app).get('/api/v1/medicines/med123');
    expect(res.status).toBe(200);
    expect(res.body.data.medicine.brandName).toBe('Ace');
    expect(res.body.data.sameGenericAlternatives[0].brandName).toBe('Napa');
  });
});
