import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export const db = new Pool({
  connectionString: config.databaseUrl,
});

export async function runMigrations() {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(12345)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        filename TEXT PRIMARY KEY,
        ran_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      const already = await client.query(
        'SELECT 1 FROM migrations WHERE filename = $1',
        [file]
      );

      if (already.rows.length === 0) {
        const sql = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf8'
        );
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        console.log(`Migration ran: ${file}`);
      } else {
        console.log(`Already ran: ${file}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(12345)');
    client.release();
  }
}