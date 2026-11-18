// src/features/pharmacy/OwnerDashboardSummaryCards.tsx
import React from 'react';
import type { InventorySummary } from './inventoryUtils';
import {
  Pill,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface OwnerDashboardSummaryCardsProps {
  summary: InventorySummary | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onSelectAttentionCard?: () => void;
  isVerified?: boolean;
}

export const OwnerDashboardSummaryCards: React.FC<OwnerDashboardSummaryCardsProps> = ({
  summary,
  isLoading,
  error,
  onRetry,
  onSelectAttentionCard,
  isVerified = true,
}) => {
  if (isLoading) {
    return (
      <section
        role="region"
        aria-label="Pharmacy dashboard summary loading"
        aria-busy="true"
        style={{ marginBottom: '28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              Inventory &amp; Operational Overview
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Loading real-time availability and stock quality metrics...
            </span>
          </div>
        </div>

        <div className="owner-summary-grid">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="owner-summary-card skeleton-card"
              style={{
                minHeight: '130px',
                padding: '20px',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '90px', height: '14px', backgroundColor: '#eef2f6', borderRadius: '4px' }} />
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eef2f6' }} />
              </div>
              <div style={{ width: '48px', height: '28px', backgroundColor: '#eef2f6', borderRadius: '4px', margin: '10px 0 6px' }} />
              <div style={{ width: '120px', height: '12px', backgroundColor: '#eef2f6', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        role="region"
        aria-label="Pharmacy dashboard summary error"
        style={{
          marginBottom: '28px',
          padding: '20px',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--color-status-problem-bg)',
          border: '1px solid rgba(180, 35, 47, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={22} color="var(--color-status-problem)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <div>
              <strong style={{ fontSize: '15px', color: 'var(--color-status-problem)', display: 'block', marginBottom: '4px' }}>
                Failed to Load Dashboard Summary
              </strong>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {error} Operational metrics and attention counts could not be refreshed from the server.
              </p>
            </div>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
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
              <span>Retry Summary</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  const safeSummary: InventorySummary = summary || {
    total: 0,
    available: 0,
    low: 0,
    out: 0,
    unverified: 0,
    stale: 0,
    needsAttention: 0,
    freshAvailable: 0,
    reconfirmationRequired: 0,
  };

  const depletedCount = safeSummary.low + safeSummary.out;
  const staleAvailableCount = Math.max(0, safeSummary.available - safeSummary.freshAvailable);

  return (
    <section
      role="region"
      aria-label="Pharmacy owner dashboard summary metrics"
      style={{ marginBottom: '28px' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            id="owner-summary-heading"
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}
          >
            Inventory &amp; Operational Overview
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Authoritative counts computed directly from returned pharmacy inventory records
          </span>
        </div>

        {!isVerified && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-status-caution)',
              backgroundColor: 'var(--color-status-caution-bg)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(152, 88, 0, 0.3)',
            }}
          >
            Read-only preview until verified
          </span>
        )}
      </div>

      <div className="owner-summary-grid">
        {/* CARD 1: TOTAL LISTED MEDICINES */}
        <div
          className="owner-summary-card"
          tabIndex={0}
          aria-labelledby="card-total-title card-total-value card-total-desc"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span
                id="card-total-title"
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}
              >
                Total Listed Medicines
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-action-subtle)',
                  color: 'var(--color-action-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <Pill size={16} />
              </div>
            </div>

            <div
              id="card-total-value"
              style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}
            >
              {safeSummary.total}
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--color-border-default)' }}>
            <span
              id="card-total-desc"
              style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, display: 'block' }}
            >
              {safeSummary.total === 0
                ? 'No items listed yet. Add medicines from the catalogue.'
                : 'Active catalogue medicines linked to your inventory'}
            </span>
          </div>
        </div>

        {/* CARD 2: PATIENT-READY STOCK (FRESH & AVAILABLE) */}
        <div
          className="owner-summary-card"
          tabIndex={0}
          aria-labelledby="card-fresh-title card-fresh-value card-fresh-desc"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span
                id="card-fresh-title"
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-status-available)' }}
              >
                Patient-Ready Stock
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-status-available-bg)',
                  color: 'var(--color-status-available)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <CheckCircle2 size={16} />
              </div>
            </div>

            <div
              id="card-fresh-value"
              style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-status-available)', lineHeight: 1.1 }}
            >
              {safeSummary.freshAvailable}
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(24, 115, 75, 0.2)' }}>
            <span
              id="card-fresh-desc"
              style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, display: 'block' }}
            >
              {safeSummary.available === 0 ? (
                'No available items reported.'
              ) : staleAvailableCount > 0 ? (
                <span>
                  <strong>{safeSummary.available}</strong> reported available • {staleAvailableCount} stale (&ge;24h)
                </span>
              ) : (
                'All reported available items updated within 24h'
              )}
            </span>
          </div>
        </div>

        {/* CARD 3: DEPLETED / LOW STOCK */}
        <div
          className="owner-summary-card"
          tabIndex={0}
          aria-labelledby="card-depleted-title card-depleted-value card-depleted-desc"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: depletedCount > 0 ? '1px solid rgba(152, 88, 0, 0.35)' : '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span
                id="card-depleted-title"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: depletedCount > 0 ? 'var(--color-status-caution)' : 'var(--color-text-secondary)',
                }}
              >
                Low &amp; Out of Stock
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: depletedCount > 0 ? 'var(--color-status-caution-bg)' : 'var(--color-status-neutral-bg)',
                  color: depletedCount > 0 ? 'var(--color-status-caution)' : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <AlertTriangle size={16} />
              </div>
            </div>

            <div
              id="card-depleted-value"
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: depletedCount > 0 ? 'var(--color-status-caution)' : 'var(--color-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {depletedCount}
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--color-border-default)' }}>
            <span
              id="card-depleted-desc"
              style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, display: 'block' }}
            >
              <strong>{safeSummary.low}</strong> Low stock • <strong>{safeSummary.out}</strong> Out of stock
            </span>
          </div>
        </div>

        {/* CARD 4: QUALITY ATTENTION REQUIRED (INTERACTIVE CLICK TO QUEUE) */}
        <div
          role={onSelectAttentionCard ? 'button' : 'region'}
          tabIndex={0}
          onClick={onSelectAttentionCard}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onSelectAttentionCard) {
              e.preventDefault();
              onSelectAttentionCard();
            }
          }}
          aria-labelledby="card-attention-title card-attention-value card-attention-desc"
          className="owner-summary-card attention-summary-card"
          style={{
            backgroundColor: safeSummary.needsAttention > 0 ? 'var(--color-status-problem-bg)' : 'var(--color-surface-panel)',
            border:
              safeSummary.needsAttention > 0
                ? '1px solid rgba(180, 35, 47, 0.4)'
                : '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            cursor: onSelectAttentionCard ? 'pointer' : 'default',
            transition: 'transform 0.1s ease, box-shadow 0.15s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  id="card-attention-title"
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: safeSummary.needsAttention > 0 ? 'var(--color-status-problem)' : 'var(--color-status-available)',
                  }}
                >
                  Quality Attention
                </span>
                {safeSummary.needsAttention > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-status-problem)',
                      color: '#ffffff',
                    }}
                  >
                    ACTION NEEDED
                  </span>
                )}
              </div>

              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor:
                    safeSummary.needsAttention > 0
                      ? 'rgba(180, 35, 47, 0.12)'
                      : 'var(--color-status-available-bg)',
                  color:
                    safeSummary.needsAttention > 0
                      ? 'var(--color-status-problem)'
                      : 'var(--color-status-available)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                {safeSummary.needsAttention > 0 ? <ShieldAlert size={16} /> : <Sparkles size={16} />}
              </div>
            </div>

            <div
              id="card-attention-value"
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: safeSummary.needsAttention > 0 ? 'var(--color-status-problem)' : 'var(--color-status-available)',
                lineHeight: 1.1,
              }}
            >
              {safeSummary.needsAttention}
            </div>
          </div>

          <div
            style={{
              marginTop: '14px',
              paddingTop: '10px',
              borderTop:
                safeSummary.needsAttention > 0
                  ? '1px solid rgba(180, 35, 47, 0.2)'
                  : '1px solid rgba(24, 115, 75, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              id="card-attention-desc"
              style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}
            >
              {safeSummary.needsAttention === 0 ? (
                'All reports fresh & verified'
              ) : (
                <span>
                  <strong>{safeSummary.stale}</strong> Stale (&ge;24h) • <strong>{safeSummary.unverified}</strong> Unverified
                </span>
              )}
            </span>

            {onSelectAttentionCard && safeSummary.needsAttention > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-status-problem)',
                }}
              >
                <span>View</span>
                <ChevronRight size={13} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
