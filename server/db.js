'use strict';
/* Connexion Postgres et migrations. */
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(1700, parseFloat); // numeric -> nombre
types.setTypeParser(1082, v => v);     // date -> 'AAAA-MM-JJ' tel quel (pas de fuseau)

const url = process.env.DATABASE_URL || 'postgres://zeste:zeste@127.0.0.1:5432/zeste';
const ssl = /sslmode=require/.test(url) || process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined;
const pool = new Pool({ connectionString: url, ssl, max: Number(process.env.PG_POOL || 10) });

const q = (text, params) => pool.query(text, params).then(r => r.rows);

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn((text, params) => c.query(text, params).then(r => r.rows));
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/* Applique, dans l'ordre, les fichiers de server/migrations pas encore passés. */
async function migrate() {
  const dir = path.join(__dirname, 'migrations');
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(741101)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
      if (done.has(f)) continue;
      await c.query('BEGIN');
      try {
        await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await c.query('COMMIT');
        console.log('migration appliquée :', f);
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(741101)').catch(() => {});
    c.release();
  }
}

module.exports = { pool, q, tx, migrate };
