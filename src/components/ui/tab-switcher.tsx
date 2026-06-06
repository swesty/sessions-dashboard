'use client';
import { cn } from '@/lib/utils';

interface Tab { id: string; label: string; }

export function TabSwitcher({
  tabs,
  value,
  onChange,
}: {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-1.5 text-sm rounded-md transition-colors font-medium',
            value === t.id
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
