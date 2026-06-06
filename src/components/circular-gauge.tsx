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
  const circ = 2 * Math.PI * r;   // 238.76
  const trackLen = circ * 0.75;   // 270° arc = 179.07
  const gapLen = circ - trackLen; // 59.69

  const pct = value !== null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillLen = trackLen * (pct / 100);

  const color =
    value === null
      ? '#3f3f46'
      : crit !== undefined && value >= crit
      ? '#ef4444'
      : warn !== undefined && value >= warn
      ? '#f59e0b'
      : '#22d3ee';

  const displayVal = value !== null ? String(Math.round(value)) : '—';

  return (
    <div className='flex flex-col items-center gap-1'>
      <svg
        width={size}
        height={size}
        viewBox='0 0 100 100'
        aria-label={label + ': ' + displayVal + unit}
      >
        {/* background track */}
        <circle
          r={r}
          cx={50}
          cy={50}
          fill='none'
          stroke='#27272a'
          strokeWidth={6}
          strokeDasharray={trackLen + ' ' + gapLen}
          transform='rotate(135 50 50)'
          strokeLinecap='round'
        />
        {/* value arc */}
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
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        )}
        {/* center value */}
        <text
          x={50}
          y={44}
          textAnchor='middle'
          dominantBaseline='middle'
          fill='#f4f4f5'
          fontSize={value !== null && Math.round(value) >= 1000 ? 13 : 17}
          fontWeight={600}
          fontFamily='system-ui, sans-serif'
        >
          {displayVal}
        </text>
        {/* center unit */}
        {unit && (
          <text
            x={50}
            y={60}
            textAnchor='middle'
            dominantBaseline='middle'
            fill='#71717a'
            fontSize={9}
            fontFamily='system-ui, sans-serif'
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
