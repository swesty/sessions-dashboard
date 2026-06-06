import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sessions = await query('SELECT * FROM sessions WHERE session_id = $1', [id]);
    if (sessions.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const messages = await query(
      'SELECT line_no, ts, type, raw FROM messages WHERE session_id = $1 ORDER BY line_no', [id]
    );
    const summaries = await query(
      'SELECT * FROM summaries WHERE session_id = $1 ORDER BY generated_at DESC', [id]
    );
    return NextResponse.json({ session: sessions[0], messages, summaries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
