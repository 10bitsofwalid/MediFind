// frontend/src/features/customer/components/CustomerSearchBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, ArrowRight, X } from 'lucide-react';
import { MedicineSuggestions } from './MedicineSuggestions';
import { medicineCatalogueService, type MedicineCatalogueItem } from '../services/medicineCatalogueService';

interface CustomerSearchBarProps {
  initialQuery?: string;
  initialArea?: string;
  onSearch: (params: { query: string; area: string; useLocation: boolean }) => void;
  onSelectSuggestion?: (item: MedicineCatalogueItem) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export const CustomerSearchBar: React.FC<CustomerSearchBarProps> = ({
  initialQuery = '',
  initialArea = '',
  onSearch,
  onSelectSuggestion,
  isLoading = false,
  compact = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [area, setArea] = useState(initialArea);
  const [useLocation, setUseLocation] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state during render when props change (official React recommended pattern)
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  const [prevInitialArea, setPrevInitialArea] = useState(initialArea);
  if (initialArea !== prevInitialArea) {
    setPrevInitialArea(initialArea);
    setArea(initialArea);
  }

  // Suggestions state
  const [suggestions, setSuggestions] = useState<MedicineCatalogueItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetching without synchronous setState inside effect
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const matches = await medicineCatalogueService.searchSuggestions(trimmed);
        if (active) {
          setSuggestions(matches);
          setShowSuggestions(matches.length > 0);
        }
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setIsSearchingSuggestions(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setValidationError('Please enter a medicine name, generic name, or strength.');
      return;
    }
    setValidationError(null);
    setShowSuggestions(false);
    onSearch({ query: query.trim(), area: area.trim(), useLocation });
  };

  const handleSelectSuggestion = (item: MedicineCatalogueItem) => {
    setQuery(item.name);
    setShowSuggestions(false);
    setValidationError(null);
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    }
    onSearch({ query: item.name, area: area.trim(), useLocation });
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
        {/* Medicine Name / Generic Input with Suggestions Dropdown */}
        <div ref={containerRef} style={{ position: 'relative' }}>
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
              onFocus={() => {
                if (suggestions.length > 0 && query.trim().length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="e.g. Paracetamol 500 mg"
              aria-required="true"
              aria-invalid={!!validationError}
              aria-describedby={validationError ? 'search-validation-error' : undefined}
              aria-autocomplete="list"
              aria-expanded={showSuggestions && query.trim().length >= 2}
              style={{
                width: '100%',
                padding: '12px 34px 12px 38px',
                borderRadius: 'var(--radius-md)',
                border: validationError ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-surface-canvas)',
                boxSizing: 'border-box',
              }}
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  padding: '2px',
                }}
                aria-label="Clear medicine search input"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions dropdown */}
          {showSuggestions && query.trim().length >= 2 && (
            <MedicineSuggestions
              suggestions={suggestions}
              onSelect={handleSelectSuggestion}
              isLoading={isSearchingSuggestions}
            />
          )}
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
