// frontend/src/features/customer/components/MedicineCatalogueCard.tsx
import React from 'react';
import { Pill, CheckCircle2, AlertCircle } from 'lucide-react';
import type { MedicineCatalogueItem } from '../services/medicineCatalogueService';

interface MedicineCatalogueCardProps {
  medicine: MedicineCatalogueItem;
  onSelectAlternative?: (altName: string) => void;
}

export const MedicineCatalogueCard: React.FC<MedicineCatalogueCardProps> = ({
  medicine,
  onSelectAlternative,
}) => {
  return (
    <section
      aria-label={`Medicine reference details for ${medicine.name}`}
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-action-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Pill size={22} color="var(--color-action-primary)" aria-hidden="true" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: 'clamp(18px, 2.5vw, 22px)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {medicine.name}
              </h2>

              {medicine.isCatalogueVerified && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-trust-primary, #0B6BCB)',
                    backgroundColor: 'var(--color-trust-subtle, #EBF5FF)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                  title="Verified in official DGDA / MediFind medicine catalogue"
                >
                  <CheckCircle2 size={12} aria-hidden="true" />
                  <span>Catalogue Verified</span>
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                marginTop: '4px',
                lineHeight: 1.4,
              }}
            >
              <strong>Generic:</strong> {medicine.genericName} &bull; <strong>Form:</strong> {medicine.form} &bull;{' '}
              <strong>Strength:</strong> {medicine.strength}
              {medicine.manufacturer && (
                <span> &bull; <strong>Mfg:</strong> {medicine.manufacturer}</span>
              )}
            </div>
          </div>
        </div>

        {medicine.prescriptionRequired && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-status-caution)',
              backgroundColor: 'var(--color-status-caution-bg)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(152, 88, 0, 0.25)',
              alignSelf: 'flex-start',
            }}
          >
            Prescription Required (Rx)
          </span>
        )}
      </div>

      {/* Same-generic brand alternatives */}
      {medicine.sameGenericAlternatives && medicine.sameGenericAlternatives.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '10px',
            borderTop: '1px solid var(--color-border-default)',
            fontSize: '12px',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Same-generic alternatives:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {medicine.sameGenericAlternatives.map((alt) => (
              <button
                key={alt}
                type="button"
                onClick={() => onSelectAlternative?.(alt)}
                style={{
                  backgroundColor: 'var(--color-surface-canvas)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 10px',
                  fontSize: '12px',
                  color: 'var(--color-action-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                aria-label={`Search alternative brand: ${alt}`}
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Clinical Disclaimer: No Diagnosis or Dosage Advice */}
      <div
        role="note"
        aria-label="Clinical advice disclaimer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--color-surface-canvas)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.4,
        }}
      >
        <AlertCircle size={15} color="var(--color-text-secondary)" style={{ flexShrink: 0 }} aria-hidden="true" />
        <span>
          <strong>Reference information only:</strong> MediFind does not provide medical or dosage advice. Follow a clinician’s prescription or official product label guidance.
        </span>
      </div>
    </section>
  );
};

