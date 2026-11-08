// src/components/DisclaimerBanner.tsx
import React from 'react';
import { Info, Phone } from 'lucide-react';

interface DisclaimerBannerProps {
  pharmacyPhone?: string;
  variant?: 'banner' | 'inline';
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  pharmacyPhone,
  variant = 'banner',
}) => {
  if (variant === 'inline') {
    return (
      <div
        role="note"
        aria-label="Healthcare availability disclaimer"
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          lineHeight: 1.4,
        }}
      >
        <Info size={14} color="var(--color-text-secondary)" aria-hidden={true} style={{ flexShrink: 0 }} />
        <span>
          Availability is pharmacy-reported and subject to change. Please call ahead before travelling.
        </span>
      </div>
    );
  }

  return (
    <aside
      role="note"
      aria-label="Healthcare inventory and clinical advice disclaimer"
      style={{
        padding: '12px 16px',
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '13px',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '260px' }}>
        <Info size={18} color="var(--color-action-primary)" aria-hidden="true" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '2px' }}>
            MediFind Patient Notice:
          </strong>
          <span>
            Availability records are reported directly by participating pharmacies. MediFind does not guarantee stock
            or provide medical prescription, dosage, or diagnostic advice.
          </span>
        </div>
      </div>

      {pharmacyPhone && (
        <a
          href={`tel:${pharmacyPhone}`}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-canvas)',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
          aria-label={`Call pharmacy to confirm stock: ${pharmacyPhone}`}
        >
          <Phone size={13} aria-hidden="true" />
          <span>Call to Confirm</span>
        </a>
      )}
    </aside>
  );
};

