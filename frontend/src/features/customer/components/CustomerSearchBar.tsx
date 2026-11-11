// frontend/src/features/customer/components/CustomerSearchBar.tsx
import React, { useState } from 'react';
import { Search, MapPin, Navigation, ArrowRight } from 'lucide-react';

interface CustomerSearchBarProps {
  initialQuery?: string;
  initialArea?: string;
  onSearch: (params: { query: string; area: string; useLocation: boolean }) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export const CustomerSearchBar: React.FC<CustomerSearchBarProps> = ({
  initialQuery = '',
  initialArea = '',
  onSearch,
  isLoading = false,
  compact = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState(initialArea);
  const [useLocation, setUseLocation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setValidationError('Please enter a medicine name, generic name, or strength.');
      return;
    }
    setValidationError(null);
    onSearch({ query: query.trim(), area: area.trim(), useLocation });
  };

  const handleUseCurrentLocation = () => {
    setUseLocation(true);
    setArea('Current Location (GPS)');
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search medicine and pharmacy availability"
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-default)',
        padding: compact ? '12px' : '20px',
        boxShadow: 'var(--shadow-md)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr)) minmax(130px, auto)',
          gap: '12px',
          alignItems: 'end',
        }}
      >
        {/* Medicine Name / Generic Input */}
        <div>
          <label
            htmlFor="medicine-search-input"
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Medicine name
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              id="medicine-search-input"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Paracetamol 500 mg"
              aria-required="true"
              aria-invalid={!!validationError}
              aria-describedby={validationError ? 'search-validation-error' : undefined}
              style={{
                width: '100%',
                padding: '12px 14px 12px 38px',
                borderRadius: 'var(--radius-md)',
                border: validationError ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-surface-canvas)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Area / Location Fallback Input */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label
              htmlFor="area-search-input"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Your area
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-action-primary)',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label="Use current location via browser GPS"
            >
              <Navigation size={12} aria-hidden="true" />
              <span>Use current location</span>
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <MapPin
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-secondary)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              id="area-search-input"
              type="text"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setUseLocation(false);
              }}
              placeholder="e.g. Dhanmondi, Dhaka"
              style={{
                width: '100%',
                padding: '12px 14px 12px 38px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-surface-canvas)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '12px 20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              cursor: isLoading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
            aria-label="Search nearby pharmacies reporting this medicine"
          >
            <span>{isLoading ? 'Searching...' : 'Search nearby'}</span>
            {!isLoading && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {validationError && (
        <div
          id="search-validation-error"
          role="alert"
          style={{
            marginTop: '10px',
            color: 'var(--color-status-problem)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {validationError}
        </div>
      )}

      {/* Helper text explaining guest access and role boundary */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--color-border-default)',
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          Browsing is available without an account. Sign in is only required to reserve or set an alert.
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
          Mobile-first &bull; 360px optimized
        </span>
      </div>
    </form>
  );
};

