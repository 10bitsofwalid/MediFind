// frontend/src/features/customer/services/alertService.ts
// Service for subscribing to medicine restock/availability alerts

export interface StockAlertSubscription {
  id: string;
  medicineName: string;
  genericName?: string;
  strength?: string;
  area: string;
  emailOrPhone: string;
  createdAt: string;
  status: 'active' | 'notified' | 'cancelled';
}

const STORAGE_KEY = 'medifind_stock_alerts';

export const alertService = {
  /**
   * Subscribe to a restock/availability notification
   */
  async subscribeAlert(params: {
    medicineName: string;
    genericName?: string;
    strength?: string;
    area: string;
    emailOrPhone: string;
  }): Promise<StockAlertSubscription> {
    const trimmedMedicine = params.medicineName.trim();
    const trimmedContact = params.emailOrPhone.trim();
    const trimmedArea = params.area.trim();

    if (!trimmedMedicine) {
      throw new Error('Medicine name is required to subscribe for alerts.');
    }
    if (!trimmedContact) {
      throw new Error('Please provide an email or phone number to receive alerts.');
    }
    if (trimmedContact.length < 5) {
      throw new Error('Please enter a valid email or phone number.');
    }

    const subscription: StockAlertSubscription = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medicineName: trimmedMedicine,
      genericName: params.genericName?.trim(),
      strength: params.strength?.trim(),
      area: trimmedArea || 'Dhaka',
      emailOrPhone: trimmedContact,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    try {
      const existing = this.getStoredAlerts();
      existing.unshift(subscription);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Unable to persist stock alert to storage:', e);
    }

    return subscription;
  },

  /**
   * Get all active alerts
   */
  getStoredAlerts(): StockAlertSubscription[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Cancel an alert
   */
  async cancelAlert(alertId: string): Promise<StockAlertSubscription> {
    const list = this.getStoredAlerts();
    const target = list.find((a) => a.id === alertId);
    if (!target) {
      throw new Error(`Alert subscription ${alertId} not found.`);
    }

    target.status = 'cancelled';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return target;
  },

  /**
   * Clear all alerts (for testing)
   */
  clearAlerts(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
