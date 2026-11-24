import mongoose from 'mongoose';
import { Reservation } from '../src/models/Reservation';
import { reservationService } from '../src/services/reservationService';
import { runReservationExpiryCheck } from '../src/jobs/expiryJob';

describe('Phase 11: Reservation Lifecycle, Automatic Expiry & Expiry Sweep', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('sweepExpiredReservations marks all active reservations past expiresAt as expired', async () => {
    const mockUpdateMany = jest.spyOn(Reservation, 'updateMany').mockResolvedValue({
      modifiedCount: 3,
      acknowledged: true,
      matchedCount: 3,
      upsertedCount: 0,
      upsertedId: null,
    } as any);

    const pastDate = new Date(Date.now() + 1000);
    const expiredCount = await reservationService.sweepExpiredReservations(pastDate);

    expect(expiredCount).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.objectContaining({
        [String.fromCharCode(36) + 'set']: { status: 'expired' },
      })
    );
  });

  it('runReservationExpiryCheck job runner executes sweep safely', async () => {
    jest.spyOn(reservationService, 'sweepExpiredReservations').mockResolvedValue(2);
    const count = await runReservationExpiryCheck();
    expect(count).toBe(2);
  });
});