// src/features/pharmacy/PharmacyProfilePage.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  PharmacyServiceError,
} from '../../services/pharmacyService';
import {
  validateProfileField,
  validateProfileFormValues,
  getOrderedProfileErrorEntries,
  type ProfileFieldKey,
} from './profileUtils';
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
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Compass,
  Lock,
  RefreshCw,
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
  const navigate = useNavigate();
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
  const [city, setCity] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');

  const [latitude, setLatitude] = useState<number>(DEFAULT_LATITUDE);
  const [longitude, setLongitude] = useState<number>(DEFAULT_LONGITUDE);

  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(() => createDefaultWeeklyHours());

  // Form Operation States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isConflictError, setIsConflictError] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<string | null>(null);

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const keepEditingBtnRef = useRef<HTMLButtonElement | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Populate form fields from server profile
  const populateFields = useCallback((profile: Pharmacy) => {
    setName(profile.name || '');
    setOwnerName(profile.ownerName || '');
    setPhone(profile.phone || '');
    setEmail(profile.email || '');

    setStreetAddress(profile.streetAddress || '');
    setArea(profile.area || '');
    setCity(profile.city || '');
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
  }, []);

  const loadProfile = useCallback(async () => {
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
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Failed to load pharmacy profile from server. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [populateFields]);

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
          setLoadError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Failed to load pharmacy profile from server. Please try again.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [populateFields]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    if (!serverProfile) return false;
    const savedHoursFormatted = formatWeeklyHours(
      serverProfile.structuredHours ?? createDefaultWeeklyHours()
    );
    const savedLat = serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE;
    const savedLng = serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE;
    return (
      name !== (serverProfile.name || '') ||
      ownerName !== (serverProfile.ownerName || '') ||
      phone !== (serverProfile.phone || '') ||
      email !== (serverProfile.email || '') ||
      streetAddress !== (serverProfile.streetAddress || '') ||
      area !== (serverProfile.area || '') ||
      city !== (serverProfile.city || '') ||
      postalCode !== (serverProfile.postalCode || '') ||
      latitude !== savedLat ||
      longitude !== savedLng ||
      formatWeeklyHours(weeklyHours) !== savedHoursFormatted
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
    weeklyHours,
  ]);

  // Warn browser unload when editing with unsaved changes
  useEffect(() => {
    if (!isEditing || !isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, isDirty]);

  // Keyboard & focus management for Discard Confirmation Modal
  useEffect(() => {
    if (!showDiscardModal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    keepEditingBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDiscardModal(false);
        setPendingNavigationTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [showDiscardModal]);

  const orderedErrors = useMemo(
    () => getOrderedProfileErrorEntries(fieldErrors),
    [fieldErrors]
  );

  // Validate a single field on blur without interrupting active typing
  const handleFieldBlur = (field: ProfileFieldKey, value: unknown) => {
    const err = validateProfileField(field, value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[field] = err;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const clearFieldError = (field: ProfileFieldKey) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Client-side field validator
  const validateForm = (): Record<string, string> => {
    const errors = validateProfileFormValues({
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
      weeklyHours,
    });
    setFieldErrors(errors);
    return errors;
  };

  const focusFieldById = (inputId?: string) => {
    if (!inputId) return;
    const el = document.getElementById(inputId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
      }
    }
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
      setPendingNavigationTarget(null);
      setShowDiscardModal(true);
      return;
    }
    executeDiscard();
  };

  const handleBackNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isEditing && isDirty && !isSaving) {
      e.preventDefault();
      setPendingNavigationTarget('/pharmacy/dashboard');
      setShowDiscardModal(true);
    }
  };

  const executeDiscard = () => {
    if (serverProfile) {
      populateFields(serverProfile);
    }
    const targetRoute = pendingNavigationTarget;
    setFieldErrors({});
    setSaveError(null);
    setIsEditing(false);
    setSearchParams({});
    setShowDiscardModal(false);
    setPendingNavigationTarget(null);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRef.current) return;

    setSaveSuccess(null);
    setSaveError(null);
    setIsConflictError(false);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setSaveError('Please review and correct the highlighted fields before saving.');
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    isSavingRef.current = true;
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
      const updated = await updatePharmacyProfile(updatePayload, serverProfile);

      // Only mark changes saved upon verified server success
      setServerProfile(updated);
      populateFields(updated);
      setIsEditing(false);
      setSearchParams({});
      setFieldErrors({});
      setIsConflictError(false);
      setSaveSuccess('Pharmacy profile updated successfully. Saved changes are now confirmed on the server.');

      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(null);
      }, 6000);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      let errorMsg = 'Failed to update pharmacy profile. Your changes were kept so you can retry.';

      if (err instanceof PharmacyServiceError) {
        errorMsg = err.message || errorMsg;
        if (err.status === 409) {
          setIsConflictError(true);
        }
        if (err.fields) {
          setFieldErrors(err.fields);
        }
      } else if (err instanceof Error && err.message) {
        errorMsg = err.message;
      }

      setSaveError(errorMsg);
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
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
  // RENDER: Loading State (Structured Skeleton Matching Profile Layout)
  // =========================================================================
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 80px' }}
      >
        <span className="sr-only">Loading pharmacy profile...</span>
        <div className="skeleton-shimmer" style={{ width: '160px', height: '18px', marginBottom: '18px' }} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '20px',
            marginBottom: '24px',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 220px' }}>
            <div className="skeleton-shimmer" style={{ width: '240px', maxWidth: '100%', height: '30px' }} />
            <div className="skeleton-shimmer" style={{ width: '320px', maxWidth: '100%', height: '16px' }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: '132px', height: '42px', borderRadius: 'var(--radius-md)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="pharmacy-section-card" aria-hidden="true">
              <div className="skeleton-shimmer" style={{ width: '180px', height: '22px', marginBottom: '18px' }} />
              <div className="pharmacy-grid-2">
                <div className="skeleton-shimmer" style={{ height: '48px' }} />
                <div className="skeleton-shimmer" style={{ height: '48px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Load Error State (Distinguished from Empty Profile)
  // =========================================================================
  if (loadError && !serverProfile) {
    return (
      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px' }}>
        <div
          role="alert"
          className="pharmacy-section-card"
          style={{
            borderColor: 'var(--color-status-problem-border)',
            backgroundColor: 'var(--color-status-problem-bg)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            padding: '32px 24px',
          }}
        >
          <AlertTriangle size={30} color="var(--color-status-problem)" aria-hidden="true" />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-status-problem)', margin: '0 0 6px' }}>
              Could Not Load Pharmacy Profile
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
              {loadError}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                minHeight: '44px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Retry Loading Profile</span>
            </button>
            <Link
              to="/pharmacy/dashboard"
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                minHeight: '44px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              <span>Back to Workspace</span>
            </Link>
          </div>
        </div>
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
          className="card pharmacy-section-card"
          style={{
            padding: '44px 24px',
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
            You haven&apos;t submitted a pharmacy onboarding application yet. Complete the registration form to create
            your profile, submit your drug trade license, and initiate verification.
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
                minHeight: '44px',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
              }}
            >
              <span>Submit Pharmacy Application</span>
            </Link>
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
          onClick={handleBackNavigation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: 'var(--color-action-primary)',
            textDecoration: 'none',
            fontWeight: 500,
            minHeight: '36px',
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
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, wordBreak: 'break-word' }}>
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
                    ? 'var(--color-status-available-border)'
                    : currentStatus === 'pending'
                    ? 'var(--color-status-caution-border)'
                    : 'var(--color-status-problem-border)'
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

          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>
            {isEditing
              ? 'Update public contact details, physical address, map coordinates, and operating hours. Drug trade license fields remain locked.'
              : `License: ${serverProfile.licenseNo || 'Documentation on file'} • Managed by ${
                  serverProfile.ownerName || 'Authorized Applicant'
                }`}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                minHeight: '44px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                  minHeight: '44px',
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
                  minHeight: '44px',
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

      {/* Global Alerts: Load, Success & Error/Validation Summary Feedback */}
      {loadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid var(--color-status-problem-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              minHeight: '36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-status-problem-border)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-status-problem)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {saveSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid var(--color-status-available-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            aria-label="Dismiss save confirmation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--color-status-available)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {saveError && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid var(--color-status-problem-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              aria-label="Dismiss error summary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '36px',
                minHeight: '36px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-status-problem)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {isConflictError && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setIsConflictError(false);
                  void loadProfile();
                }}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  minHeight: '40px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-status-problem-border)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-status-problem)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>Reload Latest Profile</span>
              </button>
            </div>
          )}

          {orderedErrors.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '13px',
                fontWeight: 400,
              }}
            >
              {orderedErrors.map((entry) => (
                <li key={entry.field}>
                  {entry.inputId ? (
                    <button
                      type="button"
                      onClick={() => focusFieldById(entry.inputId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--color-status-problem)',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {entry.label}:
                    </button>
                  ) : (
                    <strong>{entry.label}:</strong>
                  )}{' '}
                  <span>{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FORM / VIEW CONTAINER */}
      <form onSubmit={handleSaveProfile} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* ========================================================= */}
          {/* 1. CONTACT INFORMATION SECTION                             */}
          {/* ========================================================= */}
          <section
            className="card pharmacy-section-card"
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
              <div className="pharmacy-grid-2">
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Pharmacy Trade Name
                  </span>
                  <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                    {serverProfile.name}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Owner / Contact Person
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} color="var(--color-action-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '15px', color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                      {serverProfile.ownerName || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Contact Phone Number
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={15} color="var(--color-action-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    {serverProfile.phone ? (
                      <a
                        href={`tel:${serverProfile.phone}`}
                        style={{ fontSize: '15px', color: 'var(--color-action-primary)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-word' }}
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
                    <Mail size={15} color="var(--color-action-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
                    {serverProfile.email ? (
                      <a
                        href={`mailto:${serverProfile.email}`}
                        style={{ fontSize: '15px', color: 'var(--color-action-primary)', textDecoration: 'none', wordBreak: 'break-all' }}
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
              <div className="pharmacy-grid-2">
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
                    autoComplete="organization"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                    onBlur={() => handleFieldBlur('name', name)}
                    disabled={isSaving}
                    placeholder="e.g., Popular Medical Hall"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'field-name-error' : undefined}
                    className={`medifind-input${fieldErrors.name ? ' is-invalid' : ''}`}
                  />
                  {fieldErrors.name && (
                    <span id="field-name-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                    autoComplete="name"
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      clearFieldError('ownerName');
                    }}
                    onBlur={() => handleFieldBlur('ownerName', ownerName)}
                    disabled={isSaving}
                    placeholder="e.g., Kazi Nazrul Islam, R.Ph"
                    aria-invalid={Boolean(fieldErrors.ownerName)}
                    aria-describedby={fieldErrors.ownerName ? 'field-owner-error' : undefined}
                    className={`medifind-input${fieldErrors.ownerName ? ' is-invalid' : ''}`}
                  />
                  {fieldErrors.ownerName && (
                    <span id="field-owner-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      clearFieldError('phone');
                    }}
                    onBlur={() => handleFieldBlur('phone', phone)}
                    disabled={isSaving}
                    placeholder="e.g., +8801712345678"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'field-phone-error' : undefined}
                    className={`medifind-input${fieldErrors.phone ? ' is-invalid' : ''}`}
                  />
                  {fieldErrors.phone && (
                    <span id="field-phone-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    onBlur={() => handleFieldBlur('email', email)}
                    disabled={isSaving}
                    placeholder="e.g., contact@pharmacy.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'field-email-error' : undefined}
                    className={`medifind-input${fieldErrors.email ? ' is-invalid' : ''}`}
                  />
                  {fieldErrors.email && (
                    <span id="field-email-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
            className="card pharmacy-section-card"
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
                    <strong style={{ fontSize: '16px', color: 'var(--color-text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {serverProfile.address || serverProfile.formattedAddress || 'No formatted address on file'}
                    </strong>
                  </div>
                </div>

                <div
                  className="pharmacy-grid-compact"
                  style={{
                    marginTop: '8px',
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                      Street Address &amp; Building
                    </span>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
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
                    Street Address &amp; Building Details <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="field-street"
                    type="text"
                    autoComplete="street-address"
                    value={streetAddress}
                    onChange={(e) => {
                      setStreetAddress(e.target.value);
                      clearFieldError('streetAddress');
                    }}
                    onBlur={() => handleFieldBlur('streetAddress', streetAddress)}
                    disabled={isSaving}
                    placeholder="e.g., House 42, Road 11, Block D"
                    aria-invalid={Boolean(fieldErrors.streetAddress)}
                    aria-describedby={fieldErrors.streetAddress ? 'field-street-error' : undefined}
                    className={`medifind-input${fieldErrors.streetAddress ? ' is-invalid' : ''}`}
                  />
                  {fieldErrors.streetAddress && (
                    <span id="field-street-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                      {fieldErrors.streetAddress}
                    </span>
                  )}
                </div>

                <div className="pharmacy-grid-compact">
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
                        clearFieldError('area');
                      }}
                      onBlur={() => handleFieldBlur('area', area)}
                      disabled={isSaving}
                      placeholder="e.g., Banani, Dhanmondi"
                      aria-invalid={Boolean(fieldErrors.area)}
                      aria-describedby={fieldErrors.area ? 'field-area-error' : undefined}
                      className={`medifind-input${fieldErrors.area ? ' is-invalid' : ''}`}
                    />
                    {fieldErrors.area && (
                      <span id="field-area-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        clearFieldError('city');
                      }}
                      onBlur={() => handleFieldBlur('city', city)}
                      disabled={isSaving}
                      placeholder="e.g., Dhaka, Chattogram"
                      aria-invalid={Boolean(fieldErrors.city)}
                      aria-describedby={fieldErrors.city ? 'field-city-error' : undefined}
                      className={`medifind-input${fieldErrors.city ? ' is-invalid' : ''}`}
                    />
                    {fieldErrors.city && (
                      <span id="field-city-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={postalCode}
                      onChange={(e) => {
                        setPostalCode(e.target.value);
                        clearFieldError('postalCode');
                      }}
                      onBlur={() => handleFieldBlur('postalCode', postalCode)}
                      disabled={isSaving}
                      placeholder="e.g., 1213"
                      aria-invalid={Boolean(fieldErrors.postalCode)}
                      aria-describedby={fieldErrors.postalCode ? 'field-postal-error' : undefined}
                      className={`medifind-input${fieldErrors.postalCode ? ' is-invalid' : ''}`}
                    />
                    {fieldErrors.postalCode && (
                      <span id="field-postal-error" role="alert" style={{ display: 'block', fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
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
                    wordBreak: 'break-word',
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
            className="card pharmacy-section-card"
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
                  Location &amp; Map Coordinates
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
                    padding: '14px 16px',
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
                        serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE
                      }&mlon=${serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE}#map=16/${
                        serverProfile.latitude ?? serverProfile.location?.coordinates[1] ?? DEFAULT_LATITUDE
                      }/${serverProfile.longitude ?? serverProfile.location?.coordinates[0] ?? DEFAULT_LONGITUDE}`}
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
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.latitude;
                        delete next.longitude;
                        return next;
                      });
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
            className="card pharmacy-section-card"
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
                  tabIndex={-1}
                  style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}
                >
                  Opening Hours &amp; Schedule
                </h2>
              </div>
            </div>

            {!isEditing ? (
              // Opening Hours View Mode
              <div>
                <div className="pharmacy-grid-hours" style={{ marginBottom: '16px' }}>
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
                          flexWrap: 'wrap',
                          gap: '6px',
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
                    lineHeight: 1.5,
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
                    clearFieldError('openingHours');
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
            className="card pharmacy-section-card"
            aria-labelledby="license-heading"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
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
                  Licensing &amp; Regulatory Accreditation
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

            <div className="pharmacy-grid-compact" style={{ marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Drug Trade License Number
                </span>
                <code style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', wordBreak: 'break-word' }}>
                  {serverProfile.licenseNo || 'Pending Documentation'}
                </code>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block' }}>
                  Issuing Regulatory Body
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {serverProfile.issuingAuthority || 'Not specified'}
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
            <div className="profile-sticky-bar" role="region" aria-label="Profile editing actions">
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isDirty ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--color-status-caution)',
                      fontWeight: 600,
                    }}
                  >
                    <AlertCircle size={15} aria-hidden="true" />
                    <span>Unsaved changes</span>
                  </span>
                ) : (
                  <span>No unsaved changes</span>
                )}
              </div>

              <div className="profile-sticky-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="btn-secondary"
                  style={{
                    padding: '10px 16px',
                    minHeight: '44px',
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
                    padding: '10px 20px',
                    minHeight: '44px',
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDiscardModal(false);
              setPendingNavigationTarget(null);
            }
          }}
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
            className="card pharmacy-modal-panel"
            style={{
              maxWidth: '440px',
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                ref={keepEditingBtnRef}
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  setPendingNavigationTarget(null);
                }}
                className="btn-secondary"
                style={{
                  padding: '10px 16px',
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={executeDiscard}
                style={{
                  padding: '10px 16px',
                  minHeight: '44px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-status-problem)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {pendingNavigationTarget ? 'Discard & Leave' : 'Discard Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
