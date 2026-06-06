'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

function preprocessObsidian(text: string): string {
  // Strip wikilinks: [[Note|Display]] -> Display, [[Note]] -> Note
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

type CalloutType = 'note' | 'warning' | 'danger' | 'info' | 'tip' | 'success' | 'question';

const CALLOUT_COLORS: Record<CalloutType | string, string> = {
  note:     'border-blue-500/40 bg-blue-500/10 text-blue-300',
  info:     'border-blue-500/40 bg-blue-500/10 text-blue-300',
  tip:      'border-green-500/40 bg-green-500/10 text-green-300',
  success:  'border-green-500/40 bg-green-500/10 text-green-300',
  warning:  'border-amber-500/40 bg-amber-500/10 text-amber-300',
  caution:  'border-amber-500/40 bg-amber-500/10 text-amber-300',
  danger:   'border-red-500/40 bg-red-500/10 text-red-300',
  error:    'border-red-500/40 bg-red-500/10 text-red-300',
  question: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  abstract: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  summary:  'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  quote:    'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
};

const CALLOUT_ICONS: Record<string, string> = {
  note: '📝', info: 'ℹ️', tip: '💡', success: '✅', warning: '⚠️',
  caution: '⚠️', danger: '🚨', error: '🚨', question: '❓',
  abstract: '📋', summary: '📋', quote: '💬',
};

function CalloutBlock({ children }: { children: React.ReactNode }) {
  const text = extractText(children);
  const match = text.match(/^\[!(\w+)\][\s\n]*/i);
  if (!match) {
    return (
      <blockquote className="border-l-2 border-zinc-600 pl-3 text-zinc-400 italic my-2">
        {children}
      </blockquote>
    );
  }
  const type = match[1].toLowerCase();
  const colors = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;
  const icon = CALLOUT_ICONS[type] || '📝';
  const restText = text.slice(match[0].length);
  return (
    <div className={`border-l-4 rounded-r px-3 py-2 my-2 text-sm ${colors}`}>
      <div className="font-semibold mb-1 flex items-center gap-1.5">
        <span>{icon}</span>
        <span className="capitalize">{type}</span>
      </div>
      <div className="text-zinc-300 text-xs leading-relaxed">{restText}</div>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in (node as any)) {
    return extractText((node as any).props.children);
  }
  return '';
}

const COMPONENTS: Components = {
  blockquote: ({ children }) => <CalloutBlock>{children}</CalloutBlock>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="bg-zinc-950 border border-zinc-800 rounded p-2 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-zinc-300">{children}</code>
        </pre>
      );
    }
    return <code className="bg-zinc-800 text-zinc-200 rounded px-1 py-0.5 text-xs font-mono">{children}</code>;
  },
  a: ({ children }) => <span className="text-blue-400 underline decoration-dotted">{children}</span>,
  h1: ({ children }) => <h1 className="text-base font-bold text-zinc-100 mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-zinc-200 mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-zinc-300 mt-2 mb-0.5">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 ml-1">{children}</ol>,
  li: ({ children }) => <li className="text-zinc-300">{children}</li>,
  input: ({ type, checked }) => type === 'checkbox'
    ? <input type="checkbox" checked={checked} readOnly className="mr-1.5 accent-blue-500 cursor-default" />
    : null,
  hr: () => <hr className="border-zinc-700 my-3" />,
};

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className = '' }: MarkdownProps) {
  const processed = preprocessObsidian(children || '');
  return (
    <div className={`text-sm text-zinc-300 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
