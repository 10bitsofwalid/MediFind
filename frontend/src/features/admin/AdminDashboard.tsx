// src/features/admin/AdminDashboard.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import {
  ShieldCheck,
  ClipboardCheck,
  Pill,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

async function fetchSummaryCounts() {
  const [apps, meds] = await Promise.all([
    adminService.getPharmacyApplications(),
    adminService.getCatalogueMedicines(),
  ]);

  return {
    pending: apps.filter((item) => item.application.status === 'pending').length,
    verified: apps.filter((item) => item.application.status === 'verified').length,
    flagged: apps.filter(
      (item) => item.application.status === 'rejected' || item.application.status === 'suspended'
    ).length,
    catalogueActive: meds.filter((m) => m.active).length,
    catalogueTotal: meds.length,
  };
}

export const AdminDashboard: React.FC = () => {
  const [counts, setCounts] = useState({
    pending: 0,
    verified: 0,
    flagged: 0,
    catalogueActive: 0,
    catalogueTotal: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      setCounts(await fetchSummaryCounts());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchSummaryCounts()
      .then((nextCounts) => {
        if (isMounted) {
          setCounts(nextCounts);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-action-primary)',
              marginBottom: '6px',
            }}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Administrator Portal</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Platform Governance & Review
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Verify pharmacy trade licenses before public listing and maintain the curated medicine catalogue.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSummary}
          disabled={isLoading}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-panel)',
            color: 'var(--color-text-secondary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Refresh Counts</span>
        </button>
      </div>

      {/* Summary Metrics */}
      <section
        aria-label="Administration summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div
          className="card"
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-status-caution)', fontSize: '13px', fontWeight: 600 }}>
            <Clock3 size={16} aria-hidden="true" />
            <span>Pending Applications</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '8px' }}>
            {isLoading ? '—' : counts.pending}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-status-available)', fontSize: '13px', fontWeight: 600 }}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Verified Pharmacies</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '8px' }}>
            {isLoading ? '—' : counts.verified}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-status-problem)', fontSize: '13px', fontWeight: 600 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Rejected / Suspended</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '8px' }}>
            {isLoading ? '—' : counts.flagged}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-action-primary)', fontSize: '13px', fontWeight: 600 }}>
            <Pill size={16} aria-hidden="true" />
            <span>Curated Medicines</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '8px' }}>
            {isLoading ? '—' : `${counts.catalogueActive} / ${counts.catalogueTotal}`}
          </div>
        </div>
      </section>

      {/* Eligible Operations */}
      <section aria-label="Administrator operations">
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>
          Administrator Operations
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          <Link
            to="/admin/verification"
            className="card"
            style={{
              padding: '22px',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-caution-bg)',
                  color: 'var(--color-status-caution)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <ClipboardCheck size={22} />
              </div>
              <ChevronRight size={18} color="var(--color-text-secondary)" aria-hidden="true" />
            </div>

            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                Pharmacy Verification Queue
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Inspect submitted drug trade license numbers, locations, and operating hours. Approve, reject with reason, or suspend listings.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/catalogue"
            className="card"
            style={{
              padding: '22px',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-action-subtle)',
                  color: 'var(--color-action-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <Pill size={22} />
              </div>
              <ChevronRight size={18} color="var(--color-text-secondary)" aria-hidden="true" />
            </div>

            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                Medicine Catalogue Manager
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Add curated medicine entries with generic names, strengths, and dosage forms, and manage active/inactive availability in search.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

