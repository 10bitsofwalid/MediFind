import mongoose from 'mongoose';
import { Reservation, IReservation } from '../models/Reservation';
import { Stock } from '../models/Stock';
import { Pharmacy } from '../models/Pharmacy';
import { Medicine } from '../models/Medicine';

export interface CreateReservationDTO {
  customerId: string;
  pharmacyId: string;
  medicineId: string;
  quantity?: number;
}

export class ReservationService {
  async createReservation(data: CreateReservationDTO): Promise<IReservation> {
    if (!mongoose.Types.ObjectId.isValid(data.pharmacyId) || !mongoose.Types.ObjectId.isValid(data.medicineId)) {
      const err = new Error('Invalid ID format.');
      (err as any).status = 400;
      throw err;
    }

    const requestedQty = data.quantity || 1;
    if (requestedQty < 1) {
      const err = new Error('Quantity must be at least 1.');
      (err as any).status = 400;
      throw err;
    }

    const pharmacy = await Pharmacy.findOne({ _id: data.pharmacyId, verificationStatus: 'Verified' });
    if (!pharmacy) {
      const err = new Error('Reservations can only be placed at verified pharmacies.');
      (err as any).status = 400;
      throw err;
    }

    const medicine = await Medicine.findOne({ _id: data.medicineId, active: true });
    if (!medicine) {
      const err = new Error('Medicine is not available for reservation.');
      (err as any).status = 404;
      throw err;
    }

    const activeCount = await Reservation.countDocuments({
      customerId: data.customerId,
      status: 'active',
      expiresAt: { [String.fromCharCode(36) + 'gt']: new Date() },
    });

    if (activeCount >= 2) {
      const err = new Error('Maximum of 2 active reservations allowed per customer account.');
      (err as any).status = 429;
      throw err;
    }

    const stock = await Stock.findOne({ pharmacyId: data.pharmacyId, medicineId: data.medicineId });
    if (!stock || stock.stockStatus === 'out' || (stock.quantity !== undefined && stock.quantity < requestedQty)) {
      const err = new Error('Insufficient stock reported by pharmacy to complete reservation hold.');
      (err as any).status = 409;
      throw err;
    }

    const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const reservation = new Reservation({
      customerId: data.customerId,
      pharmacyId: data.pharmacyId,
      medicineId: data.medicineId,
      pickupCode,
      quantity: requestedQty,
      status: 'active',
      expiresAt,
    });

    await reservation.save();
    return reservation;
  }

  async getCustomerReservations(customerId: string): Promise<IReservation[]> {
    return Reservation.find({ customerId })
      .populate('pharmacyId', 'name address phone')
      .populate('medicineId', 'brandName genericName strength')
      .sort({ createdAt: -1 });
  }

  async cancelReservation(customerId: string, reservationId: string, reason?: string): Promise<IReservation> {
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      const err = new Error('Invalid reservation ID format.');
      (err as any).status = 400;
      throw err;
    }

    const reservation = await Reservation.findOne({ _id: reservationId, customerId });
    if (!reservation) {
      const err = new Error('Reservation not found or access denied.');
      (err as any).status = 404;
      throw err;
    }

    if (reservation.status !== 'active') {
      const err = new Error('Only active reservations can be cancelled.');
      (err as any).status = 400;
      throw err;
    }

    reservation.status = 'cancelled';
    reservation.cancellationReason = reason || 'Cancelled by customer';
    await reservation.save();
    return reservation;
  }
}

export const reservationService = new ReservationService();