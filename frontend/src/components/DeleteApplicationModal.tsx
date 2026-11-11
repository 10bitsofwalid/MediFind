// src/components/DeleteApplicationModal.tsx
import React from 'react';

interface DeleteApplicationModalProps {
  isOpen: boolean;
  pharmacyName: string;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  titleId?: string;
}

export const DeleteApplicationModal: React.FC<DeleteApplicationModalProps> = ({
  isOpen,
  pharmacyName,
  isDeleting,
  error,
  onCancel,
  onConfirm,
  titleId = 'delete-application-modal-title',
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 43, 58, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '460px',
          width: '100%',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-default)',
          textAlign: 'left',
        }}
      >
        <h3
          id={titleId}
          style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}
        >
          Delete Submitted Application?
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
          This will permanently withdraw and delete your submitted application for <strong>{pharmacyName}</strong>. You
          can submit a new application later if needed.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-status-problem-bg)',
              border: '1px solid rgba(180, 35, 47, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-problem)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="btn-secondary"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: 'var(--color-status-problem)',
              color: '#ffffff',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.75 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Application'}
          </button>
        </div>
      </div>
    </div>
  );
};

