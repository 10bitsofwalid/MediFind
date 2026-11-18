// src/components/FreshnessBadge.tsx
import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_STALE_THRESHOLD_HOURS,
  formatTimeAgo,
  isReportStale,
} from '../features/pharmacy/inventoryUtils';

interface FreshnessBadgeProps {
  updatedAt?: string;
  isStale?: boolean;
  staleThresholdHours?: number; // default: 24 hours
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  updatedAt,
  isStale,
  staleThresholdHours = DEFAULT_STALE_THRESHOLD_HOURS,
}) => {
  const stale = isStale !== undefined ? isStale : isReportStale(updatedAt, staleThresholdHours);
  const timeAgoString = formatTimeAgo(updatedAt);

  return (
    <span
      role="status"
      aria-label={`Report freshness: ${stale ? 'Stale, ' : ''}${timeAgoString}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '12px',
        fontWeight: stale ? 600 : 500,
        color: stale ? 'var(--color-status-caution)' : 'var(--color-text-secondary)',
        backgroundColor: stale ? 'var(--color-status-caution-bg)' : 'transparent',
        padding: stale ? '2px 8px' : '0',
        borderRadius: stale ? 'var(--radius-full)' : '0',
        border: stale ? '1px solid rgba(152, 88, 0, 0.3)' : 'none',
      }}
    >
      {stale ? (
        <>
          <AlertTriangle size={13} aria-hidden={true} />
          <span>Stale</span>
          <span aria-hidden="true" style={{ opacity: 0.55 }}>
            •
          </span>
          <span style={{ fontWeight: 500 }}>Reported {timeAgoString}</span>
        </>
      ) : (
        <>
          <Clock size={13} aria-hidden={true} />
          <span>Reported {timeAgoString}</span>
        </>
      )}
    </span>
  );
};
