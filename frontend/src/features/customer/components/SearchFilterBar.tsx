// frontend/src/features/customer/components/SearchFilterBar.tsx
import React, { useState } from 'react';
import { Filter, SlidersHorizontal, Check, RotateCcw } from 'lucide-react';
import type { AvailabilityFilter, SortOption } from '../types';

export interface FilterState {
  distanceKm: number;
  availability: AvailabilityFilter[];
  openNow: boolean;
  sortBy: SortOption;
}

interface SearchFilterBarProps {
  filters: FilterState;
  onChange: (updated: FilterState) => void;
  onReset: () => void;
  totalResultsCount: number;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  filters,
  onChange,
  onReset,
  totalResultsCount,
}) => {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const handleDistanceChange = (km: number) => {
    onChange({ ...filters, distanceKm: km });
  };

  const handleAvailabilityToggle = (status: AvailabilityFilter) => {
    let next: AvailabilityFilter[];
    if (filters.availability.includes(status)) {
      next = filters.availability.filter((s) => s !== status);
    } else {
      next = [...filters.availability, status];
    }
    onChange({ ...filters, availability: next });
  };

  const handleOpenNowToggle = () => {
    onChange({ ...filters, openNow: !filters.openNow });
  };

  const handleSortChange = (sort: SortOption) => {
    onChange({ ...filters, sortBy: sort });
  };

  const isFiltered =
    filters.distanceKm !== 15 ||
    filters.availability.length > 0 ||
    filters.openNow ||
    filters.sortBy !== 'distance';

  const filterContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-secondary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>Refine results</span>
        </h3>

        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-action-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
            aria-label="Reset all search filters"
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Distance Filter */}
      <div>
        <label
          htmlFor="distance-filter-select"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '6px',
          }}
        >
          Distance radius
        </label>
        <select
          id="distance-filter-select"
          value={filters.distanceKm}
          onChange={(e) => handleDistanceChange(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-canvas)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value={3}>Within 3 km</option>
          <option value={5}>Within 5 km</option>
          <option value={10}>Within 10 km</option>
          <option value={15}>Within 15 km (Default)</option>
          <option value={25}>Within 25 km</option>
        </select>
      </div>

      {/* Availability Status Checkboxes */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}
        >
          Stock availability
        </legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'available', label: 'Available in stock', color: 'var(--color-status-available)' },
            { id: 'low', label: 'Low stock', color: 'var(--color-status-caution)' },
            { id: 'out', label: 'Out of stock', color: 'var(--color-status-problem)' },
          ].map(({ id, label, color }) => {
            const isChecked = filters.availability.includes(id as AvailabilityFilter);
            return (
              <label
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleAvailabilityToggle(id as AvailabilityFilter)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-action-primary)',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: color,
                    }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Open Now Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block' }}>
            Open now
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Filter pharmacies open today
          </span>
        </div>
        <button
          type="button"
          onClick={handleOpenNowToggle}
          role="switch"
          aria-checked={filters.openNow}
          style={{
            width: '42px',
            height: '24px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: filters.openNow ? 'var(--color-action-primary)' : 'var(--color-border-default)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
            transition: 'background-color 0.2s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: filters.openNow ? '20px' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'left 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {filters.openNow && <Check size={12} color="var(--color-action-primary)" />}
          </span>
        </button>
      </div>

      {/* Sort By Dropdown */}
      <div>
        <label
          htmlFor="sort-filter-select"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '6px',
          }}
        >
          Sort results by
        </label>
        <select
          id="sort-filter-select"
          value={filters.sortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-canvas)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="distance">Distance (Closest first)</option>
          <option value="freshness">Freshness (Recently updated)</option>
          <option value="availability">Availability (In-stock first)</option>
        </select>
      </div>

      <div
        role="note"
        style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          paddingTop: '8px',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        Showing {totalResultsCount} matching pharmacies. Map and list reflect these filters.
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle button for <= 768px screens */}
      <div className="mobile-filter-toggle" style={{ display: 'none', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          className="btn-secondary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} />
            <span>Refine & Filter ({totalResultsCount})</span>
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-action-primary)' }}>
            {isMobileFiltersOpen ? 'Hide' : 'Show filters'}
          </span>
        </button>
      </div>

      {/* Filter Sidebar Container */}
      <aside
        aria-label="Search and results filters"
        className={`filter-sidebar ${isMobileFiltersOpen ? 'open' : ''}`}
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {filterContent}
      </aside>
    </>
  );
};

