// src/features/pharmacy/PharmacyProfilePage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  Pharmacy,
  PharmacyProfileUpdatePayload,
  WeeklyHours,
  DayOfWeek,
  VerificationStatus,
} from '../../types/pharmacy';
import {
  getPharmacyProfile,
  updatePharmacyProfile,
  createDefaultWeeklyHours,
  formatWeeklyHours,
  validateWeeklyHours,
  seedSamplePharmacy,
  isMockApiEnabled,
  PharmacyServiceError,
} from '../../services/pharmacyService';
import { LocationPicker } from '../../components/LocationPicker';
import { OpeningHoursBuilder } from '../../components/OpeningHoursBuilder';
import { MapView } from '../../components/MapView';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../../config/constants';
import {
  Building2,
  MapPin,
  Clock,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Edit3,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Compass,
  Lock,
} from 'lucide-react';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export const PharmacyProfilePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEditMode = searchParams.get('edit') === 'true';

  // Server data state
  const [serverProfile, setServerProfile] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit mode toggle
  const [isEditing, setIsEditing] = useState<boolean>(initialEditMode);

  // Form Field States
  const [name, setName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  const [streetAddress, setStreetAddress] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [city, setCity] = useState<string>('Dhaka');
  const [postalCode, setPostalCode] = useState<string>('');

  const [latitude, setLatitude] = useState<number>(DEFAULT_LATITUDE);
  const [longitude, setLongitude] = useState<number>(DEFAULT_LONGITUDE);

  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(() => createDefaultWeeklyHours());

  // Form Operation States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate form fields from server profile
  const populateFields = (profile: Pharmacy) => {
    setName(profile.name || '');
    setOwnerName(profile.ownerName || '');
    setPhone(profile.phone || '');
    setEmail(profile.email || '');

    setStreetAddress(profile.streetAddress || '');
    setArea(profile.area || '');
    setCity(profile.city || 'Dhaka');
    setPostalCode(profile.postalCode || '');

    if (profile.latitude !== undefined && profile.longitude !== undefined) {
      setLatitude(profile.latitude);
      setLongitude(profile.longitude);
    } else if (profile.location?.coordinates) {
      setLongitude(profile.location.coordinates[0]);
      setLatitude(profile.location.coordinates[1]);
    }

    if (profile.structuredHours) {
      setWeeklyHours(profile.structuredHours);
    } else {
      setWeeklyHours(createDefaultWeeklyHours());
    }
  };

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getPharmacyProfile();
      if (data) {
        setServerProfile(data);
        populateFields(data);
      } else {
        setServerProfile(null);
      }
    } catch {
      setLoadError('Failed to load pharmacy profile from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getPharmacyProfile()
      .then((data) => {
        if (isMounted) {
          if (data) {
            setServerProfile(data);
            populateFields(data);
          } else {
            setServerProfile(null);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadError('Failed to load pharmacy profile from server.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    if (!serverProfile) return false;
    return (
      name !== (serverProfile.name || '') ||
      ownerName !== (serverProfile.ownerName || '') ||
      phone !== (serverProfile.phone || '') ||
      email !== (serverProfile.email || '') ||
      streetAddress !== (serverProfile.streetAddress || '') ||
      area !== (serverProfile.area || '') ||
      city !== (serverProfile.city || 'Dhaka') ||
      postalCode !== (serverProfile.postalCode || '') ||
      latitude !== (serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE) ||
      longitude !== (serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE)
    );
  }, [
    serverProfile,
    name,
    ownerName,
    phone,
    email,
    streetAddress,
    area,
    city,
    postalCode,
    latitude,
    longitude,
  ]);

  // Client-side field validator
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Contact Validation
    if (!name.trim()) {
      errors.name = 'Pharmacy trade name is required.';
    } else if (name.trim().length < 3) {
      errors.name = 'Pharmacy name must be at least 3 characters.';
    }

    if (!ownerName.trim()) {
      errors.ownerName = 'Owner / contact person name is required.';
    } else if (ownerName.trim().length < 2) {
      errors.ownerName = 'Contact person name must be at least 2 characters.';
    }

    if (!phone.trim()) {
      errors.phone = 'Contact phone number is required.';
    } else {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        errors.phone = 'Enter a valid phone number (10 to 15 digits).';
      }
    }

    if (!email.trim()) {
      errors.email = 'Official business email is required.';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Enter a valid email address (e.g., pharmacy@domain.com).';
      }
    }

    // Address Validation
    if (!streetAddress.trim()) {
      errors.streetAddress = 'Street address and building details are required.';
    }
    if (!area.trim()) {
      errors.area = 'Area / locality name is required.';
    }
    if (!city.trim()) {
      errors.city = 'City or district is required.';
    }
    if (postalCode.trim() && !/^\d{4,6}$/.test(postalCode.trim())) {
      errors.postalCode = 'Postal code should be a 4-6 digit number.';
    }

    // Location Coordinates Validation
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      errors.latitude = 'Latitude must be between -90 and 90.';
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      errors.longitude = 'Longitude must be between -180 and 180.';
    }

    // Operating Hours Validation
    const hoursErr = validateWeeklyHours(weeklyHours);
    if (hoursErr) {
      errors.openingHours = hoursErr;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartEdit = () => {
    setSaveSuccess(null);
    setSaveError(null);
    setFieldErrors({});
    setIsEditing(true);
    setSearchParams({ edit: 'true' });
  };

  const handleCancelEdit = () => {
    if (isDirty) {
      setShowDiscardModal(true);
      return;
    }
    executeDiscard();
  };

  const executeDiscard = () => {
    if (serverProfile) {
      populateFields(serverProfile);
    }
    setFieldErrors({});
    setSaveError(null);
    setIsEditing(false);
    setSearchParams({});
    setShowDiscardModal(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(null);
    setSaveError(null);

    const isValid = validateForm();
    if (!isValid) {
      setSaveError('Please review and correct the highlighted fields before saving.');
      // Scroll to the top error banner
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);

    const formattedAddress = `${streetAddress.trim()}, ${area.trim()}, ${city.trim()}${
      postalCode.trim() ? ' - ' + postalCode.trim() : ''
    }`;

    const updatePayload: PharmacyProfileUpdatePayload = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      streetAddress: streetAddress.trim(),
      area: area.trim(),
      city: city.trim(),
      postalCode: postalCode.trim() || undefined,
      formattedAddress,
      address: formattedAddress,
      latitude,
      longitude,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      structuredHours: weeklyHours,
      openingHours: formatWeeklyHours(weeklyHours),
    };

    try {
      // Server authoritative update
      const updated = await updatePharmacyProfile(updatePayload);

      // Only mark changes saved upon verified server success
      setServerProfile(updated);
      populateFields(updated);
      setIsEditing(false);
      setSearchParams({});
      setFieldErrors({});
      setSaveSuccess('Pharmacy profile updated successfully. Saved changes are now confirmed on the server.');

      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(null);
      }, 6000);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      console.error('Profile update failed:', err);
      let errorMsg = 'Failed to update pharmacy profile. Please try again.';

      if (err instanceof PharmacyServiceError) {
        errorMsg = err.message || errorMsg;
        if (err.fields) {
          setFieldErrors(err.fields);
        }
      }

      setSaveError(errorMsg);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedSample = () => {
    seedSamplePharmacy('verified');
    loadProfile();
  };

  // Determine current day of week for highlighting today's hours
  const currentDayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const dayKeyMap: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const todayKey: DayOfWeek = dayKeyMap[currentDayIndex];

  // =========================================================================
  // RENDER: Loading State
  // =========================================================================
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Loading pharmacy profile...
        </span>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Empty State (No Pharmacy Found)
  // =========================================================================
  if (!serverProfile) {
    return (
      <div style={{ maxWidth: '680px', margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '48px 24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-action-subtle)',
              color: 'var(--color-action-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <Building2 size={32} />
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            No Pharmacy Profile Found
          </h1>

          <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
            You haven't submitted a pharmacy onboarding application yet. Complete the registration form to create your
            profile, submit your drug trade license, and initiate verification.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/pharmacy/register"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
              }}
            >
              <span>Submit Pharmacy Application</span>
            </Link>

            {isMockApiEnabled() && (
              <button
                type="button"
                onClick={handleSeedSample}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <span>Load Sample Pharmacy (Dev Mode)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentStatus: VerificationStatus = serverProfile.status || 'pending';

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Navigation Breadcrumb & Back Link */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/pharmacy/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Back to Owner Workspace</span>
        </Link>
      </div>

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {isEditing ? 'Edit Pharmacy Profile' : serverProfile.name}
            </h1>

            {/* Accessible Status Pill */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor:
                  currentStatus === 'verified'
                    ? 'var(--color-status-available-bg)'
                    : currentStatus === 'pending'
                    ? 'var(--color-status-caution-bg)'
                    : 'var(--color-status-problem-bg)',
                color:
                  currentStatus === 'verified'
                    ? 'var(--color-status-available)'
                    : currentStatus === 'pending'
                    ? 'var(--color-status-caution)'
                    : 'var(--color-status-problem)',
                border: `1px solid ${
                  currentStatus === 'verified'
                    ? 'rgba(24, 115, 75, 0.3)'
                    : currentStatus === 'pending'
                    ? 'rgba(152, 88, 0, 0.3)'
                    : 'rgba(180, 35, 47, 0.3)'
                }`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
              aria-label={`Verification status: ${currentStatus}`}
            >
              {currentStatus === 'verified' && <CheckCircle2 size={13} aria-hidden="true" />}
              {currentStatus === 'pending' && <Clock size={13} aria-hidden="true" />}
              {(currentStatus === 'rejected' || currentStatus === 'suspended') && (
                <AlertTriangle size={13} aria-hidden="true" />
              )}
              <span>Status: {currentStatus}</span>
            </span>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {isEditing
              ? 'Update public contact details, physical address, map coordinates, and operating hours.'
              : `License: ${serverProfile.licenseNo || 'Documentation on file'} • Managed by ${
                  serverProfile.ownerName || 'Authorized Applicant'
                }`}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={16} aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                <X size={16} aria-hidden="true" />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.75 : 1,
                }}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-small" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts: Load, Success & Error Feedback */}
      {loadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
          }}
        >
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{loadError}</span>
        </div>
      )}

      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
          }}
        >
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{saveError}</span>
        </div>
      )}

      {/* FORM / VIEW CONTAINER */}
      <form onSubmit={handleSaveProfile} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* ========================================================= */}
          {/* 1. CONTACT INFORMATION SECTION                             */}
          {/* ========================================================= */}
          <section
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-labelledby="contact-info-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <Building2 size={20} color="var(--color-action-primary)" aria-hidden="true" />
              <h2
                id="contact-info-heading"
                style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
              >
                Contact Information
              </h2>
            </div>

            {!isEditing ? (
              // Contact Information View Mode
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '20px',
                }}
              >
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Pharmacy Trade Name
                  </span>
                  <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)' }}>
                    {serverProfile.name}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Owner / Contact Person
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} color="var(--color-action-primary)" aria-hidden="true" />
                    <span style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>
                      {serverProfile.ownerName || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Contact Phone Number
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={15} color="var(--color-action-primary)" aria-hidden="true" />
                    {serverProfile.phone ? (
                      <a
                        href={`tel:${serverProfile.phone}`}
                        style={{ fontSize: '15px', color: 'var(--color-action-primary)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {serverProfile.phone}
                      </a>
                    ) : (
                      <span style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>Not specified</span>
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Official Business Email
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={15} color="var(--color-action-primary)" aria-hidden="true" />
                    {serverProfile.email ? (
                      <a
                        href={`mailto:${serverProfile.email}`}
                        style={{ fontSize: '15px', color: 'var(--color-action-primary)', textDecoration: 'none' }}
                      >
                        {serverProfile.email}
                      </a>
                    ) : (
                      <span style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>Not specified</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Contact Information Edit Mode
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                <div>
                  <label
                    htmlFor="field-name"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Pharmacy Trade Name <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                    }}
                    disabled={isSaving}
                    placeholder="e.g., Popular Medical Hall"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fieldErrors.name ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                    }}
                  />
                  {fieldErrors.name && (
                    <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.name}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="field-owner"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Owner / Contact Person <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-owner"
                    type="text"
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      if (fieldErrors.ownerName) setFieldErrors({ ...fieldErrors, ownerName: '' });
                    }}
                    disabled={isSaving}
                    placeholder="e.g., Kazi Nazrul Islam, R.Ph"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fieldErrors.ownerName ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                    }}
                  />
                  {fieldErrors.ownerName && (
                    <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.ownerName}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="field-phone"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Contact Phone Number <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                    }}
                    disabled={isSaving}
                    placeholder="e.g., +8801712345678"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fieldErrors.phone ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                    }}
                  />
                  {fieldErrors.phone && (
                    <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="field-email"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Official Business Email <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                    disabled={isSaving}
                    placeholder="e.g., contact@pharmacy.com"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fieldErrors.email ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                    }}
                  />
                  {fieldErrors.email && (
                    <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* 2. PHYSICAL ADDRESS SECTION                                */}
          {/* ========================================================= */}
          <section
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-labelledby="address-info-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <MapPin size={20} color="var(--color-action-primary)" aria-hidden="true" />
              <h2
                id="address-info-heading"
                style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
              >
                Physical Address
              </h2>
            </div>

            {!isEditing ? (
              // Address View Mode
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <MapPin size={18} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                      Formatted Address
                    </span>
                    <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                      {serverProfile.address || serverProfile.formattedAddress || 'No formatted address on file'}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginTop: '8px',
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Street Address & Building
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {serverProfile.streetAddress || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Area / Locality
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {serverProfile.area || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      City / District
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {serverProfile.city || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Postal Code
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {serverProfile.postalCode || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Address Edit Mode
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="field-street"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Street Address & Building Details <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-street"
                    type="text"
                    value={streetAddress}
                    onChange={(e) => {
                      setStreetAddress(e.target.value);
                      if (fieldErrors.streetAddress) setFieldErrors({ ...fieldErrors, streetAddress: '' });
                    }}
                    disabled={isSaving}
                    placeholder="e.g., House 42, Road 11, Block D"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${fieldErrors.streetAddress ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '14px',
                    }}
                  />
                  {fieldErrors.streetAddress && (
                    <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.streetAddress}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="field-area"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                    >
                      Area / Locality <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                    </label>
                    <input
                      id="field-area"
                      type="text"
                      value={area}
                      onChange={(e) => {
                        setArea(e.target.value);
                        if (fieldErrors.area) setFieldErrors({ ...fieldErrors, area: '' });
                      }}
                      disabled={isSaving}
                      placeholder="e.g., Banani, Dhanmondi"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${fieldErrors.area ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                        backgroundColor: 'var(--color-surface-panel)',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                      }}
                    />
                    {fieldErrors.area && (
                      <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.area}
                      </span>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="field-city"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                    >
                      City / District <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                    </label>
                    <input
                      id="field-city"
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: '' });
                      }}
                      disabled={isSaving}
                      placeholder="e.g., Dhaka, Chattogram"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${fieldErrors.city ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                        backgroundColor: 'var(--color-surface-panel)',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                      }}
                    />
                    {fieldErrors.city && (
                      <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.city}
                      </span>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="field-postal"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                    >
                      Postal Code <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>(Optional)</span>
                    </label>
                    <input
                      id="field-postal"
                      type="text"
                      value={postalCode}
                      onChange={(e) => {
                        setPostalCode(e.target.value);
                        if (fieldErrors.postalCode) setFieldErrors({ ...fieldErrors, postalCode: '' });
                      }}
                      disabled={isSaving}
                      placeholder="e.g., 1213"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${fieldErrors.postalCode ? 'var(--color-status-problem)' : 'var(--color-border-default)'}`,
                        backgroundColor: 'var(--color-surface-panel)',
                        color: 'var(--color-text-primary)',
                        fontSize: '14px',
                      }}
                    />
                    {fieldErrors.postalCode && (
                      <span role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.postalCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Formatted address live preview */}
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border-default)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <strong style={{ color: 'var(--color-text-primary)' }}>Address Preview:</strong>{' '}
                  {streetAddress.trim() || '[Street]'}, {area.trim() || '[Area]'}, {city.trim() || '[City]'}
                  {postalCode.trim() ? ` - ${postalCode.trim()}` : ''}
                </div>
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* 3. LOCATION & GEOSPATIAL COORDINATES SECTION              */}
          {/* ========================================================= */}
          <section
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-labelledby="location-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <Compass size={20} color="var(--color-action-primary)" aria-hidden="true" />
              <div>
                <h2
                  id="location-heading"
                  style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
                >
                  Location & Map Coordinates
                </h2>
              </div>
            </div>

            {!isEditing ? (
              // Location View Mode
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    padding: '14px 18px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Latitude
                    </span>
                    <code style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? 'Not configured'}
                    </code>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Longitude
                    </span>
                    <code style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? 'Not configured'}
                    </code>
                  </div>

                  <div style={{ marginLeft: 'auto' }}>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${
                        serverProfile.latitude ?? serverProfile.location?.coordinates[1]
                      }&mlon=${serverProfile.longitude ?? serverProfile.location?.coordinates[0]}#map=16/${
                        serverProfile.latitude ?? serverProfile.location?.coordinates[1]
                      }/${serverProfile.longitude ?? serverProfile.location?.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '13px',
                        color: 'var(--color-action-primary)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      <span>Inspect on OpenStreetMap</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                </div>

                {/* Inline map pin preview (resolves UI-03) */}
                <div style={{ marginBottom: '14px' }}>
                  <MapView
                    centerLatitude={serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE}
                    centerLongitude={serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE}
                    markers={[
                      {
                        id: serverProfile._id,
                        name: serverProfile.name,
                        latitude: serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE,
                        longitude: serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE,
                        address: serverProfile.address,
                      },
                    ]}
                    zoom={15}
                    height="200px"
                    interactive={false}
                  />
                </div>

                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Exact coordinates enable nearby patients to calculate walking and driving distances and locate your
                  dispensary counter directly from the MediFind map.
                </p>
              </div>
            ) : (
              // Location Edit Mode using LocationPicker
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
                  Pin your exact storefront entrance on the map, use current GPS detection, or enter coordinates
                  manually.
                </p>

                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    if (fieldErrors.latitude || fieldErrors.longitude) {
                      setFieldErrors({ ...fieldErrors, latitude: '', longitude: '' });
                    }
                  }}
                  error={fieldErrors.latitude || fieldErrors.longitude}
                  disabled={isSaving}
                />
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* 4. OPENING HOURS SECTION                                   */}
          {/* ========================================================= */}
          <section
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-labelledby="hours-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <Clock size={20} color="var(--color-action-primary)" aria-hidden="true" />
              <div>
                <h2
                  id="hours-heading"
                  style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
                >
                  Opening Hours & Schedule
                </h2>
              </div>
            </div>

            {!isEditing ? (
              // Opening Hours View Mode
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '10px',
                    marginBottom: '16px',
                  }}
                >
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const daySchedule = serverProfile.structuredHours?.[key];
                    const isToday = key === todayKey;

                    let statusBadgeText = 'Closed';
                    let statusColor = 'var(--color-text-secondary)';
                    let statusBg = 'var(--color-surface-canvas)';

                    if (daySchedule?.isOpen) {
                      if (daySchedule.is24Hours) {
                        statusBadgeText = 'Open 24 Hours';
                        statusColor = 'var(--color-status-available)';
                        statusBg = 'var(--color-status-available-bg)';
                      } else {
                        statusBadgeText = `${daySchedule.openTime} – ${daySchedule.closeTime}`;
                        statusColor = 'var(--color-action-primary)';
                        statusBg = 'var(--color-action-subtle)';
                      }
                    }

                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isToday ? 'var(--color-action-subtle)' : 'var(--color-surface-canvas)',
                          border: isToday
                            ? '1px solid rgba(23, 107, 135, 0.35)'
                            : '1px solid var(--color-border-default)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: isToday ? 700 : 500,
                              color: isToday ? 'var(--color-action-primary)' : 'var(--color-text-primary)',
                            }}
                          >
                            {label}
                          </span>
                          {isToday && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--color-action-primary)',
                                color: '#ffffff',
                              }}
                            >
                              TODAY
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: statusBg,
                            color: statusColor,
                          }}
                        >
                          {statusBadgeText}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-surface-canvas)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border-default)',
                  }}
                >
                  <strong style={{ color: 'var(--color-text-primary)' }}>Summary String:</strong>{' '}
                  {serverProfile.openingHours || 'No schedule formatted'}
                </div>
              </div>
            ) : (
              // Opening Hours Edit Mode using OpeningHoursBuilder
              <div>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                  Set daily operating times so patients know when medications can be picked up.
                </p>

                <OpeningHoursBuilder
                  hours={weeklyHours}
                  onChange={(updated) => {
                    setWeeklyHours(updated);
                    if (fieldErrors.openingHours) {
                      setFieldErrors({ ...fieldErrors, openingHours: '' });
                    }
                  }}
                  error={fieldErrors.openingHours}
                  disabled={isSaving}
                />
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* 5. REGULATORY ACCREDITATION & LICENSE DETAILS (READ-ONLY)  */}
          {/* ========================================================= */}
          <section
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-labelledby="license-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--color-border-default)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="var(--color-action-primary)" aria-hidden="true" />
                <h2
                  id="license-heading"
                  style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
                >
                  Licensing & Regulatory Accreditation
                </h2>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <Lock size={12} aria-hidden="true" />
                <span>Verified Authority Field</span>
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '14px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Drug Trade License Number
                </span>
                <code style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {serverProfile.licenseNo || 'Pending Documentation'}
                </code>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Issuing Regulatory Body
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {serverProfile.issuingAuthority || 'Directorate General of Drug Administration (DGDA)'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  License Expiry Date
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {serverProfile.licenseExpiryDate || 'Active on file'}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Per MediFind healthcare safety integrity rules, Drug Trade License credentials are fixed to your official
              regulatory application. If you have renewed or altered your trade license, please contact administrator
              support or resubmit your onboarding application.
            </p>
          </section>

          {/* Sticky Bottom Actions Bar when Editing on Mobile/Desktop */}
          {isEditing && (
            <div
              style={{
                position: 'sticky',
                bottom: '16px',
                backgroundColor: 'var(--color-surface-panel)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-md)',
                zIndex: 50,
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {isDirty ? (
                  <span style={{ color: 'var(--color-status-caution)', fontWeight: 600 }}>
                    ● You have unsaved profile changes
                  </span>
                ) : (
                  <span>No changes made yet</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="btn-secondary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.75 : 1,
                  }}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-small" aria-hidden="true" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} aria-hidden="true" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Accessible In-App Discard Confirmation Modal (resolves UI-04) */}
      {showDiscardModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 43, 58, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <h3
              id="discard-modal-title"
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}
            >
              Discard Unsaved Changes?
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
              You have modified your pharmacy profile. If you discard, all unsaved changes will revert back to your
              current saved server record.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="btn-secondary"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  cursor: 'pointer',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={executeDiscard}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-status-problem)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
