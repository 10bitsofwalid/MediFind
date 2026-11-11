// src/components/PharmacyStockReminderManager.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import { getPharmacyApplication, getPharmacyProfile } from '../services/pharmacyService';
import {
  checkAndTriggerDueReminders,
  formatTimeDisplay,
  getCurrentTimeHHMM,
  PHARMACY_STATUS_UPDATED_EVENT,
  REMINDER_PREFS_UPDATED_EVENT,
  TEST_REMINDER_EVENT,
  type StockReminderNotification,
} from '../services/stockReminderService';
import { BellRing, Clock, X, ArrowRight, Settings2 } from 'lucide-react';

const ActiveStockReminderManager: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<StockReminderNotification[]>([]);

  const evaluateReminders = useCallback(async () => {
    try {
      const [app, profile] = await Promise.all([
        getPharmacyApplication().catch(() => null),
        getPharmacyProfile().catch(() => null),
      ]);
      const isVerified = app?.status === 'verified' || profile?.status === 'verified';
      if (!isVerified) return;

      const due = checkAndTriggerDueReminders(userId, true);
      if (due.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const uniqueNew = due.filter((n) => !existingIds.has(n.id));
          return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
        });
      }
    } catch {
      // ignore background reminder check errors
    }
  }, [userId]);

  useEffect(() => {
    // Defer initial check asynchronously so setState is never called synchronously in effect body
    const initialTimer = window.setTimeout(() => {
      void evaluateReminders();
    }, 150);

    const intervalId = window.setInterval(() => {
      void evaluateReminders();
    }, 10000);

    const handlePrefsOrStatusUpdate = () => {
      void evaluateReminders();
    };

    const handleTestReminder = () => {
      const nowTime = getCurrentTimeHHMM();
      setNotifications((prev) => [
        ...prev.filter((n) => !n.id.startsWith('preview_')),
        {
          id: `preview_${Date.now()}`,
          kind: 'custom_schedule',
          scheduledTime: nowTime,
          title: `Stock Reminder Preview (${formatTimeDisplay(nowTime)})`,
          message:
            'This is how your scheduled pop-up notification will remind you to update medicine stock at your preferred times.',
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    window.addEventListener(REMINDER_PREFS_UPDATED_EVENT, handlePrefsOrStatusUpdate);
    window.addEventListener(PHARMACY_STATUS_UPDATED_EVENT, handlePrefsOrStatusUpdate);
    window.addEventListener(TEST_REMINDER_EVENT, handleTestReminder);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
      window.removeEventListener(REMINDER_PREFS_UPDATED_EVENT, handlePrefsOrStatusUpdate);
      window.removeEventListener(PHARMACY_STATUS_UPDATED_EVENT, handlePrefsOrStatusUpdate);
      window.removeEventListener(TEST_REMINDER_EVENT, handleTestReminder);
    };
  }, [evaluateReminders]);

  if (notifications.length === 0) {
    return null;
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGoToInventory = (id: string) => {
    dismissNotification(id);
    navigate('/pharmacy/dashboard');
    window.setTimeout(() => {
      const el = document.getElementById('inventory-section-heading');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleGoToReminderSettings = (id: string) => {
    dismissNotification(id);
    navigate('/pharmacy/dashboard');
    window.setTimeout(() => {
      const el = document.getElementById('stock-reminders');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  return (
    <div
      aria-live="polite"
      aria-label="Stock update reminder notifications"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: 'min(400px, calc(100vw - 32px))',
      }}
    >
      {notifications.map((item) => {
        const isDaily = item.kind === 'daily_login';
        return (
          <div
            key={item.id}
            role="dialog"
            aria-label={item.title}
            className="card"
            style={{
              backgroundColor: 'var(--color-surface-panel)',
              border: '1px solid var(--color-action-primary)',
              borderLeft: '5px solid var(--color-action-primary)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-action-subtle)',
                    color: 'var(--color-action-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  {isDaily ? <BellRing size={18} /> : <Clock size={18} />}
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-action-primary)',
                      marginBottom: '2px',
                    }}
                  >
                    {isDaily ? 'Daily Login Reminder' : 'Custom Scheduled Reminder'}
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    {item.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissNotification(item.id)}
                aria-label={`Dismiss ${item.title}`}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>
              {item.message}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleGoToInventory(item.id)}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <span>Update Stock Now</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleGoToReminderSettings(item.id)}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface-canvas)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Settings2 size={13} aria-hidden="true" />
                <span>Customize Times</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const PharmacyStockReminderManager: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user || user.role !== 'PHARMACY') {
    return null;
  }
  return <ActiveStockReminderManager key={user.id} userId={user.id} />;
};

