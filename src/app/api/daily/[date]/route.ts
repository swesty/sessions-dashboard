import { NextResponse } from 'next/server';
import * as fs from 'fs';

const VAULT = '/vault';

function parseSections(content: string) {
  const sections: Record<string, string> = {};
  const lines = content.split('\n');
  let currentSection = 'frontmatter';
  let sectionContent: string[] = [];
  let inFrontmatter = false;

  for (const line of lines) {
    if (line === '---' && !inFrontmatter) { inFrontmatter = true; continue; }
    if (line === '---' && inFrontmatter) {
      sections[currentSection] = sectionContent.join('\n');
      sectionContent = []; currentSection = '_body'; inFrontmatter = false; continue;
    }
    if (line.startsWith('## ')) {
      if (currentSection) sections[currentSection] = sectionContent.join('\n');
      currentSection = line.replace('## ', '').trim(); sectionContent = []; continue;
    }
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      if (currentSection) sections[currentSection] = sectionContent.join('\n');
      currentSection = line.replace('# ', '').trim(); sectionContent = []; continue;
    }
    sectionContent.push(line);
  }
  if (currentSection) sections[currentSection] = sectionContent.join('\n');
  return sections;
}

function parseFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const notePath = `${VAULT}/Daily Notes/${date}.md`;
  if (!fs.existsSync(notePath)) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  const content = fs.readFileSync(notePath, 'utf-8');
  return NextResponse.json({ date, frontmatter: parseFrontmatter(content), sections: parseSections(content), raw: content });
}
