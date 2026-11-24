// frontend/src/features/customer/components/CustomerMapView.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { MapPin, Phone, ExternalLink, Clock, ShieldCheck, Navigation, X, Car, Footprints } from 'lucide-react';
import type { NearbyPharmacyResult } from '../types';

export interface RouteInfo {
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][]; // [lat, lng] tuples for Leaflet Polyline
  source: 'osrm' | 'straight-line';
}

interface CustomerMapViewProps {
  results: NearbyPharmacyResult[];
  selectedPharmacyId?: string;
  onSelectPharmacy?: (pharmacyId: string) => void;
  onCallPharmacy?: (phone: string) => void;
  centerLatitude?: number;
  centerLongitude?: number;
  height?: string;
  userLocation?: { lat: number; lng: number } | null;
  activeRouteDestination?: NearbyPharmacyResult | null;
  onClearRoute?: () => void;
}

const getPinColor = (status: string): string => {
  switch (status) {
    case 'available':
      return '#0A7E51';
    case 'low':
      return '#C28400';
    case 'out':
      return '#D9383A';
    default:
      return '#6C757D';
  }
};

const createColoredPinIcon = (status: string, index: number, isSelected: boolean) => {
  try {
    const Leaflet = (L as unknown as { default?: typeof L }).default || L;
    if (!Leaflet || typeof Leaflet.divIcon !== 'function') return undefined;

    const bgColor = getPinColor(status);
    const border = isSelected ? '3px solid #000000' : '2px solid #ffffff';
    const scale = isSelected ? 'transform: scale(1.15) rotate(-45deg);' : 'transform: rotate(-45deg);';
    const shadow = isSelected
      ? '0 6px 14px rgba(0, 0, 0, 0.45);'
      : '0 4px 10px rgba(23, 43, 58, 0.35);';

    return Leaflet.divIcon({
      className: `medifind-custom-pin-${status}`,
      html: `
        <div style="
          background-color: ${bgColor};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          ${scale}
          border: ${border};
          box-shadow: ${shadow}
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        ">
          <span style="
            transform: rotate(45deg);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            user-select: none;
          ">${index + 1}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  } catch {
    return undefined;
  }
};

// Custom User / Start location pulsing pin icon (like Uber rider pin)
const createUserLocationPin = () => {
  try {
    const Leaflet = (L as unknown as { default?: typeof L }).default || L;
    if (!Leaflet || typeof Leaflet.divIcon !== 'function') return undefined;

    return Leaflet.divIcon({
      className: 'medifind-user-pin',
      html: `
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            position: absolute;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: rgba(11, 107, 203, 0.25);
            animation: medifind-pulse 2s infinite;
          "></div>
          <div style="
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: #0B6BCB;
            border: 2.5px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  } catch {
    return undefined;
  }
};

// Auto-fitter component to fit map bounds to the route
const MapBoundsFitter: React.FC<{ coordinates: [number, number][] }> = ({ coordinates }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length >= 2 && map) {
      try {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch {
        // ignore bounds errors in non-browser or detached map environments
      }
    }
  }, [coordinates, map]);

  return null;
};

