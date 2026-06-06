'use client';

import { useState } from 'react';

const SECTIONS = [
  { value: 'log', label: 'Day Log' },
  { value: 'braindump', label: 'Brain Dump' },
  { value: 'blockers', label: 'Blockers' },
];

export function QuickCapture() {
  const [text, setText] = useState('');
  const [section, setSection] = useState('log');
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), section }),
      });
      if (r.ok) {
        setText('');
        setFlash('Captured');
        setTimeout(() => setFlash(''), 2000);
      } else {
        const d = await r.json();
        setFlash(d.error || 'Error');
      }
    } catch {
      setFlash('Network error');
    }
    setSending(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-700 p-3 z-40">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <select value={section} onChange={e => setSection(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-2 focus:outline-none focus:border-zinc-500">
          {SECTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Drop a thought..."
          className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
        />
        <button onClick={submit} disabled={sending || !text.trim()}
          className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded transition-colors">
          {sending ? '...' : 'Capture'}
        </button>
        {flash && <span className="text-xs text-green-400 animate-pulse">{flash}</span>}
      </div>
    </div>
  );
}
