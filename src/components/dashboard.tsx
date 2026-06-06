'use client';

import { useState } from 'react';
import { SessionsPanel } from './sessions-panel';
import { HostsPanel } from './hosts-panel';
import { TodayPanel } from './today-panel';
import { QuickCapture } from './quick-capture';
import { MetricsPanel } from './metrics-panel';

const TABS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'today', label: 'Daily Log' },
  { id: 'metrics', label: 'Metrics' },
];

export function Dashboard() {
  const [tab, setTab] = useState('sessions');

  return (
    <main className='min-h-screen bg-zinc-950 text-zinc-100 pb-16'>
      <div className='h-0.5 bg-blue-600 w-full' />
      <header className='border-b border-zinc-800 px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-xl font-bold tracking-tight text-zinc-100'>PAI Sessions</h1>
            <p className='text-zinc-500 text-xs mt-0.5'>Cross-machine Claude Code aggregation</p>
          </div>
          <div className='flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800'>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  tab === t.id
                    ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className='p-6'>
        {tab === 'sessions' && (
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            <div className='lg:col-span-3'>
              <SessionsPanel />
            </div>
            <div>
              <HostsPanel />
            </div>
          </div>
        )}
        {tab === 'today' && (
          <div className='max-w-3xl'>
            <TodayPanel />
          </div>
        )}
        {tab === 'metrics' && (
          <div className='w-full'>
            <MetricsPanel />
          </div>
        )}
      </div>

      <QuickCapture />
    </main>
  );
}
