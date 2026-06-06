'use client';

import { useState } from 'react';
import { SessionsPanel } from './sessions-panel';
import { HostsPanel } from './hosts-panel';
import { TodayPanel } from './today-panel';
import { QuickCapture } from './quick-capture';
import { MetricsPanel } from './metrics-panel';
import { TabSwitcher } from './ui/tab-switcher';
import { InferencePanel } from './inference-panel';

const TABS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'today',    label: 'Daily Log' },
  { id: 'metrics',   label: 'Metrics' },
  { id: 'inference', label: 'Inference' },
];

export function Dashboard() {
  const [tab, setTab] = useState('sessions');

  return (
    <main className='min-h-screen bg-zinc-950 text-zinc-100 pb-16'>
      <div className='h-0.5 w-full' style={{ background: 'var(--brand-bar)' }} />
      <header className='border-b border-zinc-800 px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-xl font-bold tracking-tight text-zinc-100'>PAI Sessions</h1>
            <p className='text-zinc-500 text-xs mt-0.5'>Cross-machine Claude Code aggregation</p>
          </div>
          <TabSwitcher tabs={TABS} value={tab} onChange={setTab} />
        </div>
      </header>

      <div className='p-6'>
        {tab === 'sessions' && (
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            <div className='lg:col-span-3'><SessionsPanel /></div>
            <div><HostsPanel /></div>
          </div>
        )}
        {tab === 'today'   && <div className='max-w-3xl'><TodayPanel /></div>}
        {tab === 'metrics'   && <div className='w-full'><MetricsPanel /></div>}
        {tab === 'inference' && <div className='w-full'><InferencePanel /></div>}
      </div>

      <QuickCapture />
    </main>
  );
}
