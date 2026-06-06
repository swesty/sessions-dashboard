'use client';

import { useEffect, useState } from 'react';
import { Markdown } from './md';

interface DailyNote {
  date: string;
  frontmatter: Record<string, string>;
  sections: Record<string, string>;
}

function localToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dt.toLocaleDateString('en-CA');
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function TodayPanel() {
  const [selectedDate, setSelectedDate] = useState<string>(localToday());
  const [note, setNote] = useState<DailyNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const today = localToday();
  const isToday = selectedDate === today;

  const go = (date: string) => {
    setSelectedDate(date);
    setNote(null);
    setNotFound(false);
    setLoading(true);
  };

  useEffect(() => {
    fetch(`/api/daily/${selectedDate}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d) { setNote(d); setLoading(false); } })
      .catch(() => setLoading(false));
  }, [selectedDate]);

  const priorities = note ? [1, 2, 3].map(i => note.frontmatter[`top_priority_${i}`]).filter(Boolean) : [];

  const sectionOrder = ['Day Log', "Today's Focus", 'Daily Check-in', 'Work', 'Personal'];
  const displaySections = note
    ? Object.entries(note.sections)
        .filter(([k]) => !['frontmatter', '_body'].includes(k))
        .sort(([a], [b]) => {
          const ai = sectionOrder.indexOf(a);
          const bi = sectionOrder.indexOf(b);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        })
    : [];

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => go(shiftDate(selectedDate, -1))}
          className="px-2.5 py-1.5 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-600 transition-all"
          title="Previous day"
        >
          ←
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-zinc-200">{formatDisplayDate(selectedDate)}</span>
          {isToday && <span className="ml-2 text-xs text-blue-400 font-medium">Today</span>}
        </div>

        <button
          onClick={() => go(shiftDate(selectedDate, 1))}
          disabled={isToday}
          className="px-2.5 py-1.5 text-sm rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:border-zinc-700"
          title="Next day"
        >
          →
        </button>

        {!isToday && (
          <button
            onClick={() => go(today)}
            className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 transition-all font-medium"
          >
            Today
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-zinc-800 rounded w-24 mb-3" />
              <div className="h-3 bg-zinc-800/60 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!loading && notFound && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <p className="text-zinc-500 text-sm">No daily note for {selectedDate}</p>
          <button onClick={() => go(today)} className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
            Jump to today
          </button>
        </div>
      )}

      {!loading && note && (
        <>
          {priorities.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">Top Priorities</h3>
              <ol className="space-y-1.5">
                {priorities.map((p, i) => (
                  <li key={i} className="text-sm flex gap-2.5">
                    <span className="text-zinc-600 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span className="text-zinc-200 leading-snug">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {displaySections.map(([name, content]) => (
            <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2.5">{name}</h3>
              {content.trim() ? (
                <div className="max-h-[32rem] overflow-y-auto">
                  <Markdown>{content}</Markdown>
                </div>
              ) : (
                <span className="text-zinc-600 italic text-sm">empty</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
