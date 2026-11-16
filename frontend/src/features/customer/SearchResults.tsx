// frontend/src/features/customer/SearchResults.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CustomerSearchBar } from './components/CustomerSearchBar';
import { MedicineCatalogueCard } from './components/MedicineCatalogueCard';
import { SearchResultsList } from './components/SearchResultsList';
import { SearchFilterBar, type FilterState } from './components/SearchFilterBar';
import { DisclaimerBanner } from '../../components/DisclaimerBanner';
import { medicineService, type MedicineCatalogueDetails } from '../../services/medicineService';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { NearbyPharmacyResult, AvailabilityFilter } from './types';

const INITIAL_FILTERS: FilterState = {
  distanceKm: 15,
  availability: [],
  openNow: false,
  sortBy: 'distance',
};

export const SearchResults: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get('q') || 'Paracetamol 500 mg';
  const areaParam = searchParams.get('area') || 'Dhanmondi, Dhaka';

  const [currentMedicine, setCurrentMedicine] = useState<MedicineCatalogueDetails | null>(null);
  const [results, setResults] = useState<NearbyPharmacyResult[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCallNumber, setActiveCallNumber] = useState<string | null>(null);

  const fetchResults = useCallback(async (medicineQuery: string, searchArea: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { medicine, results: searchResults } = await medicineService.searchNearbyPharmacies({
        query: medicineQuery,
        area: searchArea,
      });

      setCurrentMedicine(medicine);
      setResults(searchResults);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve nearby pharmacy stock data.';
      setErrorMessage(message);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(() => {
      if (!isCancelled) {
        fetchResults(queryParam, areaParam);
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [queryParam, areaParam, fetchResults]);

  // Client-side filtering & sorting
  const filteredAndSortedResults = useMemo(() => {
    let list = [...results];

    // Distance filter
    list = list.filter((p) => p.distanceKm <= filters.distanceKm);

    // Availability multi-select
    if (filters.availability.length > 0) {
      list = list.filter((p) => filters.availability.includes(p.stockStatus as AvailabilityFilter));
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
    navigate(`/medicine/${currentMedicine?.id || 'med-paracetamol-500'}?pharmacyId=${pharmacyId}`);
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
          <span>Area: {areaParam}</span>
        </div>
      </div>

      {/* Main Search Bar with live autocomplete */}
      <CustomerSearchBar
        initialQuery={queryParam}
        initialArea={areaParam}
        onSearch={handleSearchSubmit}
        onSelectSuggestion={(item) => setCurrentMedicine(item)}
        isLoading={isLoading}
        compact
      />

      {/* Medicine Catalogue Card (Shows generic name, form, strength & catalogue verification badge) */}
      {currentMedicine && (
        <MedicineCatalogueCard
          medicine={currentMedicine}
          onSelectAlternative={handleSelectAlternative}
        />
      )}

      {/* Mandatory Patient Safety Notice */}
      <DisclaimerBanner variant="inline" />

      {/* Main Content Layout: Filters Sidebar (Left) + Search Results (Right) */}
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

        {/* Results List */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <SearchResultsList
            results={filteredAndSortedResults}
            isLoading={isLoading}
            errorMessage={errorMessage}
            searchQuery={queryParam}
            onRetry={() => fetchResults(queryParam, areaParam)}
            onSelectPharmacy={handleSelectPharmacy}
            onCallPharmacy={handleCallPharmacy}
            onSelectAlternative={handleSelectAlternative}
          />
        </div>
      </div>

      {/* Accessibility screen-reader announcement */}
      {activeCallNumber && (
        <div role="status" className="sr-only">
          Calling pharmacy at {activeCallNumber}
        </div>
      )}
    </div>
  );
};
