// frontend/src/features/customer/SearchResults.tsx
import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { CustomerSearchBar } from './components/CustomerSearchBar';
import { ArrowLeft, Search } from 'lucide-react';

export const SearchResults: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const area = searchParams.get('area') || '';

  const handleSearch = ({ query: newQuery, area: newArea, useLocation }: { query: string; area: string; useLocation: boolean }) => {
    const nextParams: Record<string, string> = {};
    if (newQuery) nextParams.q = newQuery;
    if (newArea) nextParams.area = newArea;
    if (useLocation) nextParams.geo = '1';
    setSearchParams(nextParams);
  };

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
          to="/"
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
          <span>Back to Home</span>
        </Link>
      </div>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
          {query ? `Nearby availability for "${query}"` : 'Search nearby medicine availability'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {area
            ? `Results around ${area} • Check freshness before travelling`
            : 'Enter a medicine name and your area or location to check nearby pharmacy stock'}
        </p>
      </div>

      <CustomerSearchBar
        key={`${query}_${area}`}
        initialQuery={query}
        initialArea={area}
        onSearch={handleSearch}
        compact
      />

      <DisclaimerBanner variant="inline" />

      <div
        className="card"
        style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <Search size={32} color="var(--color-action-primary)" style={{ margin: '0 auto 12px auto' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
          No Pharmacy Results Available
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto 16px auto' }}>
          Database connection and live availability search will display verified pharmacy stock once connected.
        </p>
        <Link
          to="/"
          className="btn-primary"
          style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}
        >
          Return to Guest Discovery
        </Link>
      </div>
    </div>
  );
};
