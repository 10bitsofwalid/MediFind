// src/components/OpeningHoursBuilder.tsx
import React from 'react';
import type { WeeklyHours, DayOfWeek, DaySchedule } from '../types/pharmacy';
import { formatWeeklyHours } from '../services/pharmacyService';
import { Clock, Copy, Sparkles, Check, AlertCircle } from 'lucide-react';

interface OpeningHoursBuilderProps {
  hours: WeeklyHours;
  onChange: (updatedHours: WeeklyHours) => void;
  disabled?: boolean;
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

export const OpeningHoursBuilder: React.FC<OpeningHoursBuilderProps> = ({
  hours,
  onChange,
  disabled = false,
}) => {
  const handleDayChange = (day: DayOfWeek, patch: Partial<DaySchedule>) => {
    const current = hours[day] || {
      isOpen: true,
      openTime: '08:30',
      closeTime: '22:30',
      is24Hours: false,
    };
    onChange({
      ...hours,
      [day]: { ...current, ...patch },
    });
  };

  const handleApplyMondayToWeekdays = () => {
    const mon = hours.monday;
    if (!mon) return;

    const updated: WeeklyHours = { ...hours };
    const weekdays: DayOfWeek[] = ['tuesday', 'wednesday', 'thursday', 'saturday', 'sunday'];
    weekdays.forEach((day) => {
      updated[day] = { ...mon };
    });
    onChange(updated);
  };

  const handleSetAll24_7 = () => {
    const updated: WeeklyHours = {} as WeeklyHours;
    DAYS.forEach(({ key }) => {
      updated[key] = {
        isOpen: true,
        openTime: '00:00',
        closeTime: '23:59',
        is24Hours: true,
      };
    });
    onChange(updated);
  };

  const handleResetStandard = () => {
    const updated: WeeklyHours = {} as WeeklyHours;
    DAYS.forEach(({ key }) => {
      if (key === 'friday') {
        updated[key] = {
          isOpen: true,
          openTime: '14:00',
          closeTime: '22:00',
          is24Hours: false,
        };
      } else {
        updated[key] = {
          isOpen: true,
          openTime: '08:30',
          closeTime: '22:30',
          is24Hours: false,
        };
      }
    });
    onChange(updated);
  };

  const formattedSummary = formatWeeklyHours(hours);

  return (
    <div className="opening-hours-builder" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Quick Action Presets */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Schedule Presets:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={handleApplyMondayToWeekdays}
            disabled={disabled}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-action-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              minHeight: '36px',
            }}
          >
            <Copy size={13} aria-hidden="true" />
            <span>Copy Mon to All</span>
          </button>

          <button
            type="button"
            onClick={handleSetAll24_7}
            disabled={disabled}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-action-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              minHeight: '36px',
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>Open 24/7</span>
          </button>

          <button
            type="button"
            onClick={handleResetStandard}
            disabled={disabled}
            className="btn-secondary"
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface-panel)',
              color: 'var(--color-text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              minHeight: '36px',
            }}
          >
            Standard Hours
          </button>
        </div>
      </div>

      {/* Daily Schedule Rows */}
      <div
        style={{
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-panel)',
        }}
      >
        {DAYS.map(({ key, label }, index) => {
          const schedule = hours[key] || {
            isOpen: true,
            openTime: '08:30',
            closeTime: '22:30',
            is24Hours: false,
          };
          const isInvalidTime =
            schedule.isOpen &&
            !schedule.is24Hours &&
            schedule.openTime &&
            schedule.closeTime &&
            schedule.openTime >= schedule.closeTime;

          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: index < DAYS.length - 1 ? '1px solid var(--color-border-default)' : 'none',
                alignItems: 'center',
                backgroundColor: schedule.isOpen ? 'transparent' : 'rgba(246, 248, 250, 0.7)',
              }}
              className="hours-day-row"
            >
              {/* Day Name and Open Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {label}
                </span>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: schedule.isOpen ? 'var(--color-status-available)' : 'var(--color-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={schedule.isOpen}
                    disabled={disabled}
                    onChange={(e) => handleDayChange(key, { isOpen: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-action-primary)' }}
                  />
                  <span>{schedule.isOpen ? 'Open' : 'Closed'}</span>
                </label>
              </div>

              {/* Time Pickers or Closed state */}
              {schedule.isOpen ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      marginRight: '8px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!schedule.is24Hours}
                      disabled={disabled}
                      onChange={(e) =>
                        handleDayChange(key, {
                          is24Hours: e.target.checked,
                          openTime: e.target.checked ? '00:00' : '08:30',
                          closeTime: e.target.checked ? '23:59' : '22:30',
                        })
                      }
                      style={{ width: '15px', height: '15px', accentColor: 'var(--color-action-primary)' }}
                    />
                    <span>24 Hours</span>
                  </label>

                  {!schedule.is24Hours ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>From:</span>
                        <input
                          type="time"
                          value={schedule.openTime}
                          disabled={disabled}
                          onChange={(e) => handleDayChange(key, { openTime: e.target.value })}
                          aria-label={`${label} opening time`}
                          style={{
                            padding: '6px 8px',
                            fontSize: '13px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-default)',
                            backgroundColor: 'var(--color-surface-panel)',
                            minHeight: '38px',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>To:</span>
                        <input
                          type="time"
                          value={schedule.closeTime}
                          disabled={disabled}
                          onChange={(e) => handleDayChange(key, { closeTime: e.target.value })}
                          aria-label={`${label} closing time`}
                          style={{
                            padding: '6px 8px',
                            fontSize: '13px',
                            borderRadius: 'var(--radius-sm)',
                            border: isInvalidTime
                              ? '1px solid var(--color-status-problem)'
                              : '1px solid var(--color-border-default)',
                            backgroundColor: 'var(--color-surface-panel)',
                            minHeight: '38px',
                          }}
                        />
                      </div>

                      {isInvalidTime && (
                        <div
                          role="alert"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: 'var(--color-status-problem)',
                          }}
                        >
                          <AlertCircle size={14} aria-hidden="true" />
                          <span>Close time must be after open time</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-status-available)',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={14} aria-hidden="true" /> Open all day (24 Hours)
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                  Pharmacy closed for customer visits and orders on this day.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Formatted Schedule Summary Box */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface-canvas)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}
      >
        <Clock size={16} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block' }}>
            Formatted Schedule Preview (saved to listing):
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {formattedSummary || 'No operating hours defined'}
          </span>
        </div>
      </div>
    </div>
  );
};

