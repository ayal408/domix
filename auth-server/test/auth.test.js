const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

const { pool, migrateWithRetry } = require('../db');
const app = require('../app');
const { startServer } = require('./helpers');

let server;

before(async () => {
  await migrateWithRetry(3, 500);
  server = await startServer(app);
});

after(async () => {
  await server.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY');
});

test('register creates a user and returns a token', async () => {
  const res = await server.request('POST', '/api/auth/register', {
    email: 'a@b.com',
    password: 'password123',
    name: 'A',
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.deepEqual(res.body.user, { id: 1, email: 'a@b.com', name: 'A' });
});

test('register rejects a short password', async () => {
  const res = await server.request('POST', '/api/auth/register', {
    email: 'a@b.com',
    password: 'short',
  });

  assert.equal(res.status, 400);
});

test('register rejects a duplicate email', async () => {
  await server.request('POST', '/api/auth/register', { email: 'a@b.com', password: 'password123' });
  const res = await server.request('POST', '/api/auth/register', { email: 'a@b.com', password: 'password123' });

  assert.equal(res.status, 409);
});

test('login succeeds with correct credentials', async () => {
  await server.request('POST', '/api/auth/register', { email: 'a@b.com', password: 'password123' });
  const res = await server.request('POST', '/api/auth/login', { email: 'a@b.com', password: 'password123' });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('login fails with wrong password', async () => {
  await server.request('POST', '/api/auth/register', { email: 'a@b.com', password: 'password123' });
  const res = await server.request('POST', '/api/auth/login', { email: 'a@b.com', password: 'wrongpass' });

  assert.equal(res.status, 401);
});

test('login fails for an unknown email', async () => {
  const res = await server.request('POST', '/api/auth/login', { email: 'nobody@b.com', password: 'password123' });

  assert.equal(res.status, 401);
});

test('me returns the current user with a valid token', async () => {
  const { body: registerBody } = await server.request('POST', '/api/auth/register', {
    email: 'a@b.com',
    password: 'password123',
    name: 'A',
  });

  const res = await server.request('GET', '/api/auth/me', undefined, {
    Authorization: `Bearer ${registerBody.token}`,
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { id: 1, email: 'a@b.com', name: 'A' });
});

test('me rejects a missing token', async () => {
  const res = await server.request('GET', '/api/auth/me');

  assert.equal(res.status, 401);
});

test('me rejects a malformed token', async () => {
  const res = await server.request('GET', '/api/auth/me', undefined, {
    Authorization: 'Bearer not-a-real-token',
  });

  assert.equal(res.status, 401);
});
