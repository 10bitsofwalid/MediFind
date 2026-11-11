// src/features/admin/CatalougeManager.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import type { Medicine } from '../../types/medicine';
import {
  ChevronLeft,
  Pill,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Power,
} from 'lucide-react';

export const CatalougeManager: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Medicine form fields
  const [name, setName] = useState<string>('');
  const [genericName, setGenericName] = useState<string>('');
  const [form, setForm] = useState<string>('Tablet');
  const [strength, setStrength] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [prescriptionRequired, setPrescriptionRequired] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    adminService
      .getCatalogueMedicines()
      .then((list) => {
        if (isMounted) {
          setMedicines(list);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMsg('Failed to load medicine catalogue.');
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.strength.toLowerCase().includes(q)
    );
  }, [medicines, searchQuery]);

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim() || !genericName.trim() || !strength.trim()) {
      setErrorMsg('Brand/medicine name, generic name, and strength are required.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await adminService.createCatalogueMedicine({
        name,
        genericName,
        form,
        strength,
        manufacturer,
        prescriptionRequired,
      });
      setMedicines((prev) => [created, ...prev]);
      setName('');
      setGenericName('');
      setStrength('');
      setManufacturer('');
      setPrescriptionRequired(false);
      setSuccessMsg(`Added "${created.name}" (${created.strength}) to curated catalogue.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create medicine entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (med: Medicine) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await adminService.toggleMedicineActive(med.id, !med.active);
      setMedicines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSuccessMsg(
        `"${updated.name}" is now ${updated.active ? 'active' : 'inactive'} in the catalogue.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update catalogue status.');
    }
  };

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '24px 16px 80px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link
          to="/admin/dashboard"
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
          <span>Back to Admin Dashboard</span>
        </Link>
      </div>

      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          Medicine Catalogue Manager
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Create and maintain curated medicine entries available for customer search and pharmacy inventory listings.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-problem-bg)',
            border: '1px solid rgba(180, 35, 47, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-problem)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add New Catalogue Medicine Form */}
      <section
        className="card"
        aria-labelledby="add-medicine-heading"
        style={{
          backgroundColor: 'var(--color-surface-panel)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px',
        }}
      >
        <h2 id="add-medicine-heading" style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 14px' }}>
          Add Curated Medicine
        </h2>

        <form onSubmit={handleAddMedicine} noValidate>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '14px',
            }}
          >
            <div>
              <label htmlFor="cat-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Medicine / Brand Name *
              </label>
              <input
                id="cat-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter medicine name"
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label htmlFor="cat-generic" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Generic Name *
              </label>
              <input
                id="cat-generic"
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="Enter generic compound"
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label htmlFor="cat-form" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Dosage Form *
              </label>
              <select
                id="cat-form"
                value={form}
                onChange={(e) => setForm(e.target.value)}
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  fontSize: '14px',
                }}
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Drops">Drops</option>
                <option value="Ointment">Ointment</option>
              </select>
            </div>

            <div>
              <label htmlFor="cat-strength" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Strength *
              </label>
              <input
                id="cat-strength"
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 500 mg"
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label htmlFor="cat-manufacturer" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Manufacturer (Optional)
              </label>
              <input
                id="cat-manufacturer"
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Enter manufacturer"
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={prescriptionRequired}
                onChange={(e) => setPrescriptionRequired(e.target.checked)}
                disabled={isSaving}
                style={{ accentColor: 'var(--color-action-primary)' }}
              />
              <span>Prescription required</span>
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{isSaving ? 'Adding...' : 'Add to Catalogue'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Catalogue List */}
      <section aria-label="Curated medicine entries">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Catalogue Entries ({filteredMedicines.length})
          </h2>

          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '320px', flex: 1 }}>
            <Search
              size={15}
              color="var(--color-text-secondary)"
              style={{ position: 'absolute', left: '12px', top: '12px', pointerEvents: 'none' }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalogue..."
              aria-label="Search medicine catalogue"
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--color-text-secondary)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
            <span>Loading catalogue...</span>
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px dashed var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Pill size={30} style={{ margin: '0 auto 10px' }} aria-hidden="true" />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              {medicines.length === 0 ? 'No Catalogue Medicines Added Yet' : 'No Matching Medicines'}
            </div>
            <div style={{ fontSize: '13px' }}>
              {medicines.length === 0
                ? 'Use the form above to add curated medicines to the platform catalogue.'
                : 'Try adjusting your search query.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredMedicines.map((med) => (
              <div
                key={med.id}
                className="card"
                style={{
                  backgroundColor: 'var(--color-surface-panel)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>{med.name}</strong>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '1px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface-canvas)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {med.strength} • {med.form}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: med.active
                          ? 'var(--color-status-available-bg)'
                          : 'var(--color-status-neutral-bg)',
                        color: med.active ? 'var(--color-status-available)' : 'var(--color-status-neutral)',
                      }}
                    >
                      {med.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Generic: {med.genericName}
                    {med.manufacturer ? ` • ${med.manufacturer}` : ''}
                    {med.prescriptionRequired ? ' • Prescription Required' : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleActive(med)}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-canvas)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Power size={13} aria-hidden="true" />
                  <span>{med.active ? 'Deactivate' : 'Activate'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

