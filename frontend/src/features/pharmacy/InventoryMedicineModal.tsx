// src/features/pharmacy/InventoryMedicineModal.tsx
import React, { useState, useEffect } from 'react';
import type { StockStatus } from '../../types/pharmacy';
import type {
  Medicine,
  StockInventoryRecord,
  AddInventoryMedicinePayload,
} from '../../types/medicine';
import { stockService } from '../../services/stockService';
import { X, AlertCircle, Pill, Search, Check } from 'lucide-react';

interface InventoryMedicineModalProps {
  mode: 'add' | 'edit';
  initialItem?: StockInventoryRecord | null;
  onClose: () => void;
  onSave: (payload: AddInventoryMedicinePayload) => Promise<void>;
}

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'Drops', 'Ointment', 'Cream'];

export const InventoryMedicineModal: React.FC<InventoryMedicineModalProps> = ({
  mode,
  initialItem,
  onClose,
  onSave,
}) => {
  const isEdit = mode === 'edit' && Boolean(initialItem);

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
  const [status, setStatus] = useState<StockStatus>(() =>
    isEdit && initialItem ? initialItem.status : 'available'
  );
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
  const [catalogueMatches, setCatalogueMatches] = useState<Medicine[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'add') return;
    let isMounted = true;
    stockService
      .searchCatalogue(catalogueQuery)
      .then((list) => {
        if (isMounted) setCatalogueMatches(list);
      })
      .catch(() => {
        if (isMounted) setCatalogueMatches([]);
      });
    return () => {
      isMounted = false;
    };
  }, [mode, catalogueQuery]);

  const handleSelectCatalogueMedicine = (med: Medicine) => {
    setMedicineId(med.id);
    setMedicineName(med.name);
    setGenericName(med.genericName);
    setStrength(med.strength);
    setForm(med.form || 'Tablet');
    setManufacturer(med.manufacturer || '');
    setPrescriptionRequired(Boolean(med.prescriptionRequired));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!medicineName.trim() || !genericName.trim() || !strength.trim() || !form.trim()) {
      setErrorMsg('Medicine name, generic name, strength, and dosage form are required.');
      return;
    }

    const parsedQuantity =
      quantityText.trim() === '' ? undefined : Number(quantityText.trim());
    if (parsedQuantity !== undefined && (Number.isNaN(parsedQuantity) || parsedQuantity < 0)) {
      setErrorMsg('Quantity must be a non-negative number.');
      return;
    }

    const parsedPrice = priceText.trim() === '' ? undefined : Number(priceText.trim());
    if (parsedPrice !== undefined && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      setErrorMsg('Unit price must be a non-negative number.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        medicineId,
        medicineName: medicineName.trim(),
        genericName: genericName.trim(),
        strength: strength.trim(),
        form: form.trim(),
        manufacturer: manufacturer.trim() || undefined,
        prescriptionRequired,
        status,
        quantity: parsedQuantity,
        price: parsedPrice,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save medicine information.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-medicine-modal-title"
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
          maxWidth: '640px',
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
              {mode === 'add' ? 'Add Medicine to Inventory' : 'Update Medicine Information'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close modal"
            style={{
              width: '34px',
              height: '34px',
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
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Optional Curated Catalogue Picker when adding */}
        {mode === 'add' && (catalogueMatches.length > 0 || catalogueQuery.trim() !== '') && (
          <div
            style={{
              marginBottom: '18px',
              padding: '12px 14px',
              backgroundColor: 'var(--color-surface-canvas)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <label
              htmlFor="catalogue-picker-search"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}
            >
              Quick Fill from Platform Catalogue (Optional)
            </label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search
                size={14}
                color="var(--color-text-secondary)"
                style={{ position: 'absolute', left: '10px', top: '11px', pointerEvents: 'none' }}
                aria-hidden="true"
              />
              <input
                id="catalogue-picker-search"
                type="search"
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
                placeholder="Search curated medicines..."
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  fontSize: '13px',
                }}
              />
            </div>

            {catalogueMatches.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                {catalogueMatches.map((med) => (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => handleSelectCatalogueMedicine(med)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      border:
                        medicineId === med.id
                          ? '1px solid var(--color-action-primary)'
                          : '1px solid var(--color-border-default)',
                      backgroundColor:
                        medicineId === med.id ? 'var(--color-action-subtle)' : 'var(--color-surface-panel)',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {med.name} ({med.strength})
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                No curated matches found; enter medicine details directly below.
              </div>
            )}
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label htmlFor="med-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Medicine / Brand Name *
              </label>
              <input
                id="med-name"
                type="text"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="Enter medicine name"
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

            <div>
              <label htmlFor="med-generic" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Generic Name *
              </label>
              <input
                id="med-generic"
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
                  minHeight: '42px',
                }}
              />
            </div>

            <div>
              <label htmlFor="med-strength" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Strength *
              </label>
              <input
                id="med-strength"
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
                  minHeight: '42px',
                }}
              />
            </div>

            <div>
              <label htmlFor="med-form" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Dosage Form *
              </label>
              <select
                id="med-form"
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
              <label htmlFor="med-manufacturer" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Manufacturer (Optional)
              </label>
              <input
                id="med-manufacturer"
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
                  minHeight: '42px',
                }}
              />
            </div>

            <div>
              <label htmlFor="med-status" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Availability Status *
              </label>
              <select
                id="med-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StockStatus)}
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-panel)',
                  fontSize: '14px',
                  minHeight: '42px',
                }}
              >
                <option value="available">Available</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>

            <div>
              <label htmlFor="med-quantity" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Stock Quantity (Optional)
              </label>
              <input
                id="med-quantity"
                type="number"
                min="0"
                step="1"
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                placeholder="Units in stock"
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

            <div>
              <label htmlFor="med-price" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
                Unit Price (Optional)
              </label>
              <input
                id="med-price"
                type="number"
                min="0"
                step="0.01"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="e.g. 12.50"
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
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="med-notes" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '5px' }}>
              Dispensing / Packaging Notes (Optional)
            </label>
            <input
              id="med-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Strip of 10 tablets, counter shelf B2"
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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={prescriptionRequired}
                onChange={(e) => setPrescriptionRequired(e.target.checked)}
                disabled={isSaving}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-action-primary)' }}
              />
              <span>Prescription required at dispensing</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
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
                gap: '6px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={15} aria-hidden="true" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : mode === 'add'
                  ? 'Add Medicine'
                  : 'Save Medicine Info'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
