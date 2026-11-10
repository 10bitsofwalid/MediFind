// frontend/src/features/customer/MedicineDetailPage.tsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pill } from 'lucide-react';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';

export const MedicineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '16px',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          to="/search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-action-primary)',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Search</span>
        </Link>
      </div>

      <div
        className="card"
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Pill size={24} color="var(--color-action-primary)" />
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Medicine Details {id ? `(${id})` : ''}
          </h1>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
          Reference medicine information, pharmacy availability table, and same-generic alternatives will be connected in Phase 4.
        </p>
        <DisclaimerBanner variant="inline" />
      </div>
    </div>
  );
};

