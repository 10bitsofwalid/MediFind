// frontend/src/features/customer/services/reportService.ts
// Service for customer reporting of incorrect pharmacy availability or medicine discrepancies

export interface AvailabilityReportPayload {
  pharmacyId: string;
  pharmacyName: string;
  medicineId: string;
  medicineName: string;
  issueType: 'out_of_stock' | 'incorrect_quantity' | 'wrong_price' | 'closed_unannounced' | 'other';
  reportedStatus?: 'out' | 'low' | 'available';
  notes?: string;
  reporterEmail?: string;
}

export interface AvailabilityReportRecord extends AvailabilityReportPayload {
  id: string;
  createdAt: string;
  status: 'pending_review' | 'acknowledged' | 'resolved';
}

const STORAGE_KEY = 'medifind_availability_reports';

export const reportService = {
  /**
   * Submit an incorrect availability report (saved to local storage and submitted to API if available)
   */
  async submitReport(payload: AvailabilityReportPayload): Promise<AvailabilityReportRecord> {
    if (!payload.pharmacyId) {
      throw new Error('Pharmacy ID is required to submit an availability report.');
    }
    if (!payload.medicineName) {
      throw new Error('Medicine name is required to submit an availability report.');
    }
    if (!payload.issueType) {
      throw new Error('Please select the type of discrepancy observed.');
    }

    const newRecord: AvailabilityReportRecord = {
      ...payload,
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: 'pending_review',
    };

    try {
      const existing = this.getStoredReports();
      existing.unshift(newRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Unable to persist report to localStorage:', e);
    }

    return newRecord;
  },

  /**
   * Retrieve all reports submitted by the customer
   */
  getStoredReports(): AvailabilityReportRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clear reports (useful for testing)
   */
  clearReports(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
