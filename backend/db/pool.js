const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Without this, an idle client losing its connection (DB restart, network
// blip) throws an unhandled 'error' event and crashes the whole process.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;
