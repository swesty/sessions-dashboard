'use client';

import { useEffect, useState } from 'react';
import { Markdown } from './md';
import { StatusDot } from './ui/status-dot';
import { HostChip } from './ui/host-chip';

interface Session {
  session_id: string;
  host: string;
  cwd: string;
  git_branch: string | null;
  first_seen: string;
  last_seen: string;
  line_count: number;
  status: string;
  title: string | null;
  summary: string | null;
}

interface SessionDetail {
  session: Session;
  messages: Array<{ line_no: number; ts: string; type: string; raw: any }>;
  summaries: Array<{ summary_md: string; model: string; generated_at: string }>;
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

function projectName(cwd: string): string {
  if (!cwd) return 'unknown';
  return cwd.split('/').pop() || cwd;
}

function sessionMatchesDate(s: Session, date: string): boolean {
  const d = new Date(date + 'T00:00:00').getTime();
  const first = new Date(s.first_seen).setHours(0, 0, 0, 0);
  const last = new Date(s.last_seen).setHours(23, 59, 59, 999);
  return first <= d + 86400000 - 1 && last >= d;
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostFilter, setHostFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/sessions').then(r => r.json()).then(d => setSessions(d.sessions || []));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const openDetail = async (id: string) => {
    const r = await fetch(`/api/sessions/${id}`);
    const d = await r.json();
    setSelected(d);
  };

  const filtered = sessions.filter(s => {
    if (hostFilter && s.host !== hostFilter) return false;
    if (dateFilter && !sessionMatchesDate(s, dateFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![s.title, s.cwd, s.summary, s.host].some(x => (x || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const hosts = [...new Set(sessions.map(s => s.host))];
  const activeCt = sessions.filter(s => s.status === 'active').length;
  const hasFilters = hostFilter || dateFilter || search;

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <span className="text-zinc-500 text-sm">
          {hasFilters ? `${filtered.length} of ${sessions.length}` : `${sessions.length} total`}
        </span>
        {activeCt > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.4)]" />
            <span className="text-xs text-green-400">{activeCt} active</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-40">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, project, summary..."
            className="w-full bg-zinc-800/70 border border-zinc-700 text-zinc-200 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          title="Filter by date active"
          className="bg-zinc-800/70 border border-zinc-700 text-zinc-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500 [color-scheme:dark]"
        />
        <button
          onClick={() => setHostFilter('')}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${!hostFilter ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-zinc-400'}`}
        >
          All
        </button>
        {hosts.map(h => (
          <button
            key={h}
            onClick={() => setHostFilter(hostFilter === h ? '' : h)}
            className={`transition-opacity ${hostFilter && hostFilter !== h ? 'opacity-50' : 'opacity-100'}`}
          >
            <HostChip host={h} size="sm" className={hostFilter === h ? 'ring-1 ring-zinc-500' : ''} />
          </button>
        ))}
        {hasFilters && (
          <button
            onClick={() => { setHostFilter(''); setSearch(''); setDateFilter(''); }}
            className="px-2.5 py-1 text-xs rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-zinc-500 text-sm py-6 text-center">No sessions match the current filters.</div>
        )}
        {filtered.map(s => (
          <div
            key={s.session_id}
            onClick={() => openDetail(s.session_id)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <StatusDot status={s.status as any} />
              <HostChip host={s.host} size="sm" />
              <span className="font-medium text-sm text-zinc-100 group-hover:text-white">{s.title || projectName(s.cwd)}</span>
              {s.git_branch && s.git_branch !== 'HEAD' && (
                <span className="text-xs text-zinc-500 font-mono">{s.git_branch}</span>
              )}
              <span className="ml-auto text-xs text-zinc-500">{timeAgo(s.last_seen)}</span>
              <span className="text-xs text-zinc-600">{s.line_count} lines</span>
            </div>
            {s.summary && (
              <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed pl-[18px]">{s.summary}</p>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/70 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-700 overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <StatusDot status={selected.session.status as any} />
                <h3 className="text-lg font-semibold">{selected.session.title || projectName(selected.session.cwd)}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-300 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors">×</button>
            </div>

            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-3 text-xs text-zinc-400 space-y-1.5 mb-5 font-mono">
              <p><span className="text-zinc-500">host</span>{'   '}<HostChip host={selected.session.host} size="sm" /></p>
              <p><span className="text-zinc-500">cwd</span>{'    '}<span className="text-zinc-300">{selected.session.cwd}</span></p>
              {selected.session.git_branch && <p><span className="text-zinc-500">branch</span> {selected.session.git_branch}</p>}
              <p><span className="text-zinc-500">span</span>{'   '}{new Date(selected.session.first_seen).toLocaleString()} → {new Date(selected.session.last_seen).toLocaleString()}</p>
              <p className="text-zinc-600 pt-1">claude --resume {selected.session.session_id}</p>
            </div>

            {selected.summaries.length > 0 && (
              <div className="mb-5 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Summary</h4>
                <Markdown>{selected.summaries[0].summary_md}</Markdown>
              </div>
            )}

            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Raw Log <span className="text-zinc-600 font-normal normal-case">({selected.messages.length} entries)</span>
            </h4>
            <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
              {selected.messages.map(m => (
                <details key={m.line_no} className="text-xs">
                  <summary className={`cursor-pointer py-1 px-2 rounded hover:bg-zinc-800 list-none flex items-center gap-2 ${
                    m.type === 'user' ? 'text-blue-400' : m.type === 'assistant' ? 'text-green-400' : m.type === 'ai-title' ? 'text-amber-400' : 'text-zinc-500'
                  }`}>
                    <span className="text-zinc-600 shrink-0">{new Date(m.ts).toLocaleTimeString()}</span>
                    <span className="font-mono shrink-0">{m.type}</span>
                    {m.type === 'user' && m.raw?.message && (
                      <span className="text-zinc-400 truncate">{String((m.raw as any)?.message?.content || '').slice(0, 80)}</span>
                    )}
                    {m.type === 'ai-title' && (
                      <span className="text-zinc-400 truncate">{String((m.raw as any)?.aiTitle || '')}</span>
                    )}
                  </summary>
                  <pre className="text-xs text-zinc-500 bg-zinc-950 p-2 rounded mt-0.5 overflow-x-auto max-h-40 border border-zinc-800">
                    {JSON.stringify(m.raw, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
