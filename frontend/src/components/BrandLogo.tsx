// src/components/BrandLogo.tsx
import React from 'react';

interface BrandLogoProps {
  size?: number;
  style?: React.CSSProperties;
}

/**
 * BrandLogoIcon renders the unified MediFind emblem:
 * 1. Location — Precision Map Pin marker
 * 2. Medicine — Clinical cross with soft rounded pill geometry
 * 3. Pharmacy — Official regulatory dispensary symbol
 */
const BrandLogoIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#ffffff',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ display: 'block', flexShrink: 0 }}
  >
    {/* Map Pin silhouette representing Geospatial Location & Discovery */}
    <path
      d="M12 2C7.58 2 4 5.58 4 10C4 15.6 11.25 21.65 11.45 21.85C11.75 22.05 12.25 22.05 12.55 21.85C12.75 21.65 20 15.6 20 10C20 5.58 16.42 2 12 2Z"
      fill={color}
    />
    {/* Medical / Pharmacy Cross with rounded pill arms representing Medicine & Pharmacy */}
    <path
      d="M12 6.2V13.8M8.2 10H15.8"
      stroke="var(--color-action-primary, #176B87)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * BrandLogo renders the branded squircle container holding the emblem
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 36,
  style,
}) => {
  const iconSize = Math.round(size * 0.6);
  const borderRadius = Math.round(size * 0.28);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
        backgroundColor: 'var(--color-action-primary)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <BrandLogoIcon size={iconSize} />
    </div>
  );
};

