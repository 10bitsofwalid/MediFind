// src/components/AvailabilityStatus.tsx
import React from 'react';
import type { StockStatus } from '../types/pharmacy';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface AvailabilityStatusProps {
  status: StockStatus;
  quantity?: number;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  StockStatus,
  { label: string; bg: string; color: string; border: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }
> = {
  available: {
    label: 'Available',
    bg: 'var(--color-status-available-bg)',
    color: 'var(--color-status-available)',
    border: 'rgba(24, 115, 75, 0.3)',
    icon: CheckCircle2,
  },
  low: {
    label: 'Low Stock',
    bg: 'var(--color-status-caution-bg)',
    color: 'var(--color-status-caution)',
    border: 'rgba(152, 88, 0, 0.3)',
    icon: AlertTriangle,
  },
  out: {
    label: 'Out of Stock',
    bg: 'var(--color-status-problem-bg)',
    color: 'var(--color-status-problem)',
    border: 'rgba(180, 35, 47, 0.3)',
    icon: XCircle,
  },
  unverified: {
    label: 'Unverified Report',
    bg: 'var(--color-status-neutral-bg)',
    color: 'var(--color-status-neutral)',
    border: 'var(--color-border-default)',
    icon: HelpCircle,
  },
};

export const AvailabilityStatus: React.FC<AvailabilityStatusProps> = ({
  status,
  quantity,
  showIcon = true,
  size = 'md',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unverified;
  const IconComponent = config.icon;
  const isSmall = size === 'sm';

  return (
    <span
      role="status"
      aria-label={`Medicine reported availability: ${config.label}${
        typeof quantity === 'number' ? ` (${quantity} units remaining)` : ''
      }`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        fontSize: isSmall ? '12px' : '13px',
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
    >
      {showIcon && <IconComponent size={isSmall ? 13 : 15} aria-hidden={true} />}
      <span>{config.label}</span>
      {typeof quantity === 'number' && quantity > 0 && (
        <span
          style={{
            opacity: 0.85,
            fontSize: isSmall ? '11px' : '12px',
            fontWeight: 500,
            borderLeft: `1px solid ${config.border}`,
            paddingLeft: isSmall ? '4px' : '6px',
            marginLeft: '2px',
          }}
        >
          {quantity} in stock
        </span>
      )}
    </span>
  );
};

