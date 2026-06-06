import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');
  const date = searchParams.get('date');

  let sql = `
    SELECT s.session_id, s.host, s.cwd, s.git_branch, s.first_seen, s.last_seen,
           s.line_count, s.status,
           (SELECT raw->>'aiTitle' FROM messages WHERE session_id = s.session_id AND type = 'ai-title' ORDER BY line_no DESC LIMIT 1) as title,
           (SELECT summary_md FROM summaries WHERE session_id = s.session_id ORDER BY generated_at DESC LIMIT 1) as summary
    FROM sessions s
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (host) {
    params.push(host);
    sql += ` AND s.host = \$${params.length}`;
  }
  if (date) {
    params.push(date);
    sql += ` AND DATE(s.last_seen AT TIME ZONE 'America/New_York') = \$${params.length}`;
  }
  sql += ' ORDER BY s.last_seen DESC LIMIT 100';

  try {
    const rows = await query(sql, params);
    return NextResponse.json({ sessions: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