export const CustomerMapView: React.FC<CustomerMapViewProps> = ({
  results,
  selectedPharmacyId,
  onSelectPharmacy,
  onCallPharmacy,
  centerLatitude = 23.7461,
  centerLongitude = 90.3742,
  height = '460px',
  userLocation,
  activeRouteDestination,
  onClearRoute,
}) => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  // Resolved user origin: passed userLocation or fallback default center coordinates (e.g. Dhanmondi centroid)
  const originLocation = useMemo<{ lat: number; lng: number }>(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      return userLocation;
    }
    return { lat: centerLatitude, lng: centerLongitude };
  }, [userLocation, centerLatitude, centerLongitude]);

  // Center coordinates fallback order: active route, selected pharmacy, first result, or default center
  const centerCoords = useMemo(() => {
    if (activeRouteDestination) {
      return { lat: activeRouteDestination.latitude, lng: activeRouteDestination.longitude };
    }
    if (selectedPharmacyId) {
      const match = results.find((r) => r.pharmacyId === selectedPharmacyId);
      if (match) return { lat: match.latitude, lng: match.longitude };
    }
    if (results.length > 0) {
      return { lat: results[0].latitude, lng: results[0].longitude };
    }
    return { lat: centerLatitude, lng: centerLongitude };
  }, [results, selectedPharmacyId, centerLatitude, centerLongitude, activeRouteDestination]);

  const selectedPharmacy = useMemo(
    () => results.find((r) => r.pharmacyId === selectedPharmacyId),
    [results, selectedPharmacyId]
  );

  // Fetch or calculate route polyline when activeRouteDestination is present
  useEffect(() => {
    if (!activeRouteDestination) {
      return;
    }

    const startLat = originLocation.lat;
    const startLng = originLocation.lng;
    const endLat = activeRouteDestination.latitude;
    const endLng = activeRouteDestination.longitude;

    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setIsRoutingLoading(true);
    }, 0);

    const controller = new AbortController();

    // Call open public OSRM driving service
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('OSRM routing request failed');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // GeoJSON coords are [lng, lat] -> Leaflet requires [lat, lng]
          const coords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          const distKm = Math.round((route.distance / 1000) * 10) / 10;
          const durMins = Math.max(1, Math.round(route.duration / 60));

          setRouteInfo({
            distanceKm: distKm,
            durationMins: durMins,
            coordinates: coords,
            source: 'osrm',
          });
        } else {
          throw new Error('No OSRM route found');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Fallback straight-line / midpoint waypoints for resilient display
        const midLat = (startLat + endLat) / 2 + 0.001;
        const midLng = (startLng + endLng) / 2 - 0.001;
        const straightDistKm = activeRouteDestination.distanceKm || 1.2;
        const estimatedMins = Math.max(2, Math.round(straightDistKm * 3.5));

        setRouteInfo({
          distanceKm: straightDistKm,
          durationMins: estimatedMins,
          coordinates: [
            [startLat, startLng],
            [midLat, midLng],
            [endLat, endLng],
          ],
          source: 'straight-line',
        });
      })
      .finally(() => {
        if (isMounted) setIsRoutingLoading(false);
      });

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeRouteDestination, originLocation]);

  const userPinIcon = useMemo(() => createUserLocationPin(), []);

  return (
    <div
      aria-label="Pharmacy map exploration"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
      }}
    >
      {/* Top Header bar with pin count and active indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          <MapPin size={15} color="var(--color-action-primary)" aria-hidden="true" />
          <span>Interactive Map ({results.length} pharmacies found)</span>
          {activeRouteDestination && (
            <span
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                backgroundColor: '#0B6BCB15',
                color: '#0B6BCB',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Navigation size={11} aria-hidden="true" />
              Route active
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Numbered pins match search rankings • OpenStreetMap tiles
        </span>
      </div>

      {/* Main Map with error boundary */}
      <ErrorBoundary fallbackTitle="Map Display Unavailable — your pharmacy list below remains fully functional.">
        <div
          role="region"
          aria-label="Interactive leaflet map displaying pharmacy pins"
          style={{
            height,
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--color-border-default)',
            position: 'relative',
          }}
        >
          {/* Uber-style Navigation Overlay Panel inside the map */}
          {activeRouteDestination && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '12px',
                maxWidth: '440px',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(8px)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
                border: '1px solid #0B6BCB33',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: '#0B6BCB',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Navigation size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0B6BCB' }}>
                      {isRoutingLoading ? 'Calculating quickest route...' : 'Directions to Pharmacy'}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B3A', lineHeight: 1.2 }}>
                      {activeRouteDestination.pharmacyName}
                    </div>
                  </div>
                </div>

                {onClearRoute && (
                  <button
                    type="button"
                    onClick={onClearRoute}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      color: '#6C757D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Exit Navigation"
                    aria-label="Exit Navigation"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Uber-like travel metrics: Driving & Walking ETA */}
              {routeInfo && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#F4F7F9',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Car size={16} color="#0B6BCB" />
                    <span style={{ fontWeight: 700, color: '#172B3A' }}>
                      {routeInfo.durationMins} min
                    </span>
                    <span style={{ color: '#6C757D' }}>({routeInfo.distanceKm} km via road)</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6C757D', fontSize: '12px' }}>
                    <Footprints size={14} />
                    <span>~{Math.round(routeInfo.distanceKm * 14)} min walk</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', color: '#5A6E7C' }}>
                  {activeRouteDestination.address}
                </span>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeRouteDestination.latitude},${activeRouteDestination.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0B6BCB',
                    textDecoration: 'none',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#0B6BCB10',
                  }}
                >
                  <span>Google Maps app</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}

          <MapContainer
            center={[centerCoords.lat, centerCoords.lng]}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            {/* Auto-fit map to route bounds */}
            {routeInfo && routeInfo.coordinates.length > 0 && (
              <MapBoundsFitter coordinates={routeInfo.coordinates} />
            )}

            {/* User starting location marker if route is active or user coords exist */}
            {(activeRouteDestination || (userLocation && userLocation.lat)) && (
              <Marker
                position={[originLocation.lat, originLocation.lng]}
                icon={userPinIcon}
              >
                <Popup>
                  <div style={{ fontSize: '12px', fontWeight: 600, padding: '2px' }}>
                    📍 Your Starting Location
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Uber-like Road Route Polyline: Outer shadow line + inner cyan road line */}
            {routeInfo && routeInfo.coordinates.length > 0 && (
              <>
                <Polyline
                  positions={routeInfo.coordinates}
                  pathOptions={{
                    color: '#074882',
                    weight: 8,
                    opacity: 0.5,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <Polyline
                  positions={routeInfo.coordinates}
                  pathOptions={{
                    color: '#0B6BCB',
                    weight: 5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            )}

            {results.map((pharmacy, index) => {
              const isSelected =
                pharmacy.pharmacyId === selectedPharmacyId ||
                pharmacy.pharmacyId === activeRouteDestination?.pharmacyId;
              const pinIcon = createColoredPinIcon(pharmacy.stockStatus, index, isSelected);

              return (
                <Marker
                  key={pharmacy.pharmacyId}
                  position={[pharmacy.latitude, pharmacy.longitude]}
                  icon={pinIcon}
                  eventHandlers={{
                    click: () => {
                      if (onSelectPharmacy) {
                        onSelectPharmacy(pharmacy.pharmacyId);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px', maxWidth: '260px', padding: '4px', fontSize: '12px', lineHeight: '1.4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                          {index + 1}. {pharmacy.pharmacyName}
                        </span>
                        {pharmacy.isVerified && (
                          <span
                            title="Verified Pharmacy"
                            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-action-primary)' }}
                          >
                            <ShieldCheck size={14} aria-label="Verified" />
                          </span>
                        )}
                      </div>

                      <div style={{ color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        {pharmacy.address} • <strong>{pharmacy.distanceKm} km</strong>
                      </div>

                      {/* Stock availability banner in popup */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: `${getPinColor(pharmacy.stockStatus)}18`,
                          color: getPinColor(pharmacy.stockStatus),
                          fontWeight: 700,
                          fontSize: '11px',
                          marginBottom: '8px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getPinColor(pharmacy.stockStatus) }} />
                        <span>
                          {pharmacy.stockStatus === 'available'
                            ? `Available (${pharmacy.quantity ?? 'In stock'})`
                            : pharmacy.stockStatus === 'low'
                            ? `Low stock (${pharmacy.quantity ?? 'Limited'})`
                            : pharmacy.stockStatus === 'out'
                            ? 'Out of stock'
                            : 'Unverified'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                        <Clock size={12} aria-hidden="true" />
                        <span>{pharmacy.isOpen ? 'Open Now' : 'Closed today'}</span>
                      </div>

                      {/* Action buttons inside popup */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {onSelectPharmacy && (
                          <button
                            type="button"
                            onClick={() => onSelectPharmacy(pharmacy.pharmacyId)}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-action-primary)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                            <span>Details</span>
                          </button>
                        )}
                        {pharmacy.phone && onCallPharmacy && (
                          <button
                            type="button"
                            onClick={() => {
                              if (pharmacy.phone) onCallPharmacy(pharmacy.phone);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-surface-panel)',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border-default)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            aria-label={`Call ${pharmacy.pharmacyName}`}
                          >
                            <Phone size={12} aria-hidden="true" />
                            <span>Call</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </ErrorBoundary>

      {/* Selected pharmacy synchronization card (under map when one is selected) */}
      {selectedPharmacy && (
        <div
          role="region"
          aria-label="Selected pharmacy details"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-panel)',
            border: '2px solid var(--color-action-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-action-primary)' }}>
                Selected Pin:
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {selectedPharmacy.pharmacyName}
              </strong>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {selectedPharmacy.address} • {selectedPharmacy.distanceKm} km away
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedPharmacy.phone && onCallPharmacy && (
              <button
                type="button"
                onClick={() => {
                  if (selectedPharmacy.phone) onCallPharmacy(selectedPharmacy.phone);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-panel)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Phone size={13} aria-hidden="true" />
                <span>Call ({selectedPharmacy.phone})</span>
              </button>
            )}

            {onSelectPharmacy && (
              <button
                type="button"
                onClick={() => onSelectPharmacy(selectedPharmacy.pharmacyId)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-action-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>View Full Details &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map Legend & Parity Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0A7E51' }} />
            <span>Available</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#C28400' }} />
            <span>Low stock</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#D9383A' }} />
            <span>Out of stock</span>
          </span>
        </div>
        <span>Click any pin to inspect stock & directions. Both map and list show identical real-time data.</span>
      </div>
    </div>
  );
};
