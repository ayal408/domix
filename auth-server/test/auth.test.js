import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { OAuth2Client } from 'google-auth-library';

process.env.JWT_SECRET = 'test-auth-secret-with-at-least-32-characters';
process.env.GOOGLE_CLIENT_ID = 'test-google-client';
let service, jwt, server, baseUrl, handler, calls;
before(async () => {
  server = createServer((req, res) => { calls.push(req.url); handler(req, res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.DATA_SERVICE_URL = baseUrl;
  service = await import('../src/services/authService.js');
  jwt = await import('../src/utils/jwt.js');
});
after(() => server.close());
function response() {
  return { statusCode: 200, body: null, cookieWritten: false,
    status(code) { this.statusCode = code; return this; },
    set() { return this; }, json(body) { this.body = body; return this; },
    sendStatus(code) { this.statusCode = code; return this; },
    cookie() { this.cookieWritten = true; return this; } };
}
const user = { userId: '11111111-1111-1111-1111-111111111111', userName: 'tester', emailAddress: 'tester@example.com', isBlocked: false };
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }

test('dependency failure returns 503 and does not rotate a cookie', async () => {
  calls = [];
  handler = (_req, res) => json(res, 503, { code: 'down' });
  const res = response();
  await service.refresh({ cookies: { refreshToken: jwt.createRefreshToken(user) } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'AUTH_TEMPORARILY_UNAVAILABLE');
  assert.equal(res.cookieWritten, false);
});
test('failed atomic consume cannot issue a new token', async () => {
  calls = [];
  handler = (req, res) => json(res, 200, req.url.includes('by-id') ? user : { consumed: false });
  const res = response();
  await service.refresh({ cookies: { refreshToken: jwt.createRefreshToken(user) } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.cookieWritten, false);
});
test('access token cannot be used as a refresh token', async () => {
  calls = [];
  const res = response();
  await service.refresh({ cookies: { refreshToken: jwt.createAccessToken(user) } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});
test('successful refresh consumes before issuing replacement cookie', async () => {
  calls = [];
  handler = (req, res) => json(res, 200, req.url.includes('by-id') ? user : { consumed: true });
  const res = response();
  await service.refresh({ cookies: { refreshToken: jwt.createRefreshToken(user) } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.accessToken);
  assert.equal(res.cookieWritten, true);
  assert.ok(calls[1].endsWith('/refresh-tokens/consume'));
});
test('Google login refuses unverified email before account lookup', async () => {
  calls = [];
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: 'test@example.com', sub: 'google-id', email_verified: false }) });
  try { await assert.rejects(service.googleLogin('test-token'), /INVALID_GOOGLE_TOKEN/); assert.equal(calls.length, 0); }
  finally { OAuth2Client.prototype.verifyIdToken = original; }
});
test('blocked password account is refused before linking Google', async () => {
  calls = [];
  handler = (_req, res) => json(res, 200, { ...user, googleId: null, isBlocked: true });
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: user.emailAddress, sub: 'google-id', email_verified: true }) });
  try { await assert.rejects(service.googleLogin('test-token'), /ACCOUNT_BLOCKED/); assert.equal(calls.length, 1); }
  finally { OAuth2Client.prototype.verifyIdToken = original; }
});
test('verified Google account receives a DOMIX session', async () => {
  calls = [];
  handler = (_req, res) => json(res, 200, { ...user, googleId: 'google-id', registrationMethod: 'Google' });
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: user.emailAddress, sub: 'google-id', email_verified: true }) });
  try { const result = await service.googleLogin('test-token'); assert.ok(result.accessToken); assert.ok(result.refreshToken); }
  finally { OAuth2Client.prototype.verifyIdToken = original; }
});
test('Google login can load the client id configured by an administrator', async () => {
  calls = [];
  const configuredClientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  handler = (req, res) => json(res, 200, req.url.includes('/api/config/google')
    ? { clientId: 'admin-configured-google-client' }
    : { ...user, googleId: 'google-id', registrationMethod: 'Google' });
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: user.emailAddress, sub: 'google-id', email_verified: true }) });
  try {
    const result = await service.googleLogin('test-token');
    assert.ok(result.accessToken);
    assert.ok(calls[0].endsWith('/api/config/google'));
  } finally {
    process.env.GOOGLE_CLIENT_ID = configuredClientId;
    OAuth2Client.prototype.verifyIdToken = original;
  }
});
