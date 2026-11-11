// src/features/pharmacy/StockReminderSettings.tsx
import React, { useState } from 'react';
import { useAuth } from '../../app/useAuth';
import {
  formatTimeDisplay,
  getReminderPreferences,
  isValidReminderTime,
  saveReminderPreferences,
  TEST_REMINDER_EVENT,
  type StockReminderPreferences,
} from '../../services/stockReminderService';
import { Bell, Clock, Plus, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export const StockReminderSettings: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [prefs, setPrefs] = useState<StockReminderPreferences>(() =>
    userId
      ? getReminderPreferences(userId)
      : { dailyLoginEnabled: true, customScheduleEnabled: true, times: [] }
  );
  const [newTime, setNewTime] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  if (!userId) return null;

  const persistPrefs = (next: StockReminderPreferences, message: string) => {
    const saved = saveReminderPreferences(userId, next);
    setPrefs(saved);
    setErrorMsg(null);
    setSavedMsg(message);
  };

  const handleToggleDaily = (enabled: boolean) => {
    persistPrefs(
      { ...prefs, dailyLoginEnabled: enabled },
      enabled
        ? 'Daily first-login reminder enabled.'
        : 'Daily first-login reminder paused.'
    );
  };

  const handleToggleCustomSchedule = (enabled: boolean) => {
    persistPrefs(
      { ...prefs, customScheduleEnabled: enabled },
      enabled
        ? 'Custom scheduled reminders enabled.'
        : 'Custom scheduled reminders paused.'
    );
  };

  const handleAddTime = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedMsg(null);

    if (!newTime || !isValidReminderTime(newTime)) {
      setErrorMsg('Please select a valid notification time.');
      return;
    }

    if (prefs.times.includes(newTime)) {
      setErrorMsg(`${formatTimeDisplay(newTime)} is already in your reminder schedule.`);
      return;
    }

    const updatedTimes = [...prefs.times, newTime];
    persistPrefs(
      { ...prefs, customScheduleEnabled: true, times: updatedTimes },
      `Added reminder at ${formatTimeDisplay(newTime)}.`
    );
    setNewTime('');
  };

  const handleRemoveTime = (timeToRemove: string) => {
    const updatedTimes = prefs.times.filter((t) => t !== timeToRemove);
    persistPrefs(
      { ...prefs, times: updatedTimes },
      `Removed reminder for ${formatTimeDisplay(timeToRemove)}.`
    );
  };

  const handlePreviewPopup = () => {
    window.dispatchEvent(new CustomEvent(TEST_REMINDER_EVENT));
  };

  return (
    <section
      id="stock-reminders"
      className="card"
      aria-labelledby="stock-reminders-heading"
      style={{
        backgroundColor: 'var(--color-surface-panel)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <Bell size={20} color="var(--color-action-primary)" style={{ marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
          <div>
            <h2
              id="stock-reminders-heading"
              style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}
            >
              Stock Update Reminder Notifications
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Configure pop-up reminders when you first sign in each day and at your own preferred times.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePreviewPopup}
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-surface-canvas)',
            color: 'var(--color-action-primary)',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={13} aria-hidden="true" />
          <span>Preview Pop-up</span>
        </button>
      </div>

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
            marginBottom: '14px',
          }}
        >
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {savedMsg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-status-available-bg)',
            border: '1px solid rgba(24, 115, 75, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-available)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px',
          }}
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Daily First-Login Toggle */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface-canvas)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prefs.dailyLoginEnabled}
              onChange={(e) => handleToggleDaily(e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--color-action-primary)' }}
            />
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
                Daily First-Login Stock Reminder
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Show a pop-up reminder the first time you open or sign in to MediFind each day.
              </span>
            </div>
          </label>
        </div>

        {/* Custom Scheduled Reminder Times */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface-canvas)',
            border: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prefs.customScheduleEnabled}
              onChange={(e) => handleToggleCustomSchedule(e.target.checked)}
              style={{ width: '17px', height: '17px', marginTop: '2px', accentColor: 'var(--color-action-primary)' }}
            />
            <div>
              <strong style={{ fontSize: '14px', color: 'var(--color-text-primary)', display: 'block' }}>
                Custom Scheduled Reminder Times
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Receive a pop-up reminder at your preferred times of day while signed in.
              </span>
            </div>
          </label>

          <form
            onSubmit={handleAddTime}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <label htmlFor="custom-reminder-time" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Add Preferred Time:
            </label>
            <input
              id="custom-reminder-time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-panel)',
                color: 'var(--color-text-primary)',
                fontSize: '14px',
                minHeight: '40px',
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                cursor: 'pointer',
                minHeight: '40px',
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>Add Time</span>
            </button>
          </form>

          {prefs.times.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              No preferred reminder times added yet. Choose a time above to set your custom schedule.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} aria-label="Configured reminder times">
              {prefs.times.map((timeStr) => (
                <span
                  key={timeStr}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-surface-panel)',
                    border: '1px solid var(--color-border-default)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Clock size={13} color="var(--color-action-primary)" aria-hidden="true" />
                  <span>{formatTimeDisplay(timeStr)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(timeStr)}
                    aria-label={`Remove ${formatTimeDisplay(timeStr)} reminder`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'var(--color-surface-canvas)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

