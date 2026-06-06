import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'litellm',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'sessions',
});

export async function query(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows;
}
