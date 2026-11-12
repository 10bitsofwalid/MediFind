// src/features/pharmacy/InventoryMedicineModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type {
  Medicine,
  StockInventoryRecord,
  AddInventoryMedicinePayload,
  UpdateInventoryMedicinePayload,
} from '../../types/medicine';
import { stockService } from '../../services/stockService';
import { isMockApiEnabled } from '../../services/pharmacyService';
import { isDuplicateInventoryMedicine, validateOptionalQuantityInput } from './inventoryUtils';
import {
  X,
  AlertCircle,
  Pill,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

interface InventoryMedicineModalProps {
  mode: 'add' | 'edit';
  initialItem?: StockInventoryRecord | null;
  existingInventory?: StockInventoryRecord[];
  onClose: () => void;
  onSaveAdd?: (payload: AddInventoryMedicinePayload) => Promise<void>;
  onSaveEdit?: (stockId: string, payload: UpdateInventoryMedicinePayload) => Promise<void>;
  onSave?: (payload: AddInventoryMedicinePayload) => Promise<void>;
}

const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Inhaler',
  'Drops',
  'Ointment',
  'Cream',
];

const WRITABLE_STATUSES: {
  value: 'available' | 'low' | 'out';
  label: string;
  color: string;
  bg: string;
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}[] = [
  {
    value: 'available',
    label: 'Available',
    color: 'var(--color-status-available)',
    bg: 'var(--color-status-available-bg)',
    icon: CheckCircle2,
  },
  {
    value: 'low',
    label: 'Low',
    color: 'var(--color-status-caution)',
    bg: 'var(--color-status-caution-bg)',
    icon: AlertTriangle,
  },
  {
    value: 'out',
    label: 'Out of Stock',
    color: 'var(--color-status-problem)',
    bg: 'var(--color-status-problem-bg)',
    icon: XCircle,
  },
];

