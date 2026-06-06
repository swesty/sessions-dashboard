import { NextResponse } from 'next/server';

const PROM = process.env.PROMETHEUS_URL ?? 'http://prometheus:9090';

function rangeSecs(r: string): number {
  const m = r.match(/^(\d+)([smhd])$/);
  if (!m) return 3600;
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(m[1]) * (mult[m[2]] ?? 3600);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('query') ?? '';
  const range = searchParams.get('range');
  const step = searchParams.get('step') ?? '60';

  const url = range
    ? `${PROM}/api/v1/query_range?query=${encodeURIComponent(q)}&start=${(Date.now() / 1000 - rangeSecs(range)).toFixed(0)}&end=${(Date.now() / 1000).toFixed(0)}&step=${step}`
    : `${PROM}/api/v1/query?query=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
