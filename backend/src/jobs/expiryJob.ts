import { reservationService } from '../services/reservationService';

export const runReservationExpiryCheck = async (): Promise<number> => {
  try {
    const count = await reservationService.sweepExpiredReservations();
    if (count > 0 && process.env.NODE_ENV !== 'test') {
      console.log('[ExpiryJob] Swept ' + count + ' expired customer reservations.');
    }
    return count;
  } catch (err) {
    console.error('[ExpiryJob] Error sweeping expired reservations:', err);
    return 0;
  }
};

export const setupExpiryCron = (): void => {
  const cron = require('node-cron');
  cron.schedule('*/5 * * * *', async () => {
    await runReservationExpiryCheck();
  });
};