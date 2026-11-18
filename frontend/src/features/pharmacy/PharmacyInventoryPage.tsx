// src/features/pharmacy/PharmacyInventoryPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type {
  Pharmacy,
  PharmacyApplicationResponse,
  VerificationStatus,
} from '../../types/pharmacy';
import {
  getPharmacyApplication,
  getPharmacyProfile,
} from '../../services/pharmacyService';
import { OneTapStockControl } from './OneTapStockControl';
import {
  ChevronLeft,
  Building2,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  AlertOctagon,
  Lock,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

export const PharmacyInventoryPage: React.FC = () => {
  const [application, setApplication] = useState<PharmacyApplicationResponse | null>(null);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPharmacyContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [appRes, profileRes] = await Promise.all([
        getPharmacyApplication().catch(() => null),
        getPharmacyProfile().catch(() => null),
      ]);
      setApplication(appRes);
      setPharmacy(profileRes);
    } catch {
      setError('Could not verify your pharmacy workspace status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getPharmacyApplication().catch(() => null),
      getPharmacyProfile().catch(() => null),
    ])
      .then(([appRes, profileRes]) => {
        if (mounted) {
          setApplication(appRes);
          setPharmacy(profileRes);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Could not verify your pharmacy workspace status. Please try again.');
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Loading inventory workbench...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px' }}>
        <div
          role="alert"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertTriangle size={28} color="var(--color-status-problem)" aria-hidden="true" />
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-status-problem)' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={loadPharmacyContext}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(180, 35, 47, 0.35)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-status-problem)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!application && !pharmacy) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '40px 24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-action-subtle)',
              color: 'var(--color-action-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <Building2 size={28} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
            No Pharmacy Registered
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Submit your pharmacy onboarding application first. Inventory management unlocks once your pharmacy is verified.
          </p>
          <Link
            to="/pharmacy/register"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontSize: '15px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            <span>Start Pharmacy Application</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus: VerificationStatus = application?.status || pharmacy?.status || 'pending';
  const resolvedPharmacyId = pharmacy?._id || pharmacy?.id || application?.pharmacyId || '';
  const pharmacyName = pharmacy?.name || application?.data?.name || 'Your Pharmacy';
  const addressString =
    pharmacy?.formattedAddress ||
    pharmacy?.address ||
    application?.data?.formattedAddress ||
    application?.data?.streetAddress ||
    'Address on file';
  const licenseNumber =
    pharmacy?.licenseNo || application?.data?.licenseNo || 'Documentation on file';
  const decisionReason =
    application?.decisionReason ||
    application?.verificationReason ||
    pharmacy?.decisionReason ||
    pharmacy?.verificationReason;
  const nextStep = application?.nextStep || pharmacy?.nextStep;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '24px 16px 80px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/pharmacy/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Back to Owner Workspace</span>
        </Link>
      </div>

      {/* Pharmacy Identity & Context Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '22px',
          paddingBottom: '18px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Inventory Workbench
            </h1>
            {currentStatus === 'verified' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-status-available-bg)',
                  color: 'var(--color-status-available)',
                  border: '1px solid rgba(24, 115, 75, 0.3)',
                }}
              >
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>Verified Pharmacy</span>
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    currentStatus === 'pending'
                      ? 'var(--color-status-caution-bg)'
                      : 'var(--color-status-problem-bg)',
                  color:
                    currentStatus === 'pending'
                      ? 'var(--color-status-caution)'
                      : 'var(--color-status-problem)',
                  border: '1px solid var(--color-border-default)',
                  textTransform: 'capitalize',
                }}
              >
                {currentStatus === 'pending' ? (
                  <Clock3 size={13} aria-hidden="true" />
                ) : currentStatus === 'suspended' ? (
                  <AlertOctagon size={13} aria-hidden="true" />
                ) : (
                  <ShieldAlert size={13} aria-hidden="true" />
                )}
                <span>Status: {currentStatus}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>{pharmacyName}</strong>
            <span>•</span>
            <span>License: <code>{licenseNumber}</code></span>
            <span>•</span>
            <span>{addressString}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section
        className="card"
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
        }}
        aria-label="Pharmacy inventory management"
      >
        {currentStatus !== 'verified' ? (
          <div
            role="region"
            aria-label="Inventory locked until verified"
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--color-border-default)',
            }}
          >
            <Lock size={32} color="var(--color-text-secondary)" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
              Inventory Management Locked ({currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)})
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto 12px', lineHeight: 1.5 }}>
              Only verified pharmacies can publish or update medicine availability. Stock reporting unlocks once administrator verification is approved.
            </p>
            {decisionReason && (
              <p style={{ fontSize: '13px', color: 'var(--color-status-problem)', maxWidth: '520px', margin: '0 auto 10px' }}>
                <strong>Reason:</strong> {decisionReason}
              </p>
            )}
            {nextStep && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto 16px' }}>
                <strong>Next step:</strong> {nextStep}
              </p>
            )}
            <Link
              to="/pharmacy/dashboard"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              <span>Review Verification Status</span>
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : !resolvedPharmacyId ? (
          <div
            role="alert"
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-status-problem-bg)',
              color: 'var(--color-status-problem)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            Pharmacy identifier could not be resolved from your session. Please refresh or sign in again.
          </div>
        ) : (
          <OneTapStockControl pharmacyId={resolvedPharmacyId} pharmacyName={pharmacyName} />
        )}
      </section>
    </div>
  );
};

