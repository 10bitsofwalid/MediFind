// backend/tests/validators.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  validateEmail,
  validateLocation,
  validatePhone,
  validatePostalCode,
  validateWeeklyHoursSchedule,
  validatePharmacyApplicationPayload,
  validatePharmacyProfileUpdatePayload,
  validateStockStatus,
  validateQuantity,
  validatePrice,
  validateAddInventoryPayload,
  validateUpdateInventoryPayload,
  validateReconfirmStockPayload,
  createDefaultWeeklyHours,
} from '../dist/validation/index.js';
import { syntheticPharmacyApplicationPayload } from '../dist/fixtures/syntheticFixtures.js';

test('Validator: GeoJSON Point shape and coordinate order [longitude, latitude]', () => {
  // Valid coordinates
  const valid = validateLocation({ type: 'Point', coordinates: [90.376, 23.7465] }, 23.7465, 90.376);
  assert.deepEqual(valid, {});

  // Invalid GeoJSON type
  const badType = validateLocation({ type: 'Polygon', coordinates: [90.376, 23.7465] });
  assert.equal(badType.location, 'GeoJSON location type must be "Point".');

  // Invalid coordinates array (not 2 numbers)
  const badCoords = validateLocation({ type: 'Point', coordinates: [90.376] });
  assert.equal(badCoords.location, 'GeoJSON coordinates must be an array of [longitude, latitude].');

  // Latitude out of bounds (> 90)
  const latOverflow = validateLocation(undefined, 95.5, 90.0);
  assert.equal(latOverflow.latitude, 'Latitude must be between -90 and 90.');

  // Latitude out of bounds (< -90)
  const latUnderflow = validateLocation(undefined, -95.5, 90.0);
  assert.equal(latUnderflow.latitude, 'Latitude must be between -90 and 90.');

  // Longitude out of bounds (> 180)
  const lngOverflow = validateLocation(undefined, 23.0, 185.0);
  assert.equal(lngOverflow.longitude, 'Longitude must be between -180 and 180.');

  // Longitude out of bounds (< -180)
  const lngUnderflow = validateLocation(undefined, 23.0, -185.0);
  assert.equal(lngUnderflow.longitude, 'Longitude must be between -180 and 180.');
});

test('Validator: Phone number format and length (10 to 15 digits)', () => {
  // Valid Bangladeshi mobile numbers
  assert.equal(validatePhone('+8801712345678'), null);
  assert.equal(validatePhone('01712345678'), null);
  assert.equal(validatePhone('+880-1819-876543'), null);
  assert.equal(validatePhone('(02) 9876543210'), null);

  // Missing phone
  assert.equal(validatePhone(''), 'Contact phone number is required.');
  assert.equal(validatePhone('   '), 'Contact phone number is required.');

  // Too short (< 10 digits)
  assert.equal(validatePhone('123456789'), 'Enter a valid phone number (10 to 15 digits).');

  // Too long (> 15 digits)
  assert.equal(validatePhone('1234567890123456'), 'Enter a valid phone number (10 to 15 digits).');

  // No digits
  assert.equal(validatePhone('invalid-phone'), 'Enter a valid phone number (10 to 15 digits).');
});

test('Validator: Email format', () => {
  // Valid emails
  assert.equal(validateEmail('pharmacy@medifind.example'), null);
  assert.equal(validateEmail('dr.rafiqul+work@greenlife.com.bd'), null);

  // Missing email
  assert.equal(validateEmail(''), 'Official business email is required.');

  // Invalid email formats
  assert.equal(validateEmail('not-an-email'), 'Enter a valid email address (e.g., pharmacy@domain.com).');
  assert.equal(validateEmail('missing@tld'), 'Enter a valid email address (e.g., pharmacy@domain.com).');
  assert.equal(validateEmail('@missingusername.com'), 'Enter a valid email address (e.g., pharmacy@domain.com).');
});

test('Validator: Optional postal code format (4 to 6 digits)', () => {
  // Valid postal codes
  assert.equal(validatePostalCode('1209'), null);
  assert.equal(validatePostalCode(1209), null);
  assert.equal(validatePostalCode('123456'), null);
  assert.equal(validatePostalCode(''), null);
  assert.equal(validatePostalCode(undefined), null);
  assert.equal(validatePostalCode(null), null);

  // Invalid postal codes
  assert.equal(validatePostalCode('123'), 'Postal code should be a 4-6 digit number.');
  assert.equal(validatePostalCode('1234567'), 'Postal code should be a 4-6 digit number.');
  assert.equal(validatePostalCode('12A9'), 'Postal code should be a 4-6 digit number.');
});

test('Validator: Weekly opening hours rules for all 7 days', () => {
  const hours = createDefaultWeeklyHours();
  const validResult = validateWeeklyHoursSchedule(hours);
  assert.deepEqual(validResult, {});

  // Closing time earlier than opening time
  const badHours = createDefaultWeeklyHours();
  badHours.monday = { isOpen: true, openTime: '20:00', closeTime: '08:00', is24Hours: false };
  const mondayErr = validateWeeklyHoursSchedule(badHours);
  assert.equal(
    mondayErr['openingHours.monday.closeTime'],
    'Closing time must be later than opening time on Monday.'
  );

  // Closing time equal to opening time
  badHours.monday = { isOpen: true, openTime: '10:00', closeTime: '10:00', is24Hours: false };
  const equalErr = validateWeeklyHoursSchedule(badHours);
  assert.equal(
    equalErr['openingHours.monday.closeTime'],
    'Closing time must be later than opening time on Monday.'
  );

  // 24-hour schedule is valid even with 00:00 - 23:59
  const roundTheClock = createDefaultWeeklyHours();
  roundTheClock.monday = { isOpen: true, openTime: '00:00', closeTime: '23:59', is24Hours: true };
  assert.deepEqual(validateWeeklyHoursSchedule(roundTheClock), {});

  // All days closed must be rejected
  const allClosed = createDefaultWeeklyHours();
  for (const day of Object.keys(allClosed)) {
    allClosed[day] = { isOpen: false, openTime: '', closeTime: '' };
  }
  const allClosedErr = validateWeeklyHoursSchedule(allClosed);
  assert.equal(
    allClosedErr['openingHours'],
    'At least one operating day must be marked open for patient access.'
  );
});

