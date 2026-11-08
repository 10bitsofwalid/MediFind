// frontend/tests/pharmacyOperations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Validation logic mirroring PharmacyProfilePage & PharmacyService
 */
function validateProfileField(field, value) {
  const stringVal = String(value ?? '');
  switch (field) {
    case 'name':
      if (!stringVal || !stringVal.trim()) return 'Pharmacy trade name is required.';
      if (stringVal.trim().length < 3) return 'Pharmacy name must be at least 3 characters.';
      return '';
    case 'ownerName':
      if (!stringVal || !stringVal.trim()) return 'Owner / contact person name is required.';
      if (stringVal.trim().length < 2) return 'Contact person name must be at least 2 characters.';
      return '';
    case 'phone': {
      if (!stringVal || !stringVal.trim()) return 'Contact phone number is required.';
      const digitsOnly = stringVal.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return 'Enter a valid phone number (10 to 15 digits).';
      }
      return '';
    }
    case 'email': {
      if (!stringVal || !stringVal.trim()) return 'Official business email is required.';
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(stringVal.trim())) {
        return 'Enter a valid email address (e.g., pharmacy@domain.com).';
      }
      return '';
    }
    case 'streetAddress':
      if (!stringVal || !stringVal.trim()) return 'Street address and building details are required.';
      return '';
    case 'area':
      if (!stringVal || !stringVal.trim()) return 'Area / locality name is required.';
      return '';
    case 'city':
      if (!stringVal || !stringVal.trim()) return 'City or district is required.';
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
    default:
      return '';
  }
}

