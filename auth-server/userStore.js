const { pool } = require('./db');

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash AS "passwordHash", name FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return rows[0];
}

async function create({ email, passwordHash, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash AS "passwordHash", name`,
    [email.toLowerCase(), passwordHash, name || null]
  );
  return rows[0];
}

module.exports = { findByEmail, create };
