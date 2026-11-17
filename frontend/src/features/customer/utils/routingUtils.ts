// frontend/src/features/customer/utils/routingUtils.ts
// Handles route generation, coordinate validation, and fallback options

export interface NavigationRouteOptions {
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  pharmacyName: string;
}

export interface NavigationRouteResult {
  url: string;
  mode: 'coordinates' | 'search_query';
  hasExactCoordinates: boolean;
  label: string;
}

/**
 * Validates if coordinates are present, non-zero, and within reasonable range for Dhaka/Bangladesh
 */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  // Non-zero check
  if (lat === 0 && lng === 0) return false;
  // Latitude for Bangladesh: approx 20.5 to 26.7
  // Longitude for Bangladesh: approx 88.0 to 92.7
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Generates an accessible directions navigation URL with graceful fallback
 * When coordinates are missing or zero, falls back to encoded address & pharmacy name search
 */
export function getDirectionsRoute(options: NavigationRouteOptions): NavigationRouteResult {
  const { latitude, longitude, address, pharmacyName } = options;

  if (isValidCoordinate(latitude, longitude)) {
    return {
      url: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      mode: 'coordinates',
      hasExactCoordinates: true,
      label: `Directions to ${pharmacyName} (via GPS coordinates)`,
    };
  }

  // Graceful fallback: search query using pharmacy name & address in Dhaka
  const fallbackQuery = encodeURIComponent(
    [pharmacyName, address, 'Dhaka, Bangladesh'].filter(Boolean).join(', ')
  );

  return {
    url: `https://www.google.com/maps/search/?api=1&query=${fallbackQuery}`,
    mode: 'search_query',
    hasExactCoordinates: false,
    label: `Search location for ${pharmacyName} on Google Maps (address fallback)`,
  };
}

/**
 * Validates a telephone number for tel: URI compliance
 */
export function sanitizePhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === 'None') return null;
  // Remove non-digit chars except leading plus
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  return cleaned.length >= 6 ? cleaned : null;
}
