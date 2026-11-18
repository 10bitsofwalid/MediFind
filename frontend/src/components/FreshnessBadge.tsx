// src/components/FreshnessBadge.tsx
import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface FreshnessBadgeProps {
  updatedAt?: string;
  isStale?: boolean;
  staleThresholdHours?: number; // default: 24 hours
}

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return 'Update time unavailable';
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return 'Update time unavailable';

    const diffMs = Date.now() - updated.getTime();
    if (diffMs < 0) return 'Just now';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Update time unavailable';
  }
}

function isReportStale(isoString?: string, thresholdHours = 24): boolean {
  if (!isoString) return true;
  try {
    const updated = new Date(isoString);
    if (isNaN(updated.getTime())) return true;
    const diffHours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
    return diffHours >= thresholdHours;
  } catch {
    return true;
  }
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  updatedAt,
  isStale,
  staleThresholdHours = 24,
}) => {
  const stale = isStale !== undefined ? isStale : isReportStale(updatedAt, staleThresholdHours);
  const timeAgoString = formatTimeAgo(updatedAt);

  return (
    <span
      role="status"
      aria-label={`Report freshness: ${timeAgoString}${stale ? ' (Stale report, may be inaccurate)' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        fontWeight: 500,
        color: stale ? 'var(--color-status-caution)' : 'var(--color-text-secondary)',
        backgroundColor: stale ? 'var(--color-status-caution-bg)' : 'transparent',
        padding: stale ? '2px 8px' : '0',
        borderRadius: stale ? 'var(--radius-full)' : '0',
        border: stale ? '1px solid rgba(152, 88, 0, 0.25)' : 'none',
      }}
    >
      {stale ? (
        <>
          <AlertTriangle size={13} aria-hidden={true} />
          <span>Stale: Reported {timeAgoString}</span>
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
