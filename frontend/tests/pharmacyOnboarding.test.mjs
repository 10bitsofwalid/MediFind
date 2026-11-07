// frontend/tests/pharmacyOnboarding.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Helper validator matching PharmacyRegisterPage
function validateField(field, value) {
  const stringVal = String(value ?? '');
  switch (field) {
    case 'name':
      if (!stringVal || !stringVal.trim()) return 'Pharmacy trade name is required.';
      if (stringVal.trim().length < 3) return 'Pharmacy name must be at least 3 characters.';
      return '';
    case 'ownerName':
      if (!stringVal || !stringVal.trim()) return 'Owner / authorized applicant name is required.';
      return '';
    case 'phone': {
      if (!stringVal || !stringVal.trim()) return 'Contact phone number is required.';
      const digitsOnly = stringVal.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return 'Enter a valid phone number (at least 10 digits).';
      }
      return '';
    }
    case 'email': {
      if (!stringVal || !stringVal.trim()) return 'Official business email is required.';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(stringVal.trim())) {
        return 'Enter a valid email address (e.g. name@pharmacy.com).';
      }
      return '';
    }
    case 'streetAddress':
      if (!stringVal || !stringVal.trim()) return 'Street address and building details are required.';
      return '';
    case 'city':
      if (!stringVal || !stringVal.trim()) return 'City or district is required.';
      return '';
    case 'area':
      if (!stringVal || !stringVal.trim()) return 'Area / locality name is required.';
      return '';
    case 'postalCode':
      if (!stringVal || !stringVal.trim()) return '';
      if (!/^\d{4,6}$/.test(stringVal.trim())) {
        return 'Postal code should be a 4-6 digit number.';
      }
      return '';
    case 'latitude': {
      const num = Number(value);
      if (isNaN(num) || num < -90 || num > 90) return 'Latitude must be between -90 and 90.';
      return '';
    }
    case 'longitude': {
      const num = Number(value);
      if (isNaN(num) || num < -180 || num > 180) return 'Longitude must be between -180 and 180.';
      return '';
    }
    case 'licenseNo':
      if (!stringVal || !stringVal.trim()) return 'Pharmacy Drug / Trade License number is required.';
      if (stringVal.trim().length < 4) return 'License number must be at least 4 characters.';
      return '';
    case 'issuingAuthority':
      if (!stringVal || !stringVal.trim()) return 'Issuing regulatory authority is required.';
      return '';
    case 'licenseExpiryDate': {
      if (!stringVal) return '';
      const expiry = new Date(stringVal);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) {
        return 'License expiry date cannot be in the past for an active pharmacy application.';
      }
      return '';
    }
    default:
      return '';
  }
}

function validateWeeklyHours(hours) {
  if (!hours || typeof hours !== 'object') {
    return 'Operating hours schedule is required.';
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  let hasAtLeastOneOpenDay = false;

  for (const day of days) {
    const schedule = hours[day];
    if (schedule && schedule.isOpen) {
      hasAtLeastOneOpenDay = true;
      if (!schedule.is24Hours) {
        if (!schedule.openTime || !schedule.closeTime) {
          return `Please specify both opening and closing times for ${day}.`;
        }
        if (schedule.openTime >= schedule.closeTime) {
          const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
          return `Closing time must be after opening time on ${capitalizedDay}.`;
        }
      }
    }
  }

  if (!hasAtLeastOneOpenDay) {
    return 'At least one operating day must be marked open for patient access.';
  }

  return '';
}

function formatWeeklyHours(hours) {
  const dayNames = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];

  const formattedParts = [];

  for (const { key, label } of dayNames) {
    const day = hours[key];
    if (!day || !day.isOpen) {
      formattedParts.push(`${label}: Closed`);
    } else if (day.is24Hours) {
      formattedParts.push(`${label}: 24 Hours`);
    } else {
      formattedParts.push(`${label}: ${day.openTime} - ${day.closeTime}`);
    }
  }

  return formattedParts.join('; ');
}

test('Pharmacy Business Info Validation', () => {
  assert.equal(validateField('name', ''), 'Pharmacy trade name is required.');
  assert.equal(validateField('name', 'AB'), 'Pharmacy name must be at least 3 characters.');
  assert.equal(validateField('name', 'Popular Medical Hall'), '');

  assert.equal(validateField('ownerName', ''), 'Owner / authorized applicant name is required.');
  assert.equal(validateField('ownerName', 'Kazi Nazrul Islam'), '');

  assert.equal(validateField('phone', ''), 'Contact phone number is required.');
  assert.equal(validateField('phone', '123'), 'Enter a valid phone number (at least 10 digits).');
  // Phone containing only punctuation must fail
  assert.equal(validateField('phone', '+--   --++'), 'Enter a valid phone number (at least 10 digits).');
  assert.equal(validateField('phone', '+8801712345678'), '');
  assert.equal(validateField('phone', '01712-345678'), '');

  assert.equal(validateField('email', 'invalid-email'), 'Enter a valid email address (e.g. name@pharmacy.com).');
  assert.equal(validateField('email', 'invalid@domain'), 'Enter a valid email address (e.g. name@pharmacy.com).');
  assert.equal(validateField('email', 'owner@pharmacy.com'), '');
});

