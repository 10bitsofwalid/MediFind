// backend/src/validation/pharmacyValidators.ts
import type {
  LocationGeoJSON,
  PharmacyApplicationPayload,
  PharmacyProfileUpdatePayload,
} from '../types/pharmacy';
import {
  formatWeeklyHours,
  normalizeLicenseNo,
  validateEmail,
  validateLocation,
  validatePhone,
  validatePostalCode,
  validateWeeklyHoursSchedule,
} from './commonValidators';
import { ValidationError } from './validationError';

/**
 * Validates the submission payload for POST /owner/pharmacy-applications or PATCH /owner/pharmacy-application.
 * Throws a ValidationError (HTTP 422) containing field-level messages if invalid.
 */
export function validatePharmacyApplicationPayload(
  payload: unknown
): PharmacyApplicationPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Application payload must be a non-null object.');
  }

  const data = payload as Record<string, unknown>;
  const fields: Record<string, string> = {};

  // 1. Business & Owner Name
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    fields.name = 'Pharmacy trade name is required.';
  } else if (name.length < 3) {
    fields.name = 'Pharmacy name must be at least 3 characters.';
  }

  const ownerName = typeof data.ownerName === 'string' ? data.ownerName.trim() : '';
  if (!ownerName) {
    fields.ownerName = 'Owner / contact person name is required.';
  } else if (ownerName.length < 2) {
    fields.ownerName = 'Owner name must be at least 2 characters.';
  }

  // 2. Phone & Email
  const phoneErr = validatePhone(data.phone);
  if (phoneErr) fields.phone = phoneErr;

  const emailErr = validateEmail(data.email);
  if (emailErr) fields.email = emailErr;

  // 3. Address fields
  const streetAddress = typeof data.streetAddress === 'string' ? data.streetAddress.trim() : '';
  if (!streetAddress) {
    fields.streetAddress = 'Street address and building details are required.';
  }

  const city = typeof data.city === 'string' ? data.city.trim() : '';
  if (!city) {
    fields.city = 'City or district is required.';
  }

  const area = typeof data.area === 'string' ? data.area.trim() : '';
  if (!area) {
    fields.area = 'Area / locality name is required.';
  }

  const postalCodeErr = validatePostalCode(data.postalCode);
  if (postalCodeErr) fields.postalCode = postalCodeErr;

  // 4. Regulatory License fields
  const licenseNo = typeof data.licenseNo === 'string' ? data.licenseNo.trim() : '';
  if (!licenseNo) {
    fields.licenseNo = 'DGDA drug licence number is required.';
  }

  const issuingAuthority = typeof data.issuingAuthority === 'string' ? data.issuingAuthority.trim() : '';
  if (!issuingAuthority) {
    fields.issuingAuthority = 'Licensing authority is required.';
  }

  const licenseExpiryDate = typeof data.licenseExpiryDate === 'string' ? data.licenseExpiryDate.trim() : undefined;
  if (licenseExpiryDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiryDate) || Number.isNaN(new Date(licenseExpiryDate).getTime())) {
      fields.licenseExpiryDate = 'License expiry date must be a valid date in YYYY-MM-DD format.';
    }
  }

  // 5. Coordinates & Location
  const locErrors = validateLocation(data.location, data.latitude, data.longitude);
  Object.assign(fields, locErrors);

  let lat = typeof data.latitude === 'number' ? data.latitude : Number(data.latitude);
  let lng = typeof data.longitude === 'number' ? data.longitude : Number(data.longitude);

  if (data.location && typeof data.location === 'object') {
    const locObj = data.location as Record<string, unknown>;
    if (Array.isArray(locObj.coordinates) && locObj.coordinates.length >= 2) {
      if (!Number.isFinite(lng)) lng = Number(locObj.coordinates[0]);
      if (!Number.isFinite(lat)) lat = Number(locObj.coordinates[1]);
    }
  }

  if (Number.isNaN(lat) || !Number.isFinite(lat)) {
    if (!fields.latitude) fields.latitude = 'Latitude must be between -90 and 90.';
  }
  if (Number.isNaN(lng) || !Number.isFinite(lng)) {
    if (!fields.longitude) fields.longitude = 'Longitude must be between -180 and 180.';
  }

  // 6. Operating Hours
  const structuredHours =
    data.structuredHours && typeof data.structuredHours === 'object'
      ? (data.structuredHours as any)
      : undefined;

  let openingHours = typeof data.openingHours === 'string' ? data.openingHours.trim() : '';

  if (structuredHours) {
    const hoursErrors = validateWeeklyHoursSchedule(structuredHours, 'openingHours');
    Object.assign(fields, hoursErrors);
    if (!openingHours) {
      openingHours = formatWeeklyHours(structuredHours);
    }
  } else if (!openingHours) {
    fields.openingHours = 'Operating hours schedule is required.';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Please review the highlighted fields.', fields);
  }

  const postalCode = typeof data.postalCode === 'string' && data.postalCode.trim() ? data.postalCode.trim() : undefined;
  const formattedAddress =
    typeof data.formattedAddress === 'string' && data.formattedAddress.trim()
      ? data.formattedAddress.trim()
      : [streetAddress, area, city, postalCode].filter(Boolean).join(', ');

  const location =
    data.location && typeof data.location === 'object' && (data.location as any).type === 'Point'
      ? (data.location as any)
      : {
          type: 'Point' as const,
          coordinates: [lng, lat] as [number, number],
        };

  return {
    name,
    ownerName,
    phone: data.phone as string,
    email: (data.email as string).trim().toLowerCase(),
    streetAddress,
    city,
    area,
    postalCode,
    formattedAddress,
    licenseNo,
    issuingAuthority,
    licenseExpiryDate,
    licenseType: typeof data.licenseType === 'string' ? data.licenseType.trim() : undefined,
    latitude: lat,
    longitude: lng,
    location,
    openingHours,
    structuredHours,
    notes: typeof data.notes === 'string' ? data.notes.trim() : undefined,
  };
}

