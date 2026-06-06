'use client';

interface CircularGaugeProps {
  value: number | null;
  max?: number;
  label: string;
  unit?: string;
  warn?: number;
  crit?: number;
  size?: number;
}

export function CircularGauge({
  value,
  max = 100,
  label,
  unit = '',
  warn,
  crit,
  size = 90,
}: CircularGaugeProps) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const trackLen = circ * 0.75;
  const gapLen = circ - trackLen;

  const pct = value !== null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillLen = trackLen * (pct / 100);

  const color =
    value === null
      ? 'var(--gauge-null)'
      : crit !== undefined && value >= crit
      ? 'var(--gauge-crit)'
      : warn !== undefined && value >= warn
      ? 'var(--gauge-warn)'
      : 'var(--gauge-nominal)';

  const displayVal = value !== null ? String(Math.round(value)) : '—';

  return (
    <div className='flex flex-col items-center gap-1'>
      <svg
        width={size}
        height={size}
        viewBox='0 0 100 100'
        aria-label={label + ': ' + displayVal + unit}
      >
        <circle
          r={r}
          cx={50}
          cy={50}
          fill='none'
          stroke='var(--gauge-track)'
          strokeWidth={6}
          strokeDasharray={trackLen + ' ' + gapLen}
          transform='rotate(135 50 50)'
          strokeLinecap='round'
        />
        {value !== null && fillLen > 0 && (
          <circle
            r={r}
            cx={50}
            cy={50}
            fill='none'
            stroke={color}
            strokeWidth={6}
            strokeDasharray={fillLen + ' ' + circ}
            transform='rotate(135 50 50)'
            strokeLinecap='round'
            style={{ transition: 'stroke-dasharray var(--dur-slow) var(--ease-std), stroke var(--dur-base) var(--ease-std)' }}
          />
        )}
        <text
          x={50}
          y={44}
          textAnchor='middle'
          dominantBaseline='middle'
          fill='var(--text-primary)'
          fontSize={value !== null && Math.round(value) >= 1000 ? 13 : 17}
          fontWeight={600}
          fontFamily='var(--font-sans)'
        >
          {displayVal}
        </text>
        {unit && (
          <text
            x={50}
            y={60}
            textAnchor='middle'
            dominantBaseline='middle'
            fill='var(--text-muted)'
            fontSize={9}
            fontFamily='var(--font-sans)'
          >
            {unit}
          </text>
        )}
      </svg>
      <span className='text-[10px] text-zinc-400 text-center leading-tight'>
        {label}
      </span>
    </div>
  );
}
