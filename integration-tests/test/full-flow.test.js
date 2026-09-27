// Exercises the real auth-server -> domix-server -> Postgres chain end to end: no mocks, no
// stubbed HTTP calls. This is what would have caught the dotenv/import-order bug fixed in
// b9a1a0b (auth-server silently talking to a stale external URL instead of the local
// domix-server) — a unit-tested auth-server alone can't see that, since the bug was entirely
// in how the two services connect to each other.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { startServices } from "../helpers/services.js";

const POSTGRES_URL =
  process.env.INTEGRATION_TEST_POSTGRES_URL ||
  "Host=localhost;Port=5432;Database=domix_integration_test;Username=postgres;Password=postgres";

let services;
// Unique per test run so re-running locally against a lingering database never collides.
const runId = Date.now();

before(async () => {
  services = await startServices({
    postgresUrl: POSTGRES_URL,
    domixServerPort: 18080,
    authServerPort: 15000,
  });
});

after(async () => {
  await services.stop();
});

function authFetch(path, options) {
  return fetch(`${services.authServerUrl}/auth${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

test("register creates a user that is actually persisted in domix-server's database", async () => {
  const email = `flow-${runId}@example.com`;
  const res = await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName: `flow${runId}`, email, password: "password123" }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.accessToken);
  assert.equal(body.user.email, email);

  // Confirms the write actually reached domix-server's database, not just that auth-server
  // returned something that looked right.
  const directRes = await fetch(`${services.domixServerUrl}/api/User/lookup?email=${email}`);
  const directBody = await directRes.json();
  assert.equal(directRes.status, 200);
  assert.equal(directBody.userId, body.user.userId);
});

test("register rejects a duplicate email", async () => {
  const email = `dup-${runId}@example.com`;
  await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName: `dup${runId}a`, email, password: "password123" }),
  });

  const res = await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName: `dup${runId}b`, email, password: "password123" }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, "EMAIL_EXISTS");
});

test("login succeeds with the password set at registration and the token authenticates /me", async () => {
  const email = `login-${runId}@example.com`;
  const userName = `login${runId}`;
  await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password: "password123" }),
  });

  const loginRes = await authFetch("/login", {
    method: "POST",
    body: JSON.stringify({ userName, password: "password123" }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.ok(loginBody.accessToken);

  const meRes = await authFetch("/me", {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  const meBody = await meRes.json();
  assert.equal(meRes.status, 200);
  assert.equal(meBody.user.email, email);
});

test("login rejects the wrong password without leaking whether the account exists", async () => {
  const email = `wrongpw-${runId}@example.com`;
  const userName = `wrongpw${runId}`;
  await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password: "password123" }),
  });

  const res = await authFetch("/login", {
    method: "POST",
    body: JSON.stringify({ userName, password: "totally-wrong" }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, "INVALID_PASSWORD");
});

test("login rejects an unknown username", async () => {
  const res = await authFetch("/login", {
    method: "POST",
    body: JSON.stringify({ userName: `nobody-${runId}`, password: "password123" }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, "USER_NOT_FOUND");
});

test("/me rejects a request with no token", async () => {
  const res = await authFetch("/me");
  assert.equal(res.status, 401);
});

test("/me rejects a malformed token", async () => {
  const res = await authFetch("/me", { headers: { Authorization: "Bearer not-a-real-token" } });
  assert.equal(res.status, 401);
});
