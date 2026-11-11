// frontend/src/features/customer/components/MedicineSuggestions.tsx
import React from 'react';
import { Pill, CheckCircle2 } from 'lucide-react';
import type { MedicineCatalogueItem } from '../services/medicineCatalogueService';

interface MedicineSuggestionsProps {
  suggestions: MedicineCatalogueItem[];
  onSelect: (item: MedicineCatalogueItem) => void;
  isLoading?: boolean;
}

export const MedicineSuggestions: React.FC<MedicineSuggestionsProps> = ({
  suggestions,
  onSelect,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '10px 14px',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          marginTop: '4px',
        }}
      >
        Finding medicine matches in catalogue...
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Medicine catalogue suggestions"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        marginTop: '6px',
        padding: '6px',
        listStyle: 'none',
        maxHeight: '260px',
        overflowY: 'auto',
      }}
    >
      {suggestions.map((item) => (
        <li
          key={item.id}
          role="option"
          aria-selected={false}
          tabIndex={0}
          onClick={() => onSelect(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(item);
            }
          }}
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background-color 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-action-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onFocus={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-action-subtle)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-canvas)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Pill size={16} color="var(--color-action-primary)" aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Generic: {item.genericName} &bull; {item.form} &bull; {item.strength}
              </div>
            </div>
          </div>

          {item.isCatalogueVerified && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-trust-primary, #0B6BCB)',
                backgroundColor: 'var(--color-trust-subtle, #EBF5FF)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={11} aria-hidden="true" />
              <span>Verified</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

