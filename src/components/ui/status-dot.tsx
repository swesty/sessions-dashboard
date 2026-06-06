'use client';
import { cn } from '@/lib/utils';

type DotStatus = 'active' | 'online' | 'ok' | 'dormant' | 'warn' | 'crit' | 'offline' | 'inactive';

const DOT_COLORS: Record<DotStatus, string> = {
  active:   'bg-green-400 shadow-[0_0_6px_1px_rgba(74,222,128,0.5)]',
  online:   'bg-emerald-400',
  ok:       'bg-emerald-400',
  dormant:  'bg-amber-400',
  warn:     'bg-amber-400',
  crit:     'bg-red-500',
  offline:  'bg-zinc-500',
  inactive: 'bg-zinc-500',
};

export function StatusDot({
  status = 'active' as DotStatus,
  label,
  size = 8,
}: {
  status?: DotStatus;
  label?: string;
  size?: number;
}) {
  const dot = (
    <span
      className={cn('inline-block rounded-full flex-shrink-0', DOT_COLORS[status] || DOT_COLORS.offline)}
      style={{ width: size, height: size }}
    />
  );
  if (!label) return dot;
  return (
    <span className="inline-flex items-center gap-2">
      {dot}
      <span className={cn('text-sm font-medium', status === 'offline' || status === 'inactive' ? 'text-zinc-500' : 'text-zinc-200')}>
        {label}
      </span>
    </span>
  );
}