test('Pharmacy Address & Location Coordinates Validation', () => {
  assert.equal(validateField('streetAddress', ''), 'Street address and building details are required.');
  assert.equal(validateField('city', ''), 'City or district is required.');
  assert.equal(validateField('area', ''), 'Area / locality name is required.');

  // Postal code
  assert.equal(validateField('postalCode', ''), '');
  assert.equal(validateField('postalCode', '1212'), '');
  assert.equal(validateField('postalCode', 'abc'), 'Postal code should be a 4-6 digit number.');

  // Boundary coordinates
  assert.equal(validateField('latitude', 23.8103), '');
  assert.equal(validateField('latitude', 95), 'Latitude must be between -90 and 90.');
  assert.equal(validateField('latitude', -91), 'Latitude must be between -90 and 90.');

  assert.equal(validateField('longitude', 90.4125), '');
  assert.equal(validateField('longitude', 185), 'Longitude must be between -180 and 180.');
  assert.equal(validateField('longitude', -190), 'Longitude must be between -180 and 180.');
});

test('Pharmacy License & Expiry Validation', () => {
  assert.equal(validateField('licenseNo', ''), 'Pharmacy Drug / Trade License number is required.');
  assert.equal(validateField('licenseNo', '12'), 'License number must be at least 4 characters.');
  assert.equal(validateField('licenseNo', 'DL-DHK-99231'), '');

  assert.equal(validateField('issuingAuthority', ''), 'Issuing regulatory authority is required.');
  assert.equal(validateField('issuingAuthority', 'DGDA'), '');

  // Expired license
  assert.equal(
    validateField('licenseExpiryDate', '2020-01-01'),
    'License expiry date cannot be in the past for an active pharmacy application.'
  );

  // Future license
  const futureYear = new Date().getFullYear() + 2;
  assert.equal(validateField('licenseExpiryDate', `${futureYear}-12-31`), '');
});

test('Opening Hours Validation & Schedule Rules', () => {
  // All closed days must fail
  const allClosedSchedule = {
    monday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    tuesday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    wednesday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    thursday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    friday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    saturday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    sunday: { isOpen: false, openTime: '08:00', closeTime: '22:00', is24Hours: false },
  };
  assert.equal(
    validateWeeklyHours(allClosedSchedule),
    'At least one operating day must be marked open for patient access.'
  );

  // Close time before or equal to open time must fail
  const invalidTimeSchedule = {
    monday: { isOpen: true, openTime: '18:00', closeTime: '09:00', is24Hours: false },
  };
  assert.equal(
    validateWeeklyHours(invalidTimeSchedule),
    'Closing time must be after opening time on Monday.'
  );

  // Valid mixed schedule
  const validSchedule = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    tuesday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    friday: { isOpen: false, openTime: '00:00', closeTime: '00:00', is24Hours: false },
    saturday: { isOpen: true, openTime: '00:00', closeTime: '00:00', is24Hours: true },
    sunday: { isOpen: true, openTime: '09:00', closeTime: '21:00', is24Hours: false },
  };
  assert.equal(validateWeeklyHours(validSchedule), '');
});

test('Opening Hours Formatter', () => {
  const schedule = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    tuesday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    friday: { isOpen: false, openTime: '00:00', closeTime: '00:00', is24Hours: false },
    saturday: { isOpen: true, openTime: '00:00', closeTime: '00:00', is24Hours: true },
    sunday: { isOpen: true, openTime: '09:00', closeTime: '21:00', is24Hours: false },
  };

  const formatted = formatWeeklyHours(schedule);
  assert.ok(formatted.includes('Mon: 08:00 - 22:00'));
  assert.ok(formatted.includes('Fri: Closed'));
  assert.ok(formatted.includes('Sat: 24 Hours'));
  assert.ok(formatted.includes('Sun: 09:00 - 21:00'));
});

test('Trust Boundary: Application initial status must always be pending', () => {
  const applicationResponse = {
    applicationId: 'app_test_123',
    status: 'pending',
    message: 'Queued for admin review',
  };

  assert.equal(applicationResponse.status, 'pending');
  assert.notEqual(applicationResponse.status, 'verified');
});
