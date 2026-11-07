// src/features/pharmacy/PharmacyRegisterPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  PharmacyApplicationPayload,
  PharmacyApplicationResponse,
  WeeklyHours,
  LocationGeoJSON,
} from '../../types/pharmacy';
import {
  submitPharmacyApplication,
  getPharmacyApplication,
  createDefaultWeeklyHours,
  formatWeeklyHours,
  isMockApiEnabled,
  setMockApiEnabled,
  PharmacyServiceError,
} from '../../services/pharmacyService';
import { LocationPicker } from '../../components/LocationPicker';
import { OpeningHoursBuilder } from '../../components/OpeningHoursBuilder';
import {
  Building2,
  MapPin,
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Send,
  Printer,
  ChevronRight,
  Info,
} from 'lucide-react';

interface FormErrors {
  [key: string]: string;
}

type FormStep = 'business' | 'address' | 'license' | 'hours' | 'review';

export const PharmacyRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Active step
  const [currentStep, setCurrentStep] = useState<FormStep>('business');

  // Form Field State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Dhaka');
  const [area, setArea] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [latitude, setLatitude] = useState<number>(23.8103);
  const [longitude, setLongitude] = useState<number>(90.4125);

  const [licenseNo, setLicenseNo] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('Directorate General of Drug Administration (DGDA)');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [licenseType, setLicenseType] = useState('Retail Pharmacy');

  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(createDefaultWeeklyHours());
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // UI feedback state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrorDetails, setServerErrorDetails] = useState<{ code?: string; fields?: Record<string, string> } | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [useDevAdapter, setUseDevAdapter] = useState(isMockApiEnabled());

  // Successful submission result from server
  const [submittedApplication, setSubmittedApplication] = useState<PharmacyApplicationResponse | null>(null);

  // Check for existing pending application on load
  useEffect(() => {
    let isMounted = true;
    async function checkExisting() {
      try {
        const existing = await getPharmacyApplication();
        if (isMounted && existing) {
          setSubmittedApplication(existing);
        }
      } catch {
        // Backend might be offline or no application yet; safe to ignore
      } finally {
        if (isMounted) setIsCheckingExisting(false);
      }
    }
    checkExisting();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDevAdapterToggle = (enabled: boolean) => {
    setUseDevAdapter(enabled);
    setMockApiEnabled(enabled);
  };

  // Validation rules
  const validateField = (field: string, value: string | number): string => {
    const stringVal = String(value);
    switch (field) {
      case 'name':
        if (!stringVal || !stringVal.trim()) return 'Pharmacy trade name is required.';
        if (stringVal.trim().length < 3) return 'Pharmacy name must be at least 3 characters.';
        return '';
      case 'ownerName':
        if (!stringVal || !stringVal.trim()) return 'Owner / authorized applicant name is required.';
        return '';
      case 'phone':
        if (!stringVal || !stringVal.trim()) return 'Contact phone number is required.';
        if (!/^[+0-9\s-]{10,16}$/.test(stringVal.trim())) {
          return 'Enter a valid phone number (at least 10 digits).';
        }
        return '';
      case 'email':
        if (!stringVal || !stringVal.trim()) return 'Official business email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringVal.trim())) {
          return 'Enter a valid email address.';
        }
        return '';
      case 'streetAddress':
        if (!stringVal || !stringVal.trim()) return 'Street address and building details are required.';
        return '';
      case 'city':
        if (!stringVal || !stringVal.trim()) return 'City or district is required.';
        return '';
      case 'area':
        if (!stringVal || !stringVal.trim()) return 'Area / locality name is required.';
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
      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: string | number) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  // Step-level validation
  const validateStep = (step: FormStep): boolean => {
    const stepErrors: FormErrors = {};

    if (step === 'business') {
      const nameErr = validateField('name', name);
      const ownerErr = validateField('ownerName', ownerName);
      const phoneErr = validateField('phone', phone);
      const emailErr = validateField('email', email);
      if (nameErr) stepErrors.name = nameErr;
      if (ownerErr) stepErrors.ownerName = ownerErr;
      if (phoneErr) stepErrors.phone = phoneErr;
      if (emailErr) stepErrors.email = emailErr;
    } else if (step === 'address') {
      const streetErr = validateField('streetAddress', streetAddress);
      const cityErr = validateField('city', city);
      const areaErr = validateField('area', area);
      const latErr = validateField('latitude', latitude);
      const lngErr = validateField('longitude', longitude);
      if (streetErr) stepErrors.streetAddress = streetErr;
      if (cityErr) stepErrors.city = cityErr;
      if (areaErr) stepErrors.area = areaErr;
      if (latErr) stepErrors.latitude = latErr;
      if (lngErr) stepErrors.longitude = lngErr;
    } else if (step === 'license') {
      const licenseErr = validateField('licenseNo', licenseNo);
      const authErr = validateField('issuingAuthority', issuingAuthority);
      if (licenseErr) stepErrors.licenseNo = licenseErr;
      if (authErr) stepErrors.issuingAuthority = authErr;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 'business') {
      if (validateStep('business')) setCurrentStep('address');
    } else if (currentStep === 'address') {
      if (validateStep('address')) setCurrentStep('license');
    } else if (currentStep === 'license') {
      if (validateStep('license')) setCurrentStep('hours');
    } else if (currentStep === 'hours') {
      setCurrentStep('review');
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'address') setCurrentStep('business');
    else if (currentStep === 'license') setCurrentStep('address');
    else if (currentStep === 'hours') setCurrentStep('license');
    else if (currentStep === 'review') setCurrentStep('hours');
  };

  // Submit Handler
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setServerErrorDetails(null);

    // Validate all steps
    const isBusinessValid = validateStep('business');
    const isAddressValid = validateStep('address');
    const isLicenseValid = validateStep('license');

    if (!isBusinessValid) {
      setCurrentStep('business');
      return;
    }
    if (!isAddressValid) {
      setCurrentStep('address');
      return;
    }
    if (!isLicenseValid) {
      setCurrentStep('license');
      return;
    }

    if (!declarationConfirmed) {
      setSubmitError('Please review and check the legal accuracy declaration before submitting.');
      return;
    }

    setIsSubmitting(true);

    const formattedAddress = `${streetAddress.trim()}, ${area.trim()}, ${city.trim()}${
      postalCode.trim() ? ' - ' + postalCode.trim() : ''
    }`;

    const locationGeoJSON: LocationGeoJSON = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    const payload: PharmacyApplicationPayload = {
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      streetAddress: streetAddress.trim(),
      city: city.trim(),
      area: area.trim(),
      postalCode: postalCode.trim() || undefined,
      formattedAddress,
      licenseNo: licenseNo.trim(),
      issuingAuthority: issuingAuthority.trim(),
      licenseExpiryDate: licenseExpiryDate || undefined,
      licenseType,
      latitude,
      longitude,
      location: locationGeoJSON,
      openingHours: formatWeeklyHours(weeklyHours),
      structuredHours: weeklyHours,
      notes: additionalNotes.trim() || undefined,
    };

    try {
      const response = await submitPharmacyApplication(payload);
      // Server returned confirmation with authoritative 'pending' status
      setSubmittedApplication(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      console.error('Pharmacy application submission error:', err);

      let msg = 'Failed to submit pharmacy application. ';
      let errCode: string | undefined;
      let errFields: Record<string, string> | undefined;

      if (err instanceof PharmacyServiceError) {
        errCode = err.code;
        errFields = err.fields;
        if (err.code === 'DUPLICATE_LICENSE' || err.status === 409) {
          msg = 'This Drug License Number is already registered or currently under review.';
        } else if (err.code === 'VALIDATION_ERROR' || err.status === 422) {
          msg = err.message || 'Please review highlighted fields according to validation requirements.';
        } else if (err.status === 404) {
          msg =
            'Backend endpoint POST /owner/pharmacy-applications not found on server (404). Backend contract is in draft.';
        } else {
          msg += err.message;
        }
      } else if (err instanceof Error) {
        if (err.message.includes('Network Error')) {
          msg =
            'Network error: Backend server is offline or unreachable at the configured API base URL. Please ensure your backend service is running or enable the local development adapter.';
        } else {
          msg += err.message;
        }
      } else {
        msg += 'An unexpected error occurred. Your entered data has been preserved.';
      }

      setSubmitError(msg);
      if (errFields) {
        setServerErrorDetails({ code: errCode, fields: errFields });
        setErrors((prev) => ({ ...prev, ...errFields }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingExisting) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div className="spinner" aria-hidden="true" />
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
          Checking pharmacy application records...
        </span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PENDING REVIEW CONFIRMATION
  // -------------------------------------------------------------
  if (submittedApplication) {
    const appData = submittedApplication.data;

    return (
      <div className="onboarding-confirmation-page" style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Authoritative Pending Review Header Card */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 28px',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '28px',
            textAlign: 'center',
          }}
        >
          {/* Status Icon Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-caution-bg)',
              color: 'var(--color-status-caution)',
              border: '1px solid rgba(152, 88, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
            aria-hidden="true"
          >
            <Clock3 size={36} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-status-caution-bg)',
              border: '1px solid rgba(152, 88, 0, 0.25)',
              color: 'var(--color-status-caution)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              marginBottom: '12px',
            }}
          >
            <Clock size={14} aria-hidden="true" />
            <span>APPLICATION STATUS: PENDING REVIEW</span>
          </div>

          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.25,
              marginBottom: '12px',
            }}
          >
            Pharmacy Application Submitted
          </h1>

          <p
            style={{
              fontSize: '16px',
              color: 'var(--color-text-secondary)',
              maxWidth: '600px',
              margin: '0 auto 20px',
              lineHeight: 1.5,
            }}
          >
            Your application for <strong>{appData.name}</strong> has been received by MediFind and is currently
            queued for administrator regulatory verification.
          </p>

          {/* Trust and Non-Publication Guarantee Notice */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--color-surface-canvas)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'left',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <Info size={20} color="var(--color-action-primary)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <div>
              <strong style={{ color: 'var(--color-text-primary)', display: 'block', marginBottom: '2px' }}>
                Important Listing Notice
              </strong>
              In accordance with MediFind safety standards and healthcare integrity rules, your pharmacy is{' '}
              <strong>not publicly listed or verified</strong> yet. Medicine stock reporting and reservations remain locked
              until an administrator verifies your drug trade licence with official registries.
            </div>
          </div>

          {/* Reference Meta */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '24px',
              padding: '14px',
              backgroundColor: 'var(--color-surface-canvas)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <div>
              <span style={{ fontWeight: 500 }}>Application Reference: </span>
              <code style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {submittedApplication.applicationId}
              </code>
            </div>
            <div>
              <span style={{ fontWeight: 500 }}>Submitted: </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {new Date(submittedApplication.submittedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Next Steps Card */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px 28px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '28px',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShieldCheck size={20} color="var(--color-action-primary)" aria-hidden="true" />
            <span>Verification Process & Timeline</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-action-subtle)',
                  color: 'var(--color-action-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
                  Document & Licence Validation
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Our compliance team cross-checks your Drug License ({appData.licenseNo}) with the{' '}
                  {appData.issuingAuthority} regulatory registry.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-action-subtle)',
                  color: 'var(--color-action-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
                  Physical & Geolocation Verification
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  We verify your pharmacy address and entrance coordinates so nearby patients receive reliable routing.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-action-subtle)',
                  color: 'var(--color-action-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
                  Activation & Public Listing
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Average review time is <strong>1 to 2 business days</strong>. You will be notified when your status transitions
                  to Verified.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Summary Record Card */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px 28px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Submitted Application Record
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Printer size={14} aria-hidden="true" />
              <span>Print Summary</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              fontSize: '14px',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Pharmacy Name
              </span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{appData.name}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Applicant / Owner Name
              </span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{appData.ownerName}</strong>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Contact Phone & Email
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {appData.phone} • {appData.email}
              </span>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Drug License Number
              </span>
              <code style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{appData.licenseNo}</code>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Regulatory Authority
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{appData.issuingAuthority}</span>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Pharmacy Category
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{appData.licenseType || 'Retail Pharmacy'}</span>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Physical Address
              </span>
              <span style={{ color: 'var(--color-text-primary)' }}>{appData.formattedAddress}</span>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Coordinates (Lat, Lng)
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                {appData.latitude.toFixed(6)}, {appData.longitude.toFixed(6)}
              </span>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px', display: 'block' }}>
                Weekly Operating Hours
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>
                {appData.openingHours}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/pharmacy/dashboard')}
            className="btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-action-primary)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '48px',
            }}
          >
            <span>Go to Pharmacy Workspace</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Are you sure you want to start a new application? This will allow you to edit or submit another pharmacy profile.'
                )
              ) {
                setSubmittedApplication(null);
                setCurrentStep('business');
              }
            }}
            className="btn-secondary"
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              minHeight: '48px',
            }}
          >
            Start Another Application
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: APPLICATION FORM (Step-by-Step Flow)
  // -------------------------------------------------------------
  const stepConfig = [
    { id: 'business', label: '1. Business Info', icon: Building2 },
    { id: 'address', label: '2. Address & Location', icon: MapPin },
    { id: 'license', label: '3. License Details', icon: FileCheck2 },
    { id: 'hours', label: '4. Opening Hours', icon: Clock },
    { id: 'review', label: '5. Review & Submit', icon: ShieldCheck },
  ];

  return (
    <div
      className="pharmacy-onboarding-container"
      style={{
        maxWidth: '840px',
        margin: '0 auto',
        padding: '24px 16px 64px',
      }}
    >
      {/* Top Banner / Header */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-action-subtle)',
            color: 'var(--color-action-primary)',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '10px',
          }}
        >
          <Building2 size={14} aria-hidden="true" />
          <span>PHARMACY OWNER ONBOARDING</span>
        </div>

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
          }}
        >
          Register Your Pharmacy
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: 'var(--color-text-secondary)',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Submit your official pharmacy identity, licensing details, and location to join the MediFind healthcare
          discovery network.
        </p>

        {/* Development Environment Mock API Toggle */}
        <div
          style={{
            marginTop: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>API Connection:</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useDevAdapter}
              onChange={(e) => handleDevAdapterToggle(e.target.checked)}
              style={{ accentColor: 'var(--color-action-primary)' }}
            />
            <span style={{ fontWeight: 500 }}>
              {useDevAdapter ? 'Development Adapter (Mock)' : 'Live API (/api/v1)'}
            </span>
          </label>
        </div>
      </div>

      {/* Step Navigation Bar (Responsive & Accessible) */}
      <nav
        aria-label="Application Progress"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '28px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {stepConfig.map((s, idx) => {
          const isActive = currentStep === s.id;
          const isPassed =
            stepConfig.findIndex((x) => x.id === currentStep) > idx;
          const Icon = s.icon;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                // Allow clicking previous steps or valid steps
                if (isPassed || isActive) {
                  setCurrentStep(s.id as FormStep);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: isActive
                  ? '1px solid var(--color-action-primary)'
                  : isPassed
                  ? '1px solid var(--color-status-available)'
                  : '1px solid var(--color-border-default)',
                backgroundColor: isActive
                  ? 'var(--color-action-primary)'
                  : isPassed
                  ? 'var(--color-status-available-bg)'
                  : 'var(--color-surface-panel)',
                color: isActive
                  ? '#ffffff'
                  : isPassed
                  ? 'var(--color-status-available)'
                  : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: isPassed || isActive ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                minHeight: '44px',
                flexShrink: 0,
              }}
              aria-current={isActive ? 'step' : undefined}
            >
              {isPassed ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : (
                <Icon size={16} aria-hidden="true" />
              )}
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Server Error Alert Banner */}
      {submitError && (
        <div
          role="alert"
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-status-problem)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Submission Unsuccessful</strong>
            <p style={{ margin: 0 }}>{submitError}</p>
            {serverErrorDetails?.code && (
              <span style={{ fontSize: '12px', opacity: 0.85, marginTop: '4px', display: 'block' }}>
                Error Code: <code>{serverErrorDetails.code}</code>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Application Form Container */}
      <form onSubmit={handleSubmitApplication} noValidate>
        <div
          className="card form-panel"
          style={{
            backgroundColor: 'var(--color-surface-panel)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 24px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '24px',
          }}
        >
          {/* ========================================================= */}
          {/* STEP 1: BUSINESS & CONTACT INFORMATION                    */}
          {/* ========================================================= */}
          {currentStep === 'business' && (
            <section aria-labelledby="step-1-title" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2
                  id="step-1-title"
                  style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}
                >
                  1. Business and Contact Information
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Enter your registered trade name and official contact channels for verification and patient inquiries.
                </p>
              </div>

              {/* Pharmacy Trade Name */}
              <div>
                <label
                  htmlFor="pharmacy-name"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Pharmacy Name <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                </label>
                <input
                  id="pharmacy-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (touched.name) handleBlur('name', e.target.value);
                  }}
                  onBlur={(e) => handleBlur('name', e.target.value)}
                  placeholder="e.g. HealthFirst Pharmacy & Diagnostic"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : 'name-hint'}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-md)',
                    border: errors.name ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                  }}
                />
                {errors.name ? (
                  <span id="name-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} aria-hidden="true" /> {errors.name}
                  </span>
                ) : (
                  <span id="name-hint" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                    As registered on your Drug Trade Licence.
                  </span>
                )}
              </div>

              {/* Owner / Representative Name */}
              <div>
                <label
                  htmlFor="owner-name"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Authorized Owner / Pharmacist Name <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                </label>
                <input
                  id="owner-name"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    if (touched.ownerName) handleBlur('ownerName', e.target.value);
                  }}
                  onBlur={(e) => handleBlur('ownerName', e.target.value)}
                  placeholder="e.g. Dr. Mohammad Aminul Islam"
                  aria-invalid={!!errors.ownerName}
                  aria-describedby={errors.ownerName ? 'owner-error' : undefined}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-md)',
                    border: errors.ownerName ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                  }}
                />
                {errors.ownerName && (
                  <span id="owner-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} aria-hidden="true" /> {errors.ownerName}
                  </span>
                )}
              </div>

              {/* Phone & Email Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="contact-phone"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Public Contact Phone <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (touched.phone) handleBlur('phone', e.target.value);
                    }}
                    onBlur={(e) => handleBlur('phone', e.target.value)}
                    placeholder="e.g. +8801712345678"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: errors.phone ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                  {errors.phone ? (
                    <span id="phone-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} aria-hidden="true" /> {errors.phone}
                    </span>
                  ) : (
                    <span id="phone-hint" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                      Used by customers to call and verify stock.
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Official Email Address <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) handleBlur('email', e.target.value);
                    }}
                    onBlur={(e) => handleBlur('email', e.target.value)}
                    placeholder="e.g. pharmacy@healthfirst.bd"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : 'email-hint'}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: errors.email ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                  {errors.email ? (
                    <span id="email-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} aria-hidden="true" /> {errors.email}
                    </span>
                  ) : (
                    <span id="email-hint" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                      For verification notifications and account recovery.
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* STEP 2: PHARMACY ADDRESS & LOCATION                       */}
          {/* ========================================================= */}
          {currentStep === 'address' && (
            <section aria-labelledby="step-2-title" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2
                  id="step-2-title"
                  style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}
                >
                  2. Pharmacy Physical Address & Coordinates
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Accurate physical address and coordinates ensure patients in urgent need find your door easily.
                </p>
              </div>

              {/* Street Address */}
              <div>
                <label
                  htmlFor="street-address"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Street Address & Building <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                </label>
                <input
                  id="street-address"
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => {
                    setStreetAddress(e.target.value);
                    if (touched.streetAddress) handleBlur('streetAddress', e.target.value);
                  }}
                  onBlur={(e) => handleBlur('streetAddress', e.target.value)}
                  placeholder="e.g. House 42, Road 7, Sector 3"
                  aria-invalid={!!errors.streetAddress}
                  aria-describedby={errors.streetAddress ? 'street-error' : undefined}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-md)',
                    border: errors.streetAddress ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                  }}
                />
                {errors.streetAddress && (
                  <span id="street-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} aria-hidden="true" /> {errors.streetAddress}
                  </span>
                )}
              </div>

              {/* City, Area, Postal Code */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="pharmacy-city"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    City / District <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="pharmacy-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      if (touched.city) handleBlur('city', e.target.value);
                    }}
                    onBlur={(e) => handleBlur('city', e.target.value)}
                    placeholder="e.g. Dhaka"
                    aria-invalid={!!errors.city}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: errors.city ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                  {errors.city && (
                    <span role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} aria-hidden="true" /> {errors.city}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="pharmacy-area"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Area / Thana <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="pharmacy-area"
                    type="text"
                    required
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      if (touched.area) handleBlur('area', e.target.value);
                    }}
                    onBlur={(e) => handleBlur('area', e.target.value)}
                    placeholder="e.g. Uttara / Dhanmondi"
                    aria-invalid={!!errors.area}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: errors.area ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                  {errors.area && (
                    <span role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={14} aria-hidden="true" /> {errors.area}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="pharmacy-postal"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Postal Code <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>(Optional)</span>
                  </label>
                  <input
                    id="pharmacy-postal"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 1230"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                </div>
              </div>

              {/* Interactive Location Picker & Map */}
              <div style={{ marginTop: '8px' }}>
                <label
                  style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Map Coordinates & Entrance Pin <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                </label>
                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setErrors((prev) => ({ ...prev, latitude: '', longitude: '' }));
                  }}
                  error={errors.latitude || errors.longitude}
                />
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* STEP 3: LICENSE DETAILS                                   */}
          {/* ========================================================= */}
          {currentStep === 'license' && (
            <section aria-labelledby="step-3-title" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2
                  id="step-3-title"
                  style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}
                >
                  3. Legal & Drug Trade License Details
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  MediFind enforces official regulatory licensing to safeguard medicine discovery and prevent illicit distribution.
                </p>
              </div>

              {/* License Number */}
              <div>
                <label
                  htmlFor="license-no"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Drug License Number <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                </label>
                <input
                  id="license-no"
                  type="text"
                  required
                  value={licenseNo}
                  onChange={(e) => {
                    setLicenseNo(e.target.value);
                    if (touched.licenseNo) handleBlur('licenseNo', e.target.value);
                  }}
                  onBlur={(e) => handleBlur('licenseNo', e.target.value)}
                  placeholder="e.g. DL-DHK-2024-98412"
                  aria-invalid={!!errors.licenseNo}
                  aria-describedby={errors.licenseNo ? 'license-error' : 'license-hint'}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-md)',
                    border: errors.licenseNo ? '1px solid var(--color-status-problem)' : '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                {errors.licenseNo ? (
                  <span id="license-error" role="alert" style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} aria-hidden="true" /> {errors.licenseNo}
                  </span>
                ) : (
                  <span id="license-hint" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                    Enter the unique identifier on your Drug Trade Licence issued by DGDA.
                  </span>
                )}
              </div>

              {/* Issuing Authority & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="issuing-authority"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Issuing Authority <span style={{ color: 'var(--color-status-problem)' }}>*</span>
                  </label>
                  <input
                    id="issuing-authority"
                    type="text"
                    required
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="license-type"
                    style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                  >
                    Pharmacy License Category
                  </label>
                  <select
                    id="license-type"
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                    }}
                  >
                    <option value="Retail Pharmacy">Retail Pharmacy (Model Pharmacy / Grade A)</option>
                    <option value="General Retail Pharmacy">General Retail Pharmacy</option>
                    <option value="Hospital In-House Pharmacy">Hospital In-House Pharmacy</option>
                    <option value="Community Healthcare Dispensary">Community Healthcare Dispensary</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label
                  htmlFor="license-expiry"
                  style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  License Expiry Date <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>(Optional)</span>
                </label>
                <input
                  id="license-expiry"
                  type="date"
                  value={licenseExpiryDate}
                  onChange={(e) => setLicenseExpiryDate(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    padding: '10px 14px',
                    fontSize: '15px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                  }}
                />
              </div>

              {/* Regulatory Assurance Callout */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: 'var(--color-surface-canvas)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck size={18} color="var(--color-action-primary)" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <span>
                  MediFind maintains an append-only audit trail for verification records. Your license credentials will only be inspected
                  by authorized administrators and are never publicly disclosed.
                </span>
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* STEP 4: OPENING HOURS SCHEDULE                            */}
          {/* ========================================================= */}
          {currentStep === 'hours' && (
            <section aria-labelledby="step-4-title" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2
                  id="step-4-title"
                  style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}
                >
                  4. Weekly Operating Hours
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Configure your weekly operating times. Patients rely on accurate hours when seeking urgent medicines.
                </p>
              </div>

              <OpeningHoursBuilder
                hours={weeklyHours}
                onChange={(updated) => setWeeklyHours(updated)}
              />
            </section>
          )}

          {/* ========================================================= */}
          {/* STEP 5: REVIEW & FINAL SUBMISSION                         */}
          {/* ========================================================= */}
          {currentStep === 'review' && (
            <section aria-labelledby="step-5-title" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2
                  id="step-5-title"
                  style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}
                >
                  5. Review Application and Submit
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Please confirm that all details are accurate before submitting to the administrator review queue.
                </p>
              </div>

              {/* Review Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* Business Info Card */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Business & Contact</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('business')}
                      style={{ fontSize: '12px', color: 'var(--color-action-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><span style={{ fontWeight: 500 }}>Name:</span> {name}</div>
                    <div><span style={{ fontWeight: 500 }}>Applicant:</span> {ownerName}</div>
                    <div><span style={{ fontWeight: 500 }}>Phone:</span> {phone}</div>
                    <div><span style={{ fontWeight: 500 }}>Email:</span> {email}</div>
                  </div>
                </div>

                {/* Address & Location Card */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Address & Coordinates</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('address')}
                      style={{ fontSize: '12px', color: 'var(--color-action-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><span style={{ fontWeight: 500 }}>Address:</span> {streetAddress}, {area}, {city}</div>
                    <div><span style={{ fontWeight: 500 }}>Coordinates:</span> {latitude.toFixed(6)}, {longitude.toFixed(6)}</div>
                  </div>
                </div>

                {/* License Card */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Licensing Evidence</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('license')}
                      style={{ fontSize: '12px', color: 'var(--color-action-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><span style={{ fontWeight: 500 }}>License No:</span> {licenseNo}</div>
                    <div><span style={{ fontWeight: 500 }}>Authority:</span> {issuingAuthority}</div>
                    <div><span style={{ fontWeight: 500 }}>Category:</span> {licenseType}</div>
                  </div>
                </div>

                {/* Hours Card */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-surface-canvas)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Opening Hours</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('hours')}
                      style={{ fontSize: '12px', color: 'var(--color-action-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {formatWeeklyHours(weeklyHours)}
                  </div>
                </div>
              </div>

              {/* Additional notes for review team */}
              <div>
                <label
                  htmlFor="additional-notes"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '6px' }}
                >
                  Optional Notes for Verification Administrator
                </label>
                <textarea
                  id="additional-notes"
                  rows={2}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="e.g. Located on ground floor opposite the general hospital emergency gate."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-text-primary)',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Legal Declaration Checkbox */}
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-surface-canvas)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={declarationConfirmed}
                    onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                    required
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--color-action-primary)',
                      marginTop: '2px',
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    <strong>Legal Declaration:</strong> I certify that I am the authorized owner or licensed pharmacist for{' '}
                    <strong>{name || 'this pharmacy'}</strong>, the drug trade license details provided are genuine and unexpired,
                    and I understand that submission creates a <strong>Pending</strong> record awaiting administrative verification
                    before public stock publishing is permitted.
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* Form Step Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '32px',
              paddingTop: '20px',
              borderTop: '1px solid var(--color-border-default)',
            }}
          >
            {currentStep !== 'business' ? (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isSubmitting}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  color: 'var(--color-text-secondary)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep !== 'review' ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-action-primary)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontWeight: 600,
                }}
              >
                <span>Continue</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !declarationConfirmed}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 28px',
                  fontSize: '15px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSubmitting || !declarationConfirmed ? 'var(--color-border-default)' : 'var(--color-action-primary)',
                  color: isSubmitting || !declarationConfirmed ? 'var(--color-text-secondary)' : '#ffffff',
                  border: 'none',
                  cursor: isSubmitting || !declarationConfirmed ? 'not-allowed' : 'pointer',
                  minHeight: '48px',
                  fontWeight: 600,
                  boxShadow: 'var(--shadow-sm)',
                }}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner-small" aria-hidden="true" />
                    <span>Submitting to Verification Queue...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} aria-hidden="true" />
                    <span>Submit Pharmacy Application</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
