import { cn } from '@/lib/utils';

type PillStatus = 'online' | 'offline' | 'warn' | 'crit';

const PILL_STYLES: Record<PillStatus, string> = {
  online:  'bg-emerald-950 text-emerald-400 border-emerald-800',
  offline: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  warn:    'bg-amber-950/50 text-amber-400 border-amber-500/30',
  crit:    'bg-red-950/50 text-red-400 border-red-500/30',
};

const DEFAULT_LABEL: Record<PillStatus, string> = {
  online: 'Online', offline: 'Offline', warn: 'Warn', crit: 'Crit',
};

export function StatusPill({
  status = 'online' as PillStatus,
  children,
}: {
  status?: PillStatus;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn(
      'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
      PILL_STYLES[status] || PILL_STYLES.offline
    )}>
      {children ?? DEFAULT_LABEL[status]}
    </span>
  );
}
