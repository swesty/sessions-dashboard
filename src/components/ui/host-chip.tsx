import { cn } from '@/lib/utils';

const HOST_STYLES: Record<string, string> = {
  m4:        'text-blue-400 bg-blue-400/20 border-blue-400/30',
  macstudio: 'text-purple-400 bg-purple-400/20 border-purple-400/30',
  jarvis:    'text-green-400 bg-green-400/20 border-green-400/30',
  gesserit:  'text-amber-400 bg-amber-400/20 border-amber-400/30',
  'spark-1': 'text-red-400 bg-red-400/20 border-red-400/30',
  'spark-2': 'text-cyan-400 bg-cyan-400/20 border-cyan-400/30',
};

export function HostChip({
  host,
  size = 'md',
  className,
}: {
  host: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const styles = HOST_STYLES[host.toLowerCase()] || 'text-zinc-400 border-zinc-600 bg-transparent';
  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded border whitespace-nowrap',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5',
      styles,
      className,
    )}>
      {host}
    </span>
  );
}
