// frontend/src/features/customer/HomePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerSearchBar } from './components/CustomerSearchBar';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { MapPin } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleSearch = ({ query, area, useLocation }: { query: string; area: string; useLocation: boolean }) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (area) params.set('area', area);
    if (useLocation) params.set('geo', '1');
    navigate(`/search?${params.toString()}`);
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
        gap: '24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Hero Header Section */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingTop: '8px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-action-primary)',
          }}
        >
          <MapPin size={13} aria-hidden="true" />
          <span>Medicine Availability Near You</span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          Find the medicine.
          <br />
          Find a nearby pharmacy.
        </h1>
        <p
          style={{
            fontSize: 'clamp(14px, 2vw, 16px)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            maxWidth: '680px',
            lineHeight: 1.5,
          }}
        >
          Search by brand or generic name, check pharmacy-reported availability, then compare distance and opening hours.
        </p>
      </header>

      {/* Main Search Component */}
      <CustomerSearchBar onSearch={handleSearch} />

      {/* Top Banner Disclaimer */}
      <DisclaimerBanner variant="banner" />

      {/* 3 Step Process Section */}
      <section aria-label="How MediFind works">
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginBottom: '14px',
          }}
        >
          A clearer way to check local availability
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
          }}
        >
          <div
            className="card"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-action-primary)',
                marginBottom: '4px',
              }}
            >
              01
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
              Search your medicine
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Brand and generic-name search with useful catalogue alternatives.
            </p>
          </div>

          <div
            className="card"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-action-primary)',
                marginBottom: '4px',
              }}
            >
              02
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
              Compare nearby stock
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              See availability, freshness timestamp, distance, and operating hours.
            </p>
          </div>

          <div
            className="card"
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--color-action-primary)',
                marginBottom: '4px',
              }}
            >
              03
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--color-text-primary)' }}>
              Choose your next step
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              Open a route, call to confirm stock, or sign in to reserve a short hold.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
