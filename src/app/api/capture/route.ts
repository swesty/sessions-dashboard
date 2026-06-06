import { NextResponse } from 'next/server';
import * as fs from 'fs';

const VAULT = '/vault';
const LOG_PATTERN = /(> \[!log\][-+]?[^\n]*\n)((?:>[^\n]*\n?)*)/;

export async function POST(request: Request) {
  const { text, section = 'log', date } = await request.json();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const targetDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const notePath = `${VAULT}/Daily Notes/${targetDate}.md`;

  if (!fs.existsSync(notePath)) {
    return NextResponse.json({ error: 'Daily note not found' }, { status: 404 });
  }

  let content = fs.readFileSync(notePath, 'utf-8');
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });

  if (section === 'log') {
    const match = content.match(LOG_PATTERN);
    if (!match) return NextResponse.json({ error: 'Day Log callout not found' }, { status: 400 });
    const header = match[1];
    const body = match[2];
    const entry = `> - ${time} #log/admin ${text}\n`;
    const newBody = body.replace(/\n?$/, '\n') + entry;
    content = content.replace(LOG_PATTERN, header + newBody);
  } else if (section === 'braindump') {
    const bdPattern = /(## Brain Dump\n)([\s\S]*?)(?=\n## |\n# |$)/;
    const match = content.match(bdPattern);
    if (match) {
      const newSection = match[2].replace(/\n?$/, '\n') + `- ${text}\n`;
      content = content.replace(bdPattern, match[1] + newSection);
    } else {
      content += `\n\n## Brain Dump\n- ${text}\n`;
    }
  } else if (section === 'blockers') {
    const bPattern = /(## Blockers\n)([\s\S]*?)(?=\n## |\n# |$)/;
    const match = content.match(bPattern);
    if (match) {
      const newSection = match[2].replace(/\n?$/, '\n') + `- ${text}\n`;
      content = content.replace(bPattern, match[1] + newSection);
    } else {
      content += `\n\n## Blockers\n- ${text}\n`;
    }
  }

  fs.writeFileSync(notePath, content);
  return NextResponse.json({ ok: true, date: targetDate, section, text });
}
