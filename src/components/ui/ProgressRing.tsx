import React from 'react';

interface ProgressRingProps {
  progressPct: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  gradientId?: string;
  fromColor?: string;
  toColor?: string;
  trackColor?: string;
  className?: string;
  children?: React.ReactNode;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progressPct,
  size = 120,
  strokeWidth = 10,
  gradientId = 'frostRingGrad',
  fromColor = '#7CC8FF',
  toColor = '#3B82F6',
  trackColor = 'rgba(255, 255, 255, 0.08)',
  className = '',
  children,
  label = 'Completion',
}) => {
  const safePct = Math.min(100, Math.max(0, isNaN(progressPct) ? 0 : progressPct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePct / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={safePct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={fromColor} />
            <stop offset="100%" stopColor={toColor} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {children}
      </div>
    </div>
  );
};
