// frontend/src/features/customer/utils/geoUtils.ts

/**
 * Standard known area coordinates in Dhaka for manual area text fallback
 */
export const DHAKA_AREA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  dhanmondi: { lat: 23.7461, lng: 90.3742 },
  gulshan: { lat: 23.7925, lng: 90.4078 },
  banani: { lat: 23.7937, lng: 90.4043 },
  mirpur: { lat: 23.8071, lng: 90.3686 },
  uttara: { lat: 23.8759, lng: 90.3795 },
  mohammadpur: { lat: 23.7542, lng: 90.3616 },
  motijheel: { lat: 23.7331, lng: 90.4175 },
  shahbagh: { lat: 23.7388, lng: 90.3956 },
  badda: { lat: 23.7806, lng: 90.4267 },
};

export const DEFAULT_DHAKA_COORDS = { lat: 23.7461, lng: 90.3742 };

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place (e.g. 1.2 km)
}

/**
 * Resolves coordinates from an area name string.
 */
export function resolveAreaCoordinates(areaText?: string): { lat: number; lng: number } {
  if (!areaText) return DEFAULT_DHAKA_COORDS;
  const lower = areaText.toLowerCase();

  for (const [key, coords] of Object.entries(DHAKA_AREA_COORDINATES)) {
    if (lower.includes(key)) {
      return coords;
    }
  }

  return DEFAULT_DHAKA_COORDS;
}

