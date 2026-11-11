// src/config/constants.ts

export const DEFAULT_LATITUDE = Number(import.meta.env.VITE_DEFAULT_LAT) || 23.8103;
export const DEFAULT_LONGITUDE = Number(import.meta.env.VITE_DEFAULT_LNG) || 90.4125;

export const PRESET_LOCATIONS = [
  { name: 'Dhaka Central', lat: 23.8103, lng: 90.4125 },
  { name: 'Dhanmondi', lat: 23.7465, lng: 90.376 },
  { name: 'Gulshan 2', lat: 23.7925, lng: 90.4178 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Chattogram', lat: 22.3569, lng: 91.7832 },
  { name: 'Sylhet', lat: 24.8949, lng: 91.8687 },
] as const;

