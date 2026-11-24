import mongoose from 'mongoose';
import { AlertSubscription, IAlertSubscription } from '../models/AlertSubscription';
import { Medicine } from '../models/Medicine';

export interface CreateSubscriptionDTO {
  customerId: string;
  medicineId: string;
  contactMethod: 'email' | 'phone';
  contactValue: string;
  searchArea: string;
}

export class AlertSubscriptionService {
  async createSubscription(data: CreateSubscriptionDTO): Promise<IAlertSubscription> {
    if (!mongoose.Types.ObjectId.isValid(data.medicineId)) {
      const err = new Error('Invalid medicine ID format.');
      (err as any).status = 400;
      throw err;
    }

    const medicine = await Medicine.findOne({ _id: data.medicineId, active: true });
    if (!medicine) {
      const err = new Error('Medicine not found in active catalogue.');
      (err as any).status = 404;
      throw err;
    }

    // Deduplication check: existing active subscription for this medicine and customer
    const existing = await AlertSubscription.findOne({
      customerId: data.customerId,
      medicineId: data.medicineId,
      active: true,
    });

    if (existing) {
      const err = new Error('You already have an active restock alert for this medicine.');
      (err as any).status = 409;
      throw err;
    }

    const sub = new AlertSubscription({
      customerId: data.customerId,
      medicineId: data.medicineId,
      medicineName: medicine.brandName + ' (' + medicine.strength + ')',
      contactMethod: data.contactMethod,
      contactValue: data.contactValue.trim(),
      searchArea: data.searchArea.trim(),
      active: true,
    });

    await sub.save();
    return sub;
  }

  async getCustomerSubscriptions(customerId: string): Promise<IAlertSubscription[]> {
    return AlertSubscription.find({ customerId, active: true }).sort({ createdAt: -1 });
  }

  async cancelSubscription(customerId: string, subscriptionId: string): Promise<IAlertSubscription> {
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      const err = new Error('Invalid subscription ID format.');
      (err as any).status = 400;
      throw err;
    }

    const sub = await AlertSubscription.findOne({ _id: subscriptionId, customerId });
    if (!sub) {
      const err = new Error('Alert subscription not found or access denied.');
      (err as any).status = 404;
      throw err;
    }

    sub.active = false;
    await sub.save();
    return sub;
  }
}

export const alertSubscriptionService = new AlertSubscriptionService();