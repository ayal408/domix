// Minimal in-memory user store.
// Swap this out for a real database once one is wired up (see DB_CONNECTION_STRING
// in docker-compose.yml for domix-server) — data here does not survive a restart.
const usersByEmail = new Map();

function findByEmail(email) {
  return usersByEmail.get(email.toLowerCase());
}

function create({ email, passwordHash, name }) {
  const user = {
    id: usersByEmail.size + 1,
    email: email.toLowerCase(),
    passwordHash,
    name,
    createdAt: new Date().toISOString(),
  };
  usersByEmail.set(user.email, user);
  return user;
}

module.exports = { findByEmail, create };
