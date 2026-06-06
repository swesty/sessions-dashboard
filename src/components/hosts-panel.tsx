'use client';

import { useEffect, useState } from 'react';
import { HostChip } from './ui/host-chip';

interface Host {
  host: string;
  session_count: number;
  last_activity: string;
  total_lines: number;
}

interface WorkflowRun {
  workflow_name: string;
  run_started: string;
  run_finished: string | null;
  status: string;
  error_message: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HostsPanel() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [updating, setUpdating] = useState(false);

  const refresh = () => {
    fetch('/api/hosts').then(r => r.json()).then(d => {
      setHosts(d.hosts || []);
      setWorkflows(d.workflows || []);
    });
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      await fetch('https://n8n.swesty.net/webhook/pull-now', { method: 'POST' });
      setTimeout(() => { refresh(); setUpdating(false); }, 5000);
    } catch {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Network</h2>
          <button
            onClick={triggerUpdate}
            disabled={updating}
            className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded transition-colors"
          >
            {updating ? 'Updating…' : 'Update Now'}
          </button>
        </div>
        <div className="space-y-1.5">
          {hosts.map(h => (
            <div key={h.host} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <HostChip host={h.host} size="sm" />
                <span className="text-xs text-zinc-500 tabular-nums">{timeAgo(h.last_activity)}</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
                {h.session_count} sessions · {Number(h.total_lines).toLocaleString()} lines
              </div>
            </div>
          ))}
        </div>
      </div>

      {workflows.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Workflows</h3>
          <div className="space-y-0.5">
            {workflows.map(w => {
              const statusColor =
                w.status === 'ok' ? 'text-green-400' :
                w.status === 'running' ? 'text-amber-400' :
                'text-red-400';
              return (
                <div key={w.workflow_name} className="flex items-center justify-between text-xs py-1">
                  <span className="text-zinc-300 font-mono">{w.workflow_name}</span>
                  <span className={statusColor}>
                    {w.status} · {timeAgo(w.run_started)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
