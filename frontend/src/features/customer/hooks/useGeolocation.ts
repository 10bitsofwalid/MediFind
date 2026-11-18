// frontend/src/features/customer/hooks/useGeolocation.ts
import { useState, useCallback } from 'react';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isLoading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    isLoading: false,
    error: null,
    permissionDenied: false,
  });

  const requestLocation = useCallback(
    (onSuccess?: (coords: { lat: number; lng: number }) => void, onError?: (err: string) => void) => {
      if (!navigator.geolocation) {
        const errMsg = 'Geolocation is not supported by your browser. Please enter your area manually.';
        setState({
          latitude: null,
          longitude: null,
          accuracy: null,
          isLoading: false,
          error: errMsg,
          permissionDenied: false,
        });
        if (onError) onError(errMsg);
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null, permissionDenied: false }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          setState({
            latitude: lat,
            longitude: lng,
            accuracy,
            isLoading: false,
            error: null,
            permissionDenied: false,
          });

          if (onSuccess) onSuccess({ lat, lng });
        },
        (error) => {
          let errMsg = 'Unable to determine your location. Please enter your area manually.';
          let isDenied = false;

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errMsg = 'Location permission was denied. Please type your area name (e.g. Dhanmondi, Dhaka).';
              isDenied = true;
              break;
            case error.POSITION_UNAVAILABLE:
              errMsg = 'GPS signal unavailable. Please type your area name manually.';
              break;
            case error.TIMEOUT:
              errMsg = 'Location request timed out. Please type your area name manually.';
              break;
          }

          setState({
            latitude: null,
            longitude: null,
            accuracy: null,
            isLoading: false,
            error: errMsg,
            permissionDenied: isDenied,
          });

          if (onError) onError(errMsg);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    },
    []
  );

  const clearLocationError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocationError,
  };
}
