const { Pool } = require('pg');

// Local Postgres has no SSL listener; hosted providers like Supabase require
// SSL on external connections and use certificates that don't chain to a
// standard root CA, hence rejectUnauthorized: false.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Without this, an idle client losing its connection (DB restart, network
// blip) throws an unhandled 'error' event and crashes the whole process.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;
