// src/services/adminService.ts
import { api } from './api';
import axios from 'axios';
import type { Medicine } from '../types/medicine';
import type { PharmacyApplicationResponse, VerificationStatus } from '../types/pharmacy';
import { isMockApiEnabled } from './pharmacyService';

const MOCK_CATALOGUE_STORAGE_KEY = 'medifind_mock_catalogue';
const MOCK_APP_PREFIX = 'medifind_mock_pharmacy_application';

export interface AdminPharmacyApplicationItem {
  storageKey?: string;
  application: PharmacyApplicationResponse;
}

export interface CreateMedicinePayload {
  name: string;
  genericName: string;
  form: string;
  strength: string;
  manufacturer?: string;
  description?: string;
  prescriptionRequired?: boolean;
}

export function getStoredCatalogue(): Medicine[] {
  try {
    const raw = localStorage.getItem(MOCK_CATALOGUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const adminService = {
  async getPharmacyApplications(): Promise<AdminPharmacyApplicationItem[]> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const results: AdminPharmacyApplicationItem[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(MOCK_APP_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as PharmacyApplicationResponse;
          if (parsed && parsed.applicationId && parsed.data && typeof parsed.data.name === 'string') {
            results.push({ storageKey: key, application: parsed });
          }
        } catch {
          // skip malformed storage entries
        }
      }
      return results.sort(
        (a, b) =>
          new Date(b.application.submittedAt).getTime() - new Date(a.application.submittedAt).getTime()
      );
    }

    try {
      const response = await api.get('/admin/pharmacy-applications');
      const data = response.data?.data || response.data;
      if (!Array.isArray(data)) return [];
      return data.map((app: PharmacyApplicationResponse) => ({ application: app }));
    } catch {
      return [];
    }
  },

  async reviewPharmacyApplication(
    applicationId: string,
    decision: VerificationStatus,
    reason?: string,
    storageKey?: string
  ): Promise<PharmacyApplicationResponse> {
    if ((decision === 'rejected' || decision === 'suspended') && (!reason || !reason.trim())) {
      throw new Error(`Please provide a clear reason before marking an application as ${decision}.`);
    }

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      let targetKey = storageKey;
      if (!targetKey) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(MOCK_APP_PREFIX)) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as PharmacyApplicationResponse;
            if (parsed.applicationId === applicationId) {
              targetKey = key;
              break;
            }
          } catch {
            // continue searching
          }
        }
      }

      if (!targetKey) {
        throw new Error('Pharmacy application record not found.');
      }

      const raw = localStorage.getItem(targetKey);
      if (!raw) {
        throw new Error('Pharmacy application record not found.');
      }

      const app = JSON.parse(raw) as PharmacyApplicationResponse;
      const trimmedReason = reason?.trim() || undefined;
      let nextStep: string | undefined;

      if (decision === 'verified') {
        nextStep = 'Pharmacy listing is verified and eligible for public medicine availability reporting.';
      } else if (decision === 'rejected') {
        nextStep = 'Update the flagged license or business details and resubmit your onboarding application.';
      } else if (decision === 'suspended') {
        nextStep = 'Contact MediFind Compliance with your Drug License number to initiate a compliance review.';
      }

      const updated: PharmacyApplicationResponse = {
        ...app,
        status: decision,
        verificationReason: trimmedReason,
        decisionReason: trimmedReason,
        nextStep,
      };

      localStorage.setItem(targetKey, JSON.stringify(updated));
      return updated;
    }

    try {
      let endpoint = `/admin/pharmacy-applications/${applicationId}/approve`;
      if (decision === 'rejected') {
        endpoint = `/admin/pharmacy-applications/${applicationId}/reject`;
      } else if (decision === 'suspended') {
        endpoint = `/admin/pharmacies/${applicationId}/suspend`;
      } else if (decision === 'pending') {
        endpoint = `/admin/pharmacies/${applicationId}/reactivate`;
      }
      const res = await api.post(endpoint, reason ? { reason: reason.trim() } : undefined);
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Failed to record verification decision.', { cause: err });
    }
  },

  async getCatalogueMedicines(): Promise<Medicine[]> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return getStoredCatalogue();
    }

    try {
      const res = await api.get('/admin/medicines');
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async createCatalogueMedicine(payload: CreateMedicinePayload): Promise<Medicine> {
    if (!payload.name.trim() || !payload.genericName.trim() || !payload.strength.trim() || !payload.form.trim()) {
      throw new Error('Medicine name, generic name, form, and strength are required.');
    }

    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const current = getStoredCatalogue();
      const newMed: Medicine = {
        id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: payload.name.trim(),
        genericName: payload.genericName.trim(),
        form: payload.form.trim(),
        strength: payload.strength.trim(),
        manufacturer: payload.manufacturer?.trim() || undefined,
        description: payload.description?.trim() || undefined,
        prescriptionRequired: Boolean(payload.prescriptionRequired),
        active: true,
      };
      localStorage.setItem(MOCK_CATALOGUE_STORAGE_KEY, JSON.stringify([newMed, ...current]));
      return newMed;
    }

    try {
      const res = await api.post('/admin/medicines', payload);
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Failed to add medicine to catalogue.', { cause: err });
    }
  },

  async toggleMedicineActive(medicineId: string, active: boolean): Promise<Medicine> {
    if (isMockApiEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const current = getStoredCatalogue();
      const idx = current.findIndex((m) => m.id === medicineId);
      if (idx === -1) {
        throw new Error('Medicine record not found.');
      }
      const updated: Medicine = { ...current[idx], active };
      current[idx] = updated;
      localStorage.setItem(MOCK_CATALOGUE_STORAGE_KEY, JSON.stringify(current));
      return updated;
    }

    try {
      const endpoint = active
        ? `/admin/medicines/${medicineId}/activate`
        : `/admin/medicines/${medicineId}/deactivate`;
      const res = await api.post(endpoint);
      return res.data?.data || res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
        throw new Error(err.response.data.error.message, { cause: err });
      }
      throw new Error('Failed to update medicine status.', { cause: err });
    }
  },
};