test('Validator: Stock status values and owner-writable restrictions', () => {
  // Allowed owner-writable statuses
  assert.equal(validateStockStatus('available'), 'available');
  assert.equal(validateStockStatus('low'), 'low');
  assert.equal(validateStockStatus('out'), 'out');

  // 'unverified' rejected by default for owner writes
  assert.throws(
    () => validateStockStatus('unverified', false),
    (err) => err instanceof ValidationError && err.code === 'INVALID_STATUS'
  );

  // 'unverified' accepted when explicitly permitted (e.g. system reconfirm context)
  assert.equal(validateStockStatus('unverified', true), 'unverified');

  // Unknown status rejected
  assert.throws(
    () => validateStockStatus('in_stock', false),
    (err) => err instanceof ValidationError && err.fields.status === 'Select Available, Low, or Out of Stock.'
  );
});

test('Validator: Quantity optional integer and price non-negative', () => {
  // Valid quantities
  assert.equal(validateQuantity(undefined), undefined);
  assert.equal(validateQuantity(null), undefined);
  assert.equal(validateQuantity(''), undefined);
  assert.equal(validateQuantity(0), 0);
  assert.equal(validateQuantity(150), 150);
  assert.equal(validateQuantity('25'), 25);

  // Invalid quantities
  assert.throws(() => validateQuantity(-1), /Quantity must be a whole number of 0 or greater/);
  assert.throws(() => validateQuantity(4.5), /Quantity must be a whole number of 0 or greater/);
  assert.throws(() => validateQuantity('abc'), /Quantity must be a whole number of 0 or greater/);

  // Valid prices
  assert.equal(validatePrice(undefined), undefined);
  assert.equal(validatePrice(null), undefined);
  assert.equal(validatePrice(''), undefined);
  assert.equal(validatePrice(0), 0);
  assert.equal(validatePrice(12.5), 12.5);

  // Invalid prices
  assert.throws(() => validatePrice(-0.01), /Price must be 0 or greater/);
  assert.throws(() => validatePrice('invalid'), /Price must be 0 or greater/);
});

test('Validator: Add Inventory requires medicineId', () => {
  // Missing medicineId throws MEDICINE_ID_REQUIRED error
  assert.throws(
    () => validateAddInventoryPayload({ status: 'available', quantity: 10 }),
    (err) => {
      return (
        err instanceof ValidationError &&
        err.code === 'MEDICINE_ID_REQUIRED' &&
        err.fields.medicineId === 'Medicine identifier is required.'
      );
    }
  );

  // Valid add payload succeeds
  const valid = validateAddInventoryPayload({
    medicineId: 'med_12345',
    status: 'available',
    quantity: 10,
    price: 5.5,
  });
  assert.equal(valid.medicineId, 'med_12345');
  assert.equal(valid.status, 'available');
  assert.equal(valid.quantity, 10);
  assert.equal(valid.price, 5.5);
});

test('Validator: Profile update rejects modification of protected licence credentials', () => {
  // Attempting to modify licenceNo
  assert.throws(
    () => validatePharmacyProfileUpdatePayload({ licenseNo: 'NEW-LICENSE-123' }),
    (err) => {
      return (
        err instanceof ValidationError &&
        err.status === 422 &&
        err.fields.licenseNo.includes('protected')
      );
    }
  );

  // Valid partial update
  const validUpdate = validatePharmacyProfileUpdatePayload({
    name: 'Updated Pharmacy Name',
    phone: '+8801799887766',
  });
  assert.equal(validUpdate.name, 'Updated Pharmacy Name');
  assert.equal(validUpdate.phone, '+8801799887766');
});

test('Validator: 422 Field Error Envelope Parity with Frontend Specification', () => {
  try {
    validatePharmacyApplicationPayload({
      name: 'AB', // too short
      ownerName: 'O', // too short
      phone: '123', // too short
      email: 'bad-email',
      streetAddress: '',
      city: '',
      area: '',
      licenseNo: '',
      issuingAuthority: '',
      latitude: 150, // out of bounds
      longitude: 250, // out of bounds
    });
    assert.fail('Should have thrown ValidationError');
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.status, 422);

    const json = err.toJSON('req_test_123');
    assert.deepEqual(json, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please review the highlighted fields.',
        requestId: 'req_test_123',
        fields: {
          name: 'Pharmacy name must be at least 3 characters.',
          ownerName: 'Owner name must be at least 2 characters.',
          phone: 'Enter a valid phone number (10 to 15 digits).',
          email: 'Enter a valid email address (e.g., pharmacy@domain.com).',
          streetAddress: 'Street address and building details are required.',
          city: 'City or district is required.',
          area: 'Area / locality name is required.',
          licenseNo: 'DGDA drug licence number is required.',
          issuingAuthority: 'Licensing authority is required.',
          latitude: 'Latitude must be between -90 and 90.',
          longitude: 'Longitude must be between -180 and 180.',
          openingHours: 'Operating hours schedule is required.',
        },
      },
    });
  }
});
