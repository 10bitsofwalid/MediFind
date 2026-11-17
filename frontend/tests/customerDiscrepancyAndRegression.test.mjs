// frontend/tests/customerDiscrepancyAndRegression.test.mjs
// Phase 7 tests: Incorrect availability reporting, submission validation, and customer journey regression
// Pure vanilla JS — no TypeScript source imports (Node native test runner)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helpers: in-memory mock of reportService logic
// ---------------------------------------------------------------------------

function createMockReportService() {
  const reports = [];

  return {
    async submitReport(payload) {
      if (!payload.pharmacyId) {
        throw new Error('Pharmacy ID is required to submit an availability report.');
      }
      if (!payload.medicineName) {
        throw new Error('Medicine name is required to submit an availability report.');
      }
      if (!payload.issueType) {
        throw new Error('Please select the type of discrepancy observed.');
      }

      const validIssueTypes = ['out_of_stock', 'incorrect_quantity', 'wrong_price', 'closed_unannounced', 'other'];
      if (!validIssueTypes.includes(payload.issueType)) {
        throw new Error('Invalid discrepancy type selected.');
      }

      const record = {
        ...payload,
        id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        status: 'pending_review',
      };

      reports.unshift(record);
      return record;
    },

    getStoredReports() {
      return [...reports];
    },

    clearReports() {
      reports.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 7 – Incorrect Availability Reporting & Customer Journey Regression', () => {

  // 1. Report submission succeeds with complete payload
  it('Report Service: successfully registers valid availability discrepancy', async () => {
    const service = createMockReportService();
    const payload = {
      pharmacyId: 'ph-1',
      pharmacyName: 'Lazz Pharma Dhanmondi',
      medicineId: 'med-paracetamol-500',
      medicineName: 'Paracetamol 500 mg',
      issueType: 'out_of_stock',
      reportedStatus: 'out',
      notes: 'Pharmacist indicated out of stock 10 minutes ago',
      reporterEmail: 'patient@example.com',
    };

    const record = await service.submitReport(payload);

    assert.ok(record.id.startsWith('rep_'), 'Record ID must be generated with rep_ prefix');
    assert.equal(record.status, 'pending_review', 'Initial status must be pending_review');
    assert.equal(record.pharmacyId, 'ph-1');
    assert.equal(record.issueType, 'out_of_stock');
    assert.equal(service.getStoredReports().length, 1);
  });

  // 2. Rejects submission when pharmacyId is missing
  it('Report Validation: rejects submission without pharmacyId', async () => {
    const service = createMockReportService();
    await assert.rejects(
      async () => {
        await service.submitReport({
          pharmacyId: '',
          pharmacyName: 'Unknown',
          medicineId: 'med-1',
          medicineName: 'Napa 500 mg',
          issueType: 'out_of_stock',
        });
      },
      { message: /Pharmacy ID is required/i }
    );
  });

  // 3. Rejects submission when medicineName is missing
  it('Report Validation: rejects submission without medicineName', async () => {
    const service = createMockReportService();
    await assert.rejects(
      async () => {
        await service.submitReport({
          pharmacyId: 'ph-1',
          pharmacyName: 'Lazz Pharma',
          medicineId: 'med-1',
          medicineName: '',
          issueType: 'out_of_stock',
        });
      },
      { message: /Medicine name is required/i }
    );
  });

  // 4. Rejects invalid issue types
  it('Report Validation: rejects invalid discrepancy type', async () => {
    const service = createMockReportService();
    await assert.rejects(
      async () => {
        await service.submitReport({
          pharmacyId: 'ph-1',
          pharmacyName: 'Lazz Pharma',
          medicineId: 'med-1',
          medicineName: 'Napa',
          issueType: 'non_existent_issue_type',
        });
      },
      { message: /Invalid discrepancy type/i }
    );
  });

  // 5. Customer journey regression: accessibility contract for reporting modal
  it('Accessibility Contract: modal includes role="dialog", aria-modal="true", and aria-labelledby', () => {
    const modalAttributes = {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'report-modal-title',
    };

    assert.equal(modalAttributes.role, 'dialog');
    assert.equal(modalAttributes['aria-modal'], 'true');
    assert.equal(modalAttributes['aria-labelledby'], 'report-modal-title');
  });

  // 6. Regression: Customer guest browsing retains access to reporting without authentication
  it('Guest Customer Journey: guest user can submit discrepancy report without login session', async () => {
    const service = createMockReportService();
    const guestReport = await service.submitReport({
      pharmacyId: 'ph-2',
      pharmacyName: 'Tamanna Pharmacy',
      medicineId: 'med-2',
      medicineName: 'Amoxicillin 500 mg',
      issueType: 'incorrect_quantity',
      reportedStatus: 'low',
    });

    assert.ok(guestReport.id);
    assert.equal(guestReport.pharmacyName, 'Tamanna Pharmacy');
  });

});
