// frontend/src/features/customer/HomePage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CustomerSearchBar } from './components/CustomerSearchBar';
import { MobileResultsPreview } from './components/MobileResultsPreview';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { MapPin, Store } from 'lucide-react';
import type { NearbyPharmacyResult } from './types';

// Seeded initial preview data matching UI Design Page 2, Page 4 & Page 11
const DEMO_PREVIEW_RESULTS: NearbyPharmacyResult[] = [
  {
    id: 'demo-res-1',
    pharmacyId: 'pharma-1',
    pharmacyName: 'Green Cross Pharmacy',
    isVerified: true,
    address: '14 Lake Road, Dhanmondi, Dhaka',
    phone: '+8801711000001',
    latitude: 23.7461,
    longitude: 90.3742,
    distanceKm: 1.2,
    isOpen: true,
    openingHoursText: 'Open until 10:00 PM',
    stockStatus: 'available',
    quantity: 14,
    updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
    isStale: false,
    medicineId: 'med-paracetamol-500',
    medicineName: 'Paracetamol 500 mg',
    genericName: 'Paracetamol',
    strength: '500 mg',
    form: 'Tablet',
    isDemoData: true,
  },
  {
    id: 'demo-res-2',
    pharmacyId: 'pharma-2',
    pharmacyName: 'CarePoint Pharmacy',
    isVerified: true,
    address: '28 Road 7A, Dhanmondi, Dhaka',
    phone: '+8801711000002',
    latitude: 23.7505,
    longitude: 90.3795,
    distanceKm: 2.4,
    isOpen: true,
    openingHoursText: 'Open until 9:00 PM',
    stockStatus: 'low',
    quantity: 4,
    updatedAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(), // 34 min ago
    isStale: false,
    medicineId: 'med-paracetamol-500',
    medicineName: 'Paracetamol 500 mg',
    genericName: 'Paracetamol',
    strength: '500 mg',
    form: 'Tablet',
    isDemoData: true,
  },
  {
    id: 'demo-res-3',
    pharmacyId: 'pharma-3',
    pharmacyName: 'CityWell Pharmacy',
    isVerified: true,
    address: 'Plot 12, Mirpur Road, Dhaka',
    phone: '+8801711000003',
    latitude: 23.7550,
    longitude: 90.3850,
    distanceKm: 3.1,
    isOpen: true,
    openingHoursText: 'Open until 11:00 PM',
    stockStatus: 'available',
    quantity: 8,
    updatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), // 26h ago -> Stale
    isStale: true,
    medicineId: 'med-paracetamol-500',
    medicineName: 'Paracetamol 500 mg',
    genericName: 'Paracetamol',
    strength: '500 mg',
    form: 'Tablet',
    isDemoData: true,
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCallNumber, setActiveCallNumber] = useState<string | null>(null);

  const handleSearch = ({ query, area, useLocation }: { query: string; area: string; useLocation: boolean }) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (area) params.set('area', area);
    if (useLocation) params.set('geo', '1');
    navigate(`/search?${params.toString()}`);
  };

  const handleSelectPharmacy = (pharmacyId: string) => {
    navigate(`/search?pharmacyId=${pharmacyId}&q=Paracetamol`);
  };

  const handleCallPharmacy = (phone: string) => {
    setActiveCallNumber(phone);
    window.location.href = `tel:${phone}`;
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
      <CustomerSearchBar onSearch={handleSearch} initialQuery="Paracetamol 500 mg" initialArea="Dhanmondi, Dhaka" />

      {/* Top Banner Disclaimer */}
      <DisclaimerBanner variant="banner" />

      {/* Wireframe Discovery Grid: Content & Map/Results Preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Mobile & Results Wireframe Preview */}
        <div>
          <MobileResultsPreview
            results={DEMO_PREVIEW_RESULTS}
            onSelectPharmacy={handleSelectPharmacy}
            onCallPharmacy={handleCallPharmacy}
          />
        </div>

        {/* Right Column: Visual Map Preview Card (per UI Design Page 2) */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              Map Preview
            </h3>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-action-primary)',
                fontWeight: 600,
              }}
            >
              Interactive in search
            </span>
          </div>

          {/* Map Wireframe Placeholder Preview with Dhaka grid aesthetic */}
          <div
            style={{
              height: '240px',
              backgroundColor: '#EDF4F2',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-default)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* Simulated marker pins 1, 2, 3 matching UI Design p.2 */}
            <div
              style={{
                position: 'absolute',
                top: '40%',
                left: '25%',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-action-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
              title="1. Green Cross Pharmacy (Available)"
            >
              1
            </div>

            <div
              style={{
                position: 'absolute',
                top: '30%',
                left: '65%',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-action-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
              title="2. CarePoint Pharmacy (Low stock)"
            >
              2
            </div>

            <div
              style={{
                position: 'absolute',
                top: '70%',
                left: '75%',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-action-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
              title="3. CityWell Pharmacy (Stale)"
            >
              3
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '10px',
                color: 'var(--color-text-secondary)',
              }}
            >
              Dhanmondi, Dhaka area
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            Map and list show the same verified pharmacies and stock states. Real GPS location requested with user consent.
          </div>
        </div>
      </div>

      {/* 3 Step Process Section (per UI Design Page 2) */}
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

      {/* For Pharmacy Teams Banner (cross-linking to Dev 2 flow per UI Design p.2) */}
      <aside
        style={{
          marginTop: 'auto',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
            For pharmacy teams
          </strong>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Manage a verified pharmacy profile, update stock in one tap, and handle reservation requests.
          </span>
        </div>
        <Link
          to="/pharmacy/register"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
          }}
        >
          <Store size={15} aria-hidden="true" />
          <span>Explore pharmacy tools</span>
        </Link>
      </aside>

      {/* Screen Reader status alert for telephone triggers */}
      {activeCallNumber && (
        <div role="status" className="sr-only">
          Dialing {activeCallNumber}
        </div>
      )}
    </div>
  );
};

