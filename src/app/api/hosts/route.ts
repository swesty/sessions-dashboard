import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const hosts = await query(`
      SELECT host, count(*) as session_count,
             max(last_seen) as last_activity,
             sum(line_count) as total_lines
      FROM sessions GROUP BY host ORDER BY last_activity DESC
    `);
    const workflows = await query(`
      SELECT DISTINCT ON (workflow_name) workflow_name, run_started, run_finished, status, error_message
      FROM workflow_runs ORDER BY workflow_name, run_started DESC
    `);
    return NextResponse.json({ hosts, workflows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