export const InventoryMedicineModal: React.FC<InventoryMedicineModalProps> = ({
  mode,
  initialItem,
  existingInventory = [],
  onClose,
  onSaveAdd,
  onSaveEdit,
  onSave,
}) => {
  const isEdit = mode === 'edit' && Boolean(initialItem);
  const isCatalogueLinkedEdit = Boolean(
    isEdit && initialItem?.medicineId && !initialItem.medicineId.startsWith('med_custom_')
  );
  const mockMode = isMockApiEnabled();

  const [selectedCatalogueMed, setSelectedCatalogueMed] = useState<Medicine | null>(null);
  const [useManualMockEntry, setUseManualMockEntry] = useState<boolean>(false);

  const [medicineId, setMedicineId] = useState<string | undefined>(() =>
    isEdit ? initialItem?.medicineId : undefined
  );
  const [medicineName, setMedicineName] = useState<string>(() =>
    isEdit ? initialItem?.medicineName || '' : ''
  );
  const [genericName, setGenericName] = useState<string>(() =>
    isEdit ? initialItem?.genericName || '' : ''
  );
  const [strength, setStrength] = useState<string>(() =>
    isEdit ? initialItem?.strength || '' : ''
  );
  const [form, setForm] = useState<string>(() =>
    isEdit ? initialItem?.form || 'Tablet' : 'Tablet'
  );
  const [manufacturer, setManufacturer] = useState<string>(() =>
    isEdit ? initialItem?.manufacturer || '' : ''
  );
  const [prescriptionRequired, setPrescriptionRequired] = useState<boolean>(() =>
    isEdit ? Boolean(initialItem?.prescriptionRequired) : false
  );
  const [status, setStatus] = useState<'available' | 'low' | 'out'>(() => {
    if (isEdit && initialItem) {
      if (
        initialItem.status === 'available' ||
        initialItem.status === 'low' ||
        initialItem.status === 'out'
      ) {
        return initialItem.status;
      }
    }
    return 'available';
  });
  const [quantityText, setQuantityText] = useState<string>(() =>
    isEdit && initialItem?.quantity !== undefined ? String(initialItem.quantity) : ''
  );
  const [priceText, setPriceText] = useState<string>(() =>
    isEdit && initialItem?.price !== undefined ? String(initialItem.price) : ''
  );
  const [notes, setNotes] = useState<string>(() =>
    isEdit ? initialItem?.notes || '' : ''
  );

  const [catalogueQuery, setCatalogueQuery] = useState<string>('');
  const [catalogueFormFilter, setCatalogueFormFilter] = useState<string>('all');
  const [catalogueMatches, setCatalogueMatches] = useState<Medicine[]>([]);
  const [isSearchingCatalogue, setIsSearchingCatalogue] = useState<boolean>(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueRefreshNonce, setCatalogueRefreshNonce] = useState<number>(0);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const firstStatusBtnRef = useRef<HTMLButtonElement | null>(null);

  // Restore focus to the trigger control when the dialog closes
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (mode === 'add') {
      searchInputRef.current?.focus();
    } else {
      firstStatusBtnRef.current?.focus();
    }
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [mode]);

  // Close modal with Escape key when not saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const loadCatalogue = useCallback(async (query: string, formFilter: string) => {
    setIsSearchingCatalogue(true);
    setCatalogueError(null);
    try {
      const list = await stockService.searchCatalogue(
        query,
        formFilter === 'all' ? undefined : formFilter
      );
      setCatalogueMatches(list);
    } catch (err: unknown) {
      setCatalogueMatches([]);
      setCatalogueError(
        err instanceof Error ? err.message : 'Unable to search the medicine catalogue.'
      );
    } finally {
      setIsSearchingCatalogue(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'add') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        loadCatalogue(catalogueQuery, catalogueFormFilter);
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, catalogueQuery, catalogueFormFilter, catalogueRefreshNonce, loadCatalogue]);

  const handleSelectCatalogueMedicine = (med: Medicine) => {
    setSelectedCatalogueMed(med);
    setUseManualMockEntry(false);
    setMedicineId(med.id);
    setMedicineName(med.name);
    setGenericName(med.genericName);
    setStrength(med.strength);
    setForm(med.form || 'Tablet');
    setManufacturer(med.manufacturer || '');
    setPrescriptionRequired(Boolean(med.prescriptionRequired));
    setErrorMsg(null);
    setFieldErrors({});
  };

  const handleClearCatalogueSelection = () => {
    setSelectedCatalogueMed(null);
    setMedicineId(undefined);
    setMedicineName('');
    setGenericName('');
    setStrength('');
    setForm('Tablet');
    setManufacturer('');
    setPrescriptionRequired(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const nextFieldErrors: Record<string, string> = {};

    if (mode === 'add' && !selectedCatalogueMed && !useManualMockEntry) {
      setErrorMsg(
        mockMode
          ? 'Select a medicine from the catalogue above, or switch to manual mock entry.'
          : 'Select an active medicine from the curated catalogue before adding it to inventory.'
      );
      return;
    }

    if (!medicineName.trim()) nextFieldErrors.medicineName = 'Medicine name is required.';
    if (!genericName.trim()) nextFieldErrors.genericName = 'Generic name is required.';
    if (!strength.trim()) nextFieldErrors.strength = 'Strength is required.';
    if (!form.trim()) nextFieldErrors.form = 'Dosage form is required.';

    const qtyValidation = validateOptionalQuantityInput(quantityText);
    if (!qtyValidation.valid && qtyValidation.error) {
      nextFieldErrors.quantity = qtyValidation.error;
    }

    const parsedPrice = priceText.trim() === '' ? undefined : Number(priceText.trim());
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      nextFieldErrors.price = 'Unit price must be a non-negative number.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMsg('Please review the highlighted fields below.');
      return;
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      if (isEdit && initialItem) {
        const editPayload: UpdateInventoryMedicinePayload = {
          status: status as StockStatus,
          quantity: qtyValidation.value === undefined ? null : qtyValidation.value,
          price: parsedPrice === undefined ? null : parsedPrice,
          notes: notes.trim(),
        };

        if (!isCatalogueLinkedEdit) {
          editPayload.medicineName = medicineName.trim();
          editPayload.genericName = genericName.trim();
          editPayload.strength = strength.trim();
          editPayload.form = form.trim();
          editPayload.manufacturer = manufacturer.trim();
          editPayload.prescriptionRequired = prescriptionRequired;
        }

        if (onSaveEdit) {
          await onSaveEdit(initialItem.stockId, editPayload);
        } else if (onSave) {
          await onSave({
            medicineId,
            medicineName: medicineName.trim(),
            genericName: genericName.trim(),
            strength: strength.trim(),
            form: form.trim(),
            manufacturer: manufacturer.trim() || undefined,
            prescriptionRequired,
            status,
            quantity: qtyValidation.value,
            price: parsedPrice,
            notes: notes.trim() || undefined,
          });
        }
      } else {
        const addPayload: AddInventoryMedicinePayload = {
          medicineId,
          medicineName: medicineName.trim(),
          genericName: genericName.trim(),
          strength: strength.trim(),
          form: form.trim(),
          manufacturer: manufacturer.trim() || undefined,
          prescriptionRequired,
          status,
          quantity: qtyValidation.value,
          price: parsedPrice,
          notes: notes.trim() || undefined,
        };

        if (onSaveAdd) {
          await onSaveAdd(addPayload);
        } else if (onSave) {
          await onSave(addPayload);
        }
      }

      onClose();
    } catch (err: unknown) {
      const serverFields =
        err && typeof err === 'object' && 'fields' in err
          ? (err as { fields?: Record<string, string> }).fields
          : undefined;
      if (serverFields) {
        setFieldErrors(serverFields);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save medicine information.');
    } finally {
      setIsSaving(false);
    }
  };

  const showDetailsForm =
    isEdit || Boolean(selectedCatalogueMed) || (mockMode && useManualMockEntry);
  const lockMedicineFields =
    isCatalogueLinkedEdit || (mode === 'add' && Boolean(selectedCatalogueMed));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-medicine-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(23, 43, 58, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 260,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'var(--color-surface-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill size={20} color="var(--color-action-primary)" aria-hidden="true" />
            <h2
              id="inventory-medicine-modal-title"
              style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}
            >
              {mode === 'add' ? 'Add Medicine from Catalogue' : 'Update Inventory Item'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close modal"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {/* Step 1: Curated Catalogue Lookup (Always visible in Add mode) */}
        {mode === 'add' && (
          <section
            aria-label="Curated medicine catalogue lookup"
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <label
                htmlFor="catalogue-picker-search"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                1. Select Active Medicine from Catalogue
              </label>

              {selectedCatalogueMed && (
                <button
                  type="button"
                  onClick={handleClearCatalogueSelection}
                  disabled={isSaving}
                  className="btn-secondary"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-surface-panel)',
                    color: 'var(--color-action-primary)',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Change Selection
                </button>
              )}
            </div>

            {selectedCatalogueMed ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-action-subtle)',
                  border: '1px solid rgba(23, 107, 135, 0.35)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <CheckCircle2 size={15} color="var(--color-action-primary)" aria-hidden="true" />
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      {selectedCatalogueMed.name}
                    </strong>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '1px 7px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-surface-panel)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {selectedCatalogueMed.strength} • {selectedCatalogueMed.form}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Generic: {selectedCatalogueMed.genericName}
                    {selectedCatalogueMed.manufacturer
                      ? ` • ${selectedCatalogueMed.manufacturer}`
                      : ''}
                    {selectedCatalogueMed.prescriptionRequired ? ' • Rx Required' : ''}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-action-primary)',
                    backgroundColor: 'var(--color-surface-panel)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid rgba(23, 107, 135, 0.25)',
                  }}
                >
                  Catalogue Linked
                </span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={15}
                      color="var(--color-text-secondary)"
                      style={{ position: 'absolute', left: '10px', top: '13px', pointerEvents: 'none' }}
                      aria-hidden="true"
                    />
                    <input
                      ref={searchInputRef}
                      id="catalogue-picker-search"
                      type="search"
                      value={catalogueQuery}
                      onChange={(e) => setCatalogueQuery(e.target.value)}
                      placeholder="Name, generic, or strength..."
                      disabled={isSaving}
                      style={{
                        width: '100%',
                        padding: '9px 10px 9px 32px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-surface-panel)',
                        fontSize: '13px',
                        minHeight: '42px',
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="catalogue-form-filter" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                      Filter catalogue by dosage form
                    </label>
                    <select
                      id="catalogue-form-filter"
                      value={catalogueFormFilter}
                      onChange={(e) => setCatalogueFormFilter(e.target.value)}
                      disabled={isSaving}
                      aria-label="Filter catalogue by dosage form"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-surface-panel)',
                        fontSize: '13px',
                        minHeight: '42px',
                      }}
                    >
                      <option value="all">All dosage forms</option>
                      {DOSAGE_FORMS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isSearchingCatalogue ? (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span className="spinner-small" style={{ color: 'var(--color-action-primary)' }} aria-hidden="true" />
                    <span>Searching medicine catalogue...</span>
                  </div>
                ) : catalogueError ? (
                  <div
                    role="alert"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-status-problem-bg)',
                      border: '1px solid rgba(180, 35, 47, 0.25)',
                      color: 'var(--color-status-problem)',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{catalogueError}</span>
                    <button
                      type="button"
                      onClick={() => setCatalogueRefreshNonce((n) => n + 1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(180, 35, 47, 0.35)',
                        backgroundColor: 'var(--color-surface-panel)',
                        color: 'var(--color-status-problem)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={12} aria-hidden="true" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : catalogueMatches.length > 0 ? (
                  <div
                    role="listbox"
                    aria-label="Matching curated catalogue medicines"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '190px',
                      overflowY: 'auto',
                      paddingRight: '2px',
                    }}
                  >
                    {catalogueMatches.map((med) => {
                      const alreadyAdded = isDuplicateInventoryMedicine(existingInventory, med);
                      return (
                        <button
                          key={med.id}
                          type="button"
                          role="option"
                          aria-selected={medicineId === med.id}
                          disabled={alreadyAdded || isSaving}
                          onClick={() => handleSelectCatalogueMedicine(med)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border-default)',
                            backgroundColor: alreadyAdded
                              ? '#f1f5f9'
                              : 'var(--color-surface-panel)',
                            opacity: alreadyAdded ? 0.72 : 1,
                            cursor: alreadyAdded || isSaving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {med.name}{' '}
                              <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                ({med.strength} • {med.form})
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                              Generic: {med.genericName}
                              {med.manufacturer ? ` • ${med.manufacturer}` : ''}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 9px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: alreadyAdded
                                ? 'var(--color-status-neutral-bg)'
                                : 'var(--color-action-subtle)',
                              color: alreadyAdded
                                ? 'var(--color-status-neutral)'
                                : 'var(--color-action-primary)',
                            }}
                          >
                            {alreadyAdded ? 'Already in inventory' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-surface-panel)',
                      border: '1px dashed var(--color-border-default)',
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {catalogueQuery.trim() !== '' || catalogueFormFilter !== 'all' ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>No active catalogue medicines matched your filter.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogueQuery('');
                            setCatalogueFormFilter('all');
                          }}
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-action-primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 6px',
                          }}
                        >
                          Reset search
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span>
                          No active medicines are currently available in the catalogue.
                          {!mockMode &&
                            ' Catalogue entries must be published by an administrator before linking to inventory.'}
                        </span>
                        {mockMode && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '12px' }}>
                              Local mock mode: administrators can add entries in Medicine Catalogue, or you can use manual mock entry below.
                            </span>
                            <button
                              type="button"
                              onClick={() => setUseManualMockEntry((prev) => !prev)}
                              className="btn-secondary"
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border-default)',
                                backgroundColor: 'var(--color-surface-panel)',
                                color: 'var(--color-action-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {useManualMockEntry
                                ? 'Hide Manual Mock Form'
                                : 'Enter Manually (Mock Mode)'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
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
            <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {showDetailsForm && (
            <>
              {/* Medicine Identity Summary (for Catalogue-linked edit) */}
              {isCatalogueLinkedEdit && initialItem && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {initialItem.medicineName}{' '}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                      ({initialItem.strength} • {initialItem.form})
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                    Generic: {initialItem.genericName}
                    {initialItem.manufacturer ? ` • ${initialItem.manufacturer}` : ''}
                    {initialItem.prescriptionRequired ? ' • Rx Required' : ''}
                  </div>
                </div>
              )}

              {/* Editable Medicine Identity Fields only when unlinked/manual mock entry */}
              {!isCatalogueLinkedEdit && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="med-name"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                    >
                      Medicine / Brand Name *
                    </label>
                    <input
                      id="med-name"
                      type="text"
                      value={medicineName}
                      onChange={(e) => setMedicineName(e.target.value)}
                      placeholder="Enter medicine name"
                      disabled={isSaving || lockMedicineFields}
                      readOnly={lockMedicineFields}
                      aria-invalid={Boolean(fieldErrors.medicineName)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: fieldErrors.medicineName
                          ? '1px solid var(--color-status-problem)'
                          : '1px solid var(--color-border-default)',
                        backgroundColor: lockMedicineFields ? '#f8fafc' : 'var(--color-surface-panel)',
                        fontSize: '14px',
                        minHeight: '42px',
                      }}
                    />
                    {fieldErrors.medicineName && (
                      <div style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.medicineName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="med-generic"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                    >
                      Generic Name *
                    </label>
                    <input
                      id="med-generic"
                      type="text"
                      value={genericName}
                      onChange={(e) => setGenericName(e.target.value)}
                      placeholder="Enter generic compound"
                      disabled={isSaving || lockMedicineFields}
                      readOnly={lockMedicineFields}
                      aria-invalid={Boolean(fieldErrors.genericName)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: fieldErrors.genericName
                          ? '1px solid var(--color-status-problem)'
                          : '1px solid var(--color-border-default)',
                        backgroundColor: lockMedicineFields ? '#f8fafc' : 'var(--color-surface-panel)',
                        fontSize: '14px',
                        minHeight: '42px',
                      }}
                    />
                    {fieldErrors.genericName && (
                      <div style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.genericName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="med-strength"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                    >
                      Strength *
                    </label>
                    <input
                      id="med-strength"
                      type="text"
                      value={strength}
                      onChange={(e) => setStrength(e.target.value)}
                      placeholder="e.g. 500 mg"
                      disabled={isSaving || lockMedicineFields}
                      readOnly={lockMedicineFields}
                      aria-invalid={Boolean(fieldErrors.strength)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: fieldErrors.strength
                          ? '1px solid var(--color-status-problem)'
                          : '1px solid var(--color-border-default)',
                        backgroundColor: lockMedicineFields ? '#f8fafc' : 'var(--color-surface-panel)',
                        fontSize: '14px',
                        minHeight: '42px',
                      }}
                    />
                    {fieldErrors.strength && (
                      <div style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}>
                        {fieldErrors.strength}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="med-form"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                    >
                      Dosage Form *
                    </label>
                    <select
                      id="med-form"
                      value={form}
                      onChange={(e) => setForm(e.target.value)}
                      disabled={isSaving || lockMedicineFields}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: lockMedicineFields ? '#f8fafc' : 'var(--color-surface-panel)',
                        fontSize: '14px',
                        minHeight: '42px',
                      }}
                    >
                      {DOSAGE_FORMS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="med-manufacturer"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                    >
                      Manufacturer (Optional)
                    </label>
                    <input
                      id="med-manufacturer"
                      type="text"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="Enter manufacturer"
                      disabled={isSaving || lockMedicineFields}
                      readOnly={lockMedicineFields}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: lockMedicineFields ? '#f8fafc' : 'var(--color-surface-panel)',
                        fontSize: '14px',
                        minHeight: '42px',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Stock Status Segmented Selector */}
              <div style={{ marginBottom: '16px' }}>
                <span
                  id="modal-status-group-label"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}
                >
                  Reported Availability Status *
                </span>
                <div
                  role="group"
                  aria-labelledby="modal-status-group-label"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                >
                  {WRITABLE_STATUSES.map((opt, idx) => {
                    const Icon = opt.icon;
                    const selected = status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        ref={idx === 0 ? firstStatusBtnRef : undefined}
                        type="button"
                        disabled={isSaving}
                        onClick={() => setStatus(opt.value)}
                        aria-pressed={selected}
                        className="inventory-status-btn"
                        style={{
                          border: selected
                            ? `2px solid ${opt.color}`
                            : '1px solid var(--color-border-default)',
                          backgroundColor: selected ? opt.bg : 'var(--color-surface-panel)',
                          color: selected ? opt.color : 'var(--color-text-secondary)',
                          minHeight: '42px',
                          padding: '8px 16px',
                          fontSize: '13px',
                        }}
                      >
                        <Icon size={15} aria-hidden={true} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Quantity & Price */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '14px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    htmlFor="med-quantity"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                  >
                    Stock Quantity (Optional)
                  </label>
                  <input
                    id="med-quantity"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={quantityText}
                    onChange={(e) => setQuantityText(e.target.value)}
                    placeholder="Whole number (e.g. 25)"
                    disabled={isSaving}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                    aria-describedby={fieldErrors.quantity ? 'med-quantity-error' : undefined}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: fieldErrors.quantity
                        ? '1px solid var(--color-status-problem)'
                        : '1px solid var(--color-border-default)',
                      fontSize: '14px',
                      minHeight: '42px',
                    }}
                  />
                  {fieldErrors.quantity && (
                    <div
                      id="med-quantity-error"
                      style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}
                    >
                      {fieldErrors.quantity}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="med-price"
                    style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                  >
                    Unit Price (Optional)
                  </label>
                  <input
                    id="med-price"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    placeholder="e.g. 12.50"
                    disabled={isSaving}
                    aria-invalid={Boolean(fieldErrors.price)}
                    aria-describedby={fieldErrors.price ? 'med-price-error' : undefined}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: fieldErrors.price
                        ? '1px solid var(--color-status-problem)'
                        : '1px solid var(--color-border-default)',
                      fontSize: '14px',
                      minHeight: '42px',
                    }}
                  />
                  {fieldErrors.price && (
                    <div
                      id="med-price-error"
                      style={{ fontSize: '12px', color: 'var(--color-status-problem)', marginTop: '4px' }}
                    >
                      {fieldErrors.price}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="med-notes"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}
                >
                  Dispensing / Packaging Notes (Optional)
                </label>
                <input
                  id="med-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Strip of 10 tablets, shelf B2"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-default)',
                    fontSize: '14px',
                    minHeight: '42px',
                  }}
                />
              </div>

              {!isCatalogueLinkedEdit && (
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      cursor: lockMedicineFields ? 'default' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={prescriptionRequired}
                      onChange={(e) => setPrescriptionRequired(e.target.checked)}
                      disabled={isSaving || lockMedicineFields}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-action-primary)' }}
                    />
                    <span>Prescription required at dispensing</span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="btn-secondary"
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                minHeight: '42px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (mode === 'add' && !showDetailsForm)}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                cursor: isSaving || (mode === 'add' && !showDetailsForm) ? 'not-allowed' : 'pointer',
                opacity: isSaving || (mode === 'add' && !showDetailsForm) ? 0.65 : 1,
                minHeight: '42px',
              }}
            >
              <Check size={15} aria-hidden="true" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : mode === 'add'
                  ? 'Add to Inventory'
                  : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