/**
 * Validates updates to an existing pharmacy profile.
 * Rejects modifications to protected regulatory licence fields.
 * Throws a ValidationError (HTTP 422) if fields are invalid.
 */
export function validatePharmacyProfileUpdatePayload(
  payload: unknown
): PharmacyProfileUpdatePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Profile update payload must be a non-null object.');
  }

  const data = payload as Record<string, unknown>;
  const fields: Record<string, string> = {};

  // Protected fields cannot be modified via standard profile update
  if (data.licenseNo !== undefined) {
    fields.licenseNo = 'Drug licence number is protected and cannot be modified via standard profile update.';
  }
  if (data.normalizedLicenseNo !== undefined) {
    fields.normalizedLicenseNo = 'Drug licence number is protected and cannot be modified via standard profile update.';
  }
  if (data.issuingAuthority !== undefined) {
    fields.issuingAuthority = 'Issuing authority is protected and cannot be modified via standard profile update.';
  }
  if (data.licenseExpiryDate !== undefined) {
    fields.licenseExpiryDate = 'License expiry date is protected and cannot be modified via standard profile update.';
  }
  if (data.licenseType !== undefined) {
    fields.licenseType = 'License type is protected and cannot be modified via standard profile update.';
  }

  // Optional Name
  if (data.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) fields.name = 'Pharmacy trade name is required.';
    else if (name.length < 3) fields.name = 'Pharmacy name must be at least 3 characters.';
  }

  // Optional Owner Name
  if (data.ownerName !== undefined) {
    const ownerName = typeof data.ownerName === 'string' ? data.ownerName.trim() : '';
    if (!ownerName) fields.ownerName = 'Owner / contact person name is required.';
    else if (ownerName.length < 2) fields.ownerName = 'Owner name must be at least 2 characters.';
  }

  // Optional Phone
  if (data.phone !== undefined) {
    const phoneErr = validatePhone(data.phone);
    if (phoneErr) fields.phone = phoneErr;
  }

  // Optional Email
  if (data.email !== undefined) {
    const emailErr = validateEmail(data.email);
    if (emailErr) fields.email = emailErr;
  }

  // Address fields
  if (data.streetAddress !== undefined) {
    const street = typeof data.streetAddress === 'string' ? data.streetAddress.trim() : '';
    if (!street) fields.streetAddress = 'Street address and building details are required.';
  }
  if (data.city !== undefined) {
    const city = typeof data.city === 'string' ? data.city.trim() : '';
    if (!city) fields.city = 'City or district is required.';
  }
  if (data.area !== undefined) {
    const area = typeof data.area === 'string' ? data.area.trim() : '';
    if (!area) fields.area = 'Area / locality name is required.';
  }
  if (data.postalCode !== undefined) {
    const postalErr = validatePostalCode(data.postalCode);
    if (postalErr) fields.postalCode = postalErr;
  }

  // Coordinates & Location
  if (data.location !== undefined || data.latitude !== undefined || data.longitude !== undefined) {
    const locErrors = validateLocation(data.location, data.latitude, data.longitude);
    Object.assign(fields, locErrors);
  }

  // Operating Hours
  const structured = data.structuredHours !== undefined
    ? data.structuredHours
    : (data.openingHours && typeof data.openingHours === 'object' ? data.openingHours : undefined);

  if (structured !== undefined) {
    const hoursErrors = validateWeeklyHoursSchedule(structured, 'structuredHours');
    Object.assign(fields, hoursErrors);
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Please review the highlighted fields.', fields);
  }

  let lat = typeof data.latitude === 'number' ? data.latitude : data.latitude ? Number(data.latitude) : undefined;
  let lng = typeof data.longitude === 'number' ? data.longitude : data.longitude ? Number(data.longitude) : undefined;
  let location = data.location as LocationGeoJSON | undefined;

  if (location && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    if (lng === undefined) lng = Number(location.coordinates[0]);
    if (lat === undefined) lat = Number(location.coordinates[1]);
  } else if (lat !== undefined && lng !== undefined) {
    location = {
      type: 'Point',
      coordinates: [lng, lat],
    };
  }

  return {
    name: typeof data.name === 'string' ? data.name.trim() : undefined,
    ownerName: typeof data.ownerName === 'string' ? data.ownerName.trim() : undefined,
    phone: typeof data.phone === 'string' ? data.phone.trim() : undefined,
    email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : undefined,
    streetAddress: typeof data.streetAddress === 'string' ? data.streetAddress.trim() : undefined,
    city: typeof data.city === 'string' ? data.city.trim() : undefined,
    area: typeof data.area === 'string' ? data.area.trim() : undefined,
    postalCode: typeof data.postalCode === 'string' ? data.postalCode.trim() : undefined,
    formattedAddress: typeof data.formattedAddress === 'string' ? data.formattedAddress.trim() : undefined,
    address: typeof data.address === 'string' ? data.address.trim() : undefined,
    latitude: lat,
    longitude: lng,
    location,
    openingHours: typeof data.openingHours === 'string' ? data.openingHours.trim() : undefined,
    structuredHours: structured as any,
  };
}
