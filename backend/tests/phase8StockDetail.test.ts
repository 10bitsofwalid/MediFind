// backend/tests/phase8StockDetail.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { Pharmacy } from '../src/models/Pharmacy';
import { Medicine } from '../src/models/Medicine';
import { Stock } from '../src/models/Stock';

describe('Phase 8: Detailed Pharmacy & Medicine Stock Endpoint', () => {
  const pharmacyId = new mongoose.Types.ObjectId().toString();
  const medicineId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 for invalid mongo ObjectId in path params', async () => {
    const res = await request(app).get(
      '/api/v1/availability/pharmacies/invalidId/medicines/invalidMedId/stock'
    );
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 if pharmacy is not verified or does not exist', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue(null);

    const res = await request(app).get(
      `/api/v1/availability/pharmacies/${pharmacyId}/medicines/${medicineId}/stock`
    );
    expect(res.status).toBe(404);
  });

  it('returns comprehensive pharmacy card with phone, hours and stock details', async () => {
    jest.spyOn(Pharmacy, 'findOne').mockResolvedValue({
      _id: pharmacyId,
      name: 'CityWell Pharmacy',
      licenseNumber: 'LIC-2002',
      address: 'Plot 12, Mirpur Road',
      area: 'Dhanmondi',
      phone: '+8801711223344',
      location: { type: 'Point', coordinates: [90.3742, 23.7461] },
      verificationStatus: 'Verified',
      operatingHours: {},
      updatedAt: new Date(),
    } as any);

    jest.spyOn(Medicine, 'findOne').mockResolvedValue({
      _id: medicineId,
      brandName: 'Napa Extra',
      genericName: 'Paracetamol + Caffeine',
      strength: '500 mg + 65 mg',
      dosageForm: 'Tablet',
      active: true,
    } as any);

    jest.spyOn(Stock, 'findOne').mockResolvedValue({
      pharmacyId,
      medicineId,
      stockStatus: 'available',
      quantity: 50,
      price: 3.5,
      updatedAt: new Date(),
    } as any);

    const res = await request(app).get(
      `/api/v1/availability/pharmacies/${pharmacyId}/medicines/${medicineId}/stock`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pharmacy.name).toBe('CityWell Pharmacy');
    expect(res.body.data.pharmacy.phone).toBe('+8801711223344');
    expect(res.body.data.stock.status).toBe('available');
    expect(res.body.data.stock.quantity).toBe(50);
    expect(res.body.data.stock.price).toBe(3.5);
  });
});