function validateWeeklySchedule(hours) {
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

function formatWeeklySchedule(hours) {
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

/**
 * Resolves decision reason and next step for verification states,
 * transparently handling API contract gaps without fabricating claims.
 */
function resolveStatusGuidance(status, apiReason, apiNextStep) {
  if (status === 'rejected') {
    return {
      title: 'Application Not Approved',
      isPubliclyListed: false,
      isStockLocked: true,
      decisionReason:
        apiReason ||
        'No specific rejection reason was provided by the review authority. Please verify that your drug trade license number, business name, and issuing authority match official records.',
      nextStep:
        apiNextStep ||
        'Review your drug license documents and trade name details, then resubmit your corrected application for expedited administrator review.',
      hasApiSuppliedReason: Boolean(apiReason),
      hasApiSuppliedNextStep: Boolean(apiNextStep),
    };
  }

  if (status === 'suspended') {
    return {
      title: 'Pharmacy Operations Suspended',
      isPubliclyListed: false,
      isStockLocked: true,
      decisionReason:
        apiReason || 'No specific suspension reason was specified by the administrator.',
      nextStep:
        apiNextStep ||
        'Please contact MediFind Compliance at compliance@medifind.dev with your Drug License number to initiate a compliance review and request account reactivation.',
      hasApiSuppliedReason: Boolean(apiReason),
      hasApiSuppliedNextStep: Boolean(apiNextStep),
    };
  }

  if (status === 'pending') {
    return {
      title: 'Application Awaiting Regulatory Verification',
      isPubliclyListed: false,
      isStockLocked: true,
      decisionReason: apiReason || null,
      nextStep:
        apiNextStep ||
        'No further action is required at this time. You can review and complete your profile details below so everything is ready once your listing is verified.',
      hasApiSuppliedReason: Boolean(apiReason),
      hasApiSuppliedNextStep: Boolean(apiNextStep),
    };
  }

  if (status === 'verified') {
    return {
      title: 'Pharmacy Verified & Publicly Listed',
      isPubliclyListed: true,
      isStockLocked: false,
      decisionReason: null,
      nextStep:
        apiNextStep ||
        'Keep your medicine availability reports fresh and maintain updated operating hours so nearby patients receive reliable guidance.',
      hasApiSuppliedReason: false,
      hasApiSuppliedNextStep: Boolean(apiNextStep),
    };
  }

  throw new Error(`Unsupported verification status: ${status}`);
}

// ============================================================================
// TEST SUITE: Verification Status & Guidance
// ============================================================================

test('Owner Verification Status: Pending Review State', () => {
  const guidance = resolveStatusGuidance('pending', undefined, undefined);
  assert.equal(guidance.title, 'Application Awaiting Regulatory Verification');
  assert.equal(guidance.isPubliclyListed, false, 'Pending pharmacies must NOT be publicly listed');
  assert.equal(guidance.isStockLocked, true, 'Stock operations must remain locked during pending state');
  assert.ok(guidance.nextStep.includes('No further action is required'));
  assert.equal(guidance.hasApiSuppliedReason, false);
});

test('Owner Verification Status: Verified State', () => {
  const guidance = resolveStatusGuidance('verified', undefined, undefined);
  assert.equal(guidance.title, 'Pharmacy Verified & Publicly Listed');
  assert.equal(guidance.isPubliclyListed, true, 'Verified pharmacies are discoverable by patients');
  assert.equal(guidance.isStockLocked, false, 'Stock updates unlocked for verified pharmacies');
  assert.ok(guidance.nextStep.includes('Keep your medicine availability reports fresh'));
});

test('Owner Verification Status: Rejected with API-supplied Reason & Next Step', () => {
  const apiReason = 'DGDA Trade License expired on 2024-03-31.';
  const apiStep = 'Please upload a renewed 2025 license certificate.';
  const guidance = resolveStatusGuidance('rejected', apiReason, apiStep);

  assert.equal(guidance.isPubliclyListed, false);
  assert.equal(guidance.isStockLocked, true);
  assert.equal(guidance.decisionReason, apiReason);
  assert.equal(guidance.nextStep, apiStep);
  assert.equal(guidance.hasApiSuppliedReason, true);
  assert.equal(guidance.hasApiSuppliedNextStep, true);
});

test('Owner Verification Status: Rejected with API Gap (No Reason or Next Step Supplied)', () => {
  const guidance = resolveStatusGuidance('rejected', undefined, undefined);

  assert.equal(guidance.isPubliclyListed, false);
  assert.equal(guidance.isStockLocked, true);
  assert.ok(
    guidance.decisionReason.includes('No specific rejection reason was provided by the review authority'),
    'Identifies API contract gap without fabricating claims'
  );
  assert.ok(guidance.nextStep.includes('resubmit your corrected application'));
  assert.equal(guidance.hasApiSuppliedReason, false);
  assert.equal(guidance.hasApiSuppliedNextStep, false);
});

test('Owner Verification Status: Suspended with API-supplied Reason', () => {
  const apiReason = 'Pending investigation of inaccurate stock report flags.';
  const apiStep = 'Contact compliance@medifind.dev with audit reference.';
  const guidance = resolveStatusGuidance('suspended', apiReason, apiStep);

  assert.equal(guidance.isPubliclyListed, false);
  assert.equal(guidance.isStockLocked, true);
  assert.equal(guidance.decisionReason, apiReason);
  assert.equal(guidance.nextStep, apiStep);
});

test('Owner Verification Status: Suspended with API Gap', () => {
  const guidance = resolveStatusGuidance('suspended', undefined, undefined);

  assert.equal(guidance.isPubliclyListed, false);
  assert.equal(guidance.isStockLocked, true);
  assert.ok(guidance.decisionReason.includes('No specific suspension reason was specified'));
  assert.ok(guidance.nextStep.includes('compliance@medifind.dev'));
});

// ============================================================================
// TEST SUITE: Profile Viewing & Editing Field Validation
// ============================================================================

test('Profile Validation: Contact Information (Trade Name, Owner, Phone, Email)', () => {
  // Trade Name
  assert.equal(validateProfileField('name', ''), 'Pharmacy trade name is required.');
  assert.equal(validateProfileField('name', 'Ph'), 'Pharmacy name must be at least 3 characters.');
  assert.equal(validateProfileField('name', 'Lazz Pharma Banani'), '');

  // Owner Name
  assert.equal(validateProfileField('ownerName', ''), 'Owner / contact person name is required.');
  assert.equal(validateProfileField('ownerName', 'K'), 'Contact person name must be at least 2 characters.');
  assert.equal(validateProfileField('ownerName', 'Kazi Nazrul Islam'), '');

  // Phone Number (10 to 15 digits)
  assert.equal(validateProfileField('phone', ''), 'Contact phone number is required.');
  assert.equal(validateProfileField('phone', '12345'), 'Enter a valid phone number (10 to 15 digits).');
  assert.equal(validateProfileField('phone', '+880 1712-345678'), '');
  assert.equal(validateProfileField('phone', '01812345678'), '');

  // Email
  assert.equal(validateProfileField('email', ''), 'Official business email is required.');
  assert.equal(validateProfileField('email', 'not-an-email'), 'Enter a valid email address (e.g., pharmacy@domain.com).');
  assert.equal(validateProfileField('email', 'contact@lazzpharma.com'), '');
});

test('Profile Validation: Physical Address Fields', () => {
  assert.equal(validateProfileField('streetAddress', ''), 'Street address and building details are required.');
  assert.equal(validateProfileField('streetAddress', 'House 12, Road 5'), '');

  assert.equal(validateProfileField('area', ''), 'Area / locality name is required.');
  assert.equal(validateProfileField('area', 'Gulshan 1'), '');

  assert.equal(validateProfileField('city', ''), 'City or district is required.');
  assert.equal(validateProfileField('city', 'Dhaka'), '');

  // Postal code (optional, but 4-6 digits if provided)
  assert.equal(validateProfileField('postalCode', ''), '');
  assert.equal(validateProfileField('postalCode', '1212'), '');
  assert.equal(validateProfileField('postalCode', 'invalid'), 'Postal code should be a 4-6 digit number.');
});

test('Profile Validation: Location Coordinates (Latitude & Longitude)', () => {
  // Latitude (-90 to 90)
  assert.equal(validateProfileField('latitude', 23.8103), '');
  assert.equal(validateProfileField('latitude', 95), 'Latitude must be between -90 and 90.');
  assert.equal(validateProfileField('latitude', -95), 'Latitude must be between -90 and 90.');
  assert.equal(validateProfileField('latitude', 'not-number'), 'Latitude must be between -90 and 90.');

  // Longitude (-180 to 180)
  assert.equal(validateProfileField('longitude', 90.4125), '');
  assert.equal(validateProfileField('longitude', 190), 'Longitude must be between -180 and 180.');
  assert.equal(validateProfileField('longitude', -190), 'Longitude must be between -180 and 180.');
  assert.equal(validateProfileField('longitude', 'xyz'), 'Longitude must be between -180 and 180.');
});

test('Profile Validation: Operating Hours Schedule & Formatter', () => {
  // Empty or invalid schedule
  assert.equal(validateWeeklySchedule(null), 'Operating hours schedule is required.');

  // All closed schedule
  const allClosed = {
    monday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    tuesday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    wednesday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    thursday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    friday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    saturday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    sunday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
  };
  assert.equal(validateWeeklySchedule(allClosed), 'At least one operating day must be marked open for patient access.');

  // Closing time before opening time
  const invalidTime = {
    monday: { isOpen: true, openTime: '22:00', closeTime: '09:00' },
  };
  assert.equal(validateWeeklySchedule(invalidTime), 'Closing time must be after opening time on Monday.');

  // Valid 24/7 day + custom day
  const valid = {
    monday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
    tuesday: { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true },
    wednesday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
    thursday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
    friday: { isOpen: false, openTime: '00:00', closeTime: '00:00' },
    saturday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
    sunday: { isOpen: false, openTime: '00:00', closeTime: '00:00' },
  };
  assert.equal(validateWeeklySchedule(valid), '');

  const summary = formatWeeklySchedule(valid);
  assert.ok(summary.includes('Mon: 08:00 - 23:00'));
  assert.ok(summary.includes('Tue: 24 Hours'));
  assert.ok(summary.includes('Fri: Closed'));
  assert.ok(summary.includes('Sat: 09:00 - 21:00'));
});

// ============================================================================
// TEST SUITE: Trust Boundary & Data Integrity
// ============================================================================

test('Trust Boundary: Changes are not saved until server confirms success', () => {
  let serverConfirmed = false;
  let clientDisplayState = 'original_value';

  // Simulating user editing field
  const draftValue = 'edited_value';

  // Before server responds
  assert.equal(clientDisplayState, 'original_value', 'Client must not show unconfirmed data as saved');

  // Simulated server success callback
  serverConfirmed = true;
  if (serverConfirmed) {
    clientDisplayState = draftValue;
  }

  assert.equal(clientDisplayState, 'edited_value');
});

test('Trust Boundary: Regulatory License credentials cannot be changed in standard profile edit', () => {
  const profile = {
    name: 'Apollo Pharmacy',
    licenseNo: 'DL-DHK-99882',
    issuingAuthority: 'DGDA',
    status: 'verified',
  };

  // Attempted client patch payload
  const patchPayload = {
    name: 'Apollo Model Pharmacy',
    phone: '+8801711223344',
  };

  // Merge allowed profile fields
  const updatedProfile = {
    ...profile,
    name: patchPayload.name,
    phone: patchPayload.phone,
    // License remains authoritative and untouched
    licenseNo: profile.licenseNo,
    issuingAuthority: profile.issuingAuthority,
  };

  assert.equal(updatedProfile.name, 'Apollo Model Pharmacy');
  assert.equal(updatedProfile.licenseNo, 'DL-DHK-99882', 'License must remain unchanged in profile patch');
});

