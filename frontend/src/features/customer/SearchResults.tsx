// frontend/src/features/customer/SearchResults.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CustomerSearchBar } from './components/CustomerSearchBar';
import { MedicineCatalogueCard } from './components/MedicineCatalogueCard';
import { SearchResultsList } from './components/SearchResultsList';
import { SearchFilterBar, type FilterState } from './components/SearchFilterBar';
import { LocationRequestBanner } from './components/LocationRequestBanner';
import { CustomerMapView } from './components/CustomerMapView';
import { ReportDiscrepancyModal } from './components/ReportDiscrepancyModal';
import { StockAlertModal } from './components/StockAlertModal';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { medicineService, type MedicineCatalogueDetails } from '../../services/medicineService';
import { useGeolocation } from './hooks/useGeolocation';
import { sanitizePhoneNumber } from './utils/routingUtils';
import { ArrowLeft, MapPin, Map, List } from 'lucide-react';
import type { NearbyPharmacyResult, AvailabilityFilter } from './types';

const INITIAL_FILTERS: FilterState = {
  distanceKm: 15,
  availability: [],
  openNow: false,
  sortBy: 'distance',
};

type ViewMode = 'list' | 'map';

export const SearchResults: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawQ = searchParams.get('q');
  const queryParam = rawQ && rawQ.trim() ? rawQ.trim() : 'Paracetamol 500 mg';
  const rawArea = searchParams.get('area');
  const areaParam = rawArea && rawArea.trim() ? rawArea.trim() : 'Dhanmondi, Dhaka';
  const viewParam = (searchParams.get('view') as ViewMode) || 'list';

  const [currentMedicine, setCurrentMedicine] = useState<MedicineCatalogueDetails | null>(null);
  const [results, setResults] = useState<NearbyPharmacyResult[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCallNumber, setActiveCallNumber] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | undefined>(undefined);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [reportingPharmacy, setReportingPharmacy] = useState<NearbyPharmacyResult | null>(null);
  const [alertTargetMedicine, setAlertTargetMedicine] = useState<string | null>(null);

  // Synchronize view mode with URL search param
  const viewMode: ViewMode = viewParam === 'map' ? 'map' : 'list';

  const setViewMode = (mode: ViewMode) => {
    const nextParams = new URLSearchParams(searchParams);
    if (mode === 'map') {
      nextParams.set('view', 'map');
    } else {
      nextParams.delete('view');
    }
    setSearchParams(nextParams);
  };

  // GPS hook
  const geo = useGeolocation();

  const fetchResults = useCallback(
    async (medicineQuery: string, searchArea: string, lat?: number, lng?: number) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { medicine, results: searchResults } = await medicineService.searchNearbyPharmacies({
          query: medicineQuery,
          area: searchArea,
          latitude: lat,
          longitude: lng,
        });

        setCurrentMedicine(medicine);
        setResults(searchResults);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to retrieve nearby pharmacy stock data.';
        setErrorMessage(message);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Trigger fetch on route params change; pass GPS coords if available
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(() => {
      if (!isCancelled) {
        fetchResults(
          queryParam,
          geo.latitude && geo.longitude ? 'Current Location (GPS)' : areaParam,
          geo.latitude ?? undefined,
          geo.longitude ?? undefined
        );
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam, areaParam, fetchResults]);

  // Re-fetch when GPS coords arrive (after user clicks "Use my location")
  useEffect(() => {
    if (geo.latitude && geo.longitude) {
      let isCancelled = false;
      const timer = setTimeout(() => {
        if (!isCancelled) {
          fetchResults(
            queryParam,
            'Current Location (GPS)',
            geo.latitude ?? undefined,
            geo.longitude ?? undefined
          );
        }
      }, 0);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }
  }, [geo.latitude, geo.longitude, queryParam, fetchResults]);

  // Client-side filtering & sorting
  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];

    // Distance filter
    list = list.filter((p) => p.distanceKm <= filters.distanceKm);

    // Availability multi-select
    if (filters.availability.length > 0) {
      list = list.filter((p) =>
        filters.availability.includes(p.stockStatus as AvailabilityFilter)
      );
    }

    // Open now
    if (filters.openNow) {
      list = list.filter((p) => p.isOpen);
    }

    // Sorting
    if (filters.sortBy === 'distance') {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (filters.sortBy === 'freshness') {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (filters.sortBy === 'availability') {
      const rank: Record<string, number> = { available: 1, low: 2, out: 3, unverified: 4 };
      list.sort((a, b) => (rank[a.stockStatus] || 5) - (rank[b.stockStatus] || 5));
    }

    return list;
  }, [results, filters]);

  const handleSearchSubmit = ({ query: newQuery, area: newArea }: { query: string; area: string }) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('q', newQuery);
    if (newArea) nextParams.set('area', newArea);
    setSearchParams(nextParams);
  };

  const handleSelectAlternative = (altQuery: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('q', altQuery);
    setSearchParams(nextParams);
  };

  const handleSelectPharmacy = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
    navigate(`/medicine/${currentMedicine?.id || 'med-paracetamol-500'}?pharmacyId=${pharmacyId}`);
  };

  const handleMapSelectPharmacy = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
  };

  const handleCallPharmacy = (phone: string) => {
    const cleanPhone = sanitizePhoneNumber(phone) || phone;
    setActiveCallNumber(cleanPhone);
    window.location.href = `tel:${cleanPhone}`;
  };

  const handleRequestLocation = () => {
    geo.requestLocation();
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    geo.clearLocationError();
  };

  // Show banner if: not dismissed, no GPS fix yet, and not currently loading GPS
  const showLocationBanner =
    !bannerDismissed && !geo.latitude && !geo.longitude && !geo.isLoading;

  // Effective area label for breadcrumb
  const effectiveAreaLabel =
    geo.latitude && geo.longitude ? 'Current Location (GPS)' : areaParam;

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
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
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
          aria-label="Back to home page"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Home</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          <MapPin size={13} aria-hidden="true" />
          <span>Area: {effectiveAreaLabel}</span>
        </div>
      </div>

      {/* Main Search Bar */}
      <CustomerSearchBar
        initialQuery={queryParam}
        initialArea={areaParam}
        onSearch={handleSearchSubmit}
        onSelectSuggestion={(item) => setCurrentMedicine(item)}
        isLoading={isLoading}
        compact
      />

      {/* GPS Location Request Banner */}
      {showLocationBanner && (
        <LocationRequestBanner
          isLoading={geo.isLoading}
          permissionDenied={geo.permissionDenied}
          error={geo.error}
          onRequestLocation={handleRequestLocation}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Show banner again if GPS errored after user clicked "Use my location" */}
      {!bannerDismissed && geo.isLoading && (
        <LocationRequestBanner
          isLoading={true}
          permissionDenied={false}
          error={null}
          onRequestLocation={handleRequestLocation}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Show error/denied banner if GPS failed */}
      {!bannerDismissed && (geo.error || geo.permissionDenied) && !geo.isLoading && (
        <LocationRequestBanner
          isLoading={false}
          permissionDenied={geo.permissionDenied}
          error={geo.error}
          onRequestLocation={handleRequestLocation}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Medicine Catalogue Card */}
      {currentMedicine && (
        <MedicineCatalogueCard
          medicine={currentMedicine}
          onSelectAlternative={handleSelectAlternative}
        />
      )}

      {/* Mandatory Patient Safety Notice */}
      <DisclaimerBanner variant="inline" />

      {/* Main Content Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Filters Sidebar */}
        <div style={{ maxWidth: '300px', width: '100%' }}>
          <SearchFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(INITIAL_FILTERS)}
            totalResultsCount={filteredAndSortedResults.length}
          />
        </div>

        {/* Results: Map / List toggle + content */}
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Map / List Toggle */}
          <div
            role="group"
            aria-label="Switch between map and list view"
            style={{
              display: 'inline-flex',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--color-border-default)',
              alignSelf: 'flex-start',
            }}
          >
            <button
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'list' ? 'var(--color-action-primary)' : 'var(--color-surface-panel)',
                color: viewMode === 'list' ? '#fff' : 'var(--color-text-secondary)',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <List size={14} aria-hidden="true" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              aria-label="Map view"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                borderLeft: '1px solid var(--color-border-default)',
                cursor: 'pointer',
                backgroundColor: viewMode === 'map' ? 'var(--color-action-primary)' : 'var(--color-surface-panel)',
                color: viewMode === 'map' ? '#fff' : 'var(--color-text-secondary)',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              <Map size={14} aria-hidden="true" />
              <span>Map</span>
            </button>
          </div>

          {/* Content: either List or Map — same filteredAndSortedResults feed */}
          {viewMode === 'list' ? (
            <SearchResultsList
              results={filteredAndSortedResults}
              isLoading={isLoading}
              errorMessage={errorMessage}
              searchQuery={queryParam}
              onRetry={() => fetchResults(queryParam, areaParam)}
              onSelectPharmacy={handleSelectPharmacy}
              onCallPharmacy={handleCallPharmacy}
              onSelectAlternative={handleSelectAlternative}
              onReportDiscrepancy={(pharmacy) => setReportingPharmacy(pharmacy)}
              onSubscribeAlert={(query) => setAlertTargetMedicine(query)}
            />
          ) : (
            <CustomerMapView
              results={filteredAndSortedResults}
              selectedPharmacyId={selectedPharmacyId}
              onSelectPharmacy={handleMapSelectPharmacy}
              onCallPharmacy={handleCallPharmacy}
              centerLatitude={geo.latitude ?? undefined}
              centerLongitude={geo.longitude ?? undefined}
            />
          )}
        </div>
      </div>

      {/* Discrepancy Reporting Modal */}
      {reportingPharmacy && (
        <ReportDiscrepancyModal
          pharmacy={reportingPharmacy}
          medicineName={currentMedicine?.name || queryParam}
          medicineId={currentMedicine?.id || 'unknown'}
          isOpen={true}
          onClose={() => setReportingPharmacy(null)}
        />
      )}

      {/* Stock Restock Alert Modal */}
      {alertTargetMedicine && (
        <StockAlertModal
          medicineName={currentMedicine?.name || alertTargetMedicine}
          genericName={currentMedicine?.genericName}
          strength={currentMedicine?.strength}
          area={areaParam}
          isOpen={true}
          onClose={() => setAlertTargetMedicine(null)}
        />
      )}

      {/* Accessibility screen-reader announcement */}
      {activeCallNumber && (
        <div role="status" className="sr-only">
          Calling pharmacy at {activeCallNumber}
        </div>
      )}
    </div>
  );
};
