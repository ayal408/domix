// Exercises the real auth-server -> domix-server -> Postgres chain end to end: no mocks, no
// stubbed HTTP calls. This is what would have caught the dotenv/import-order bug fixed in
// b9a1a0b (auth-server silently talking to a stale external URL instead of the local
// domix-server) — a unit-tested auth-server alone can't see that, since the bug was entirely
// in how the two services connect to each other.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { startServices } from "../helpers/services.js";
import { resetDatabase } from "../helpers/db.js";

const POSTGRES_URL =
  process.env.INTEGRATION_TEST_POSTGRES_URL ||
  "Host=localhost;Port=5432;Database=domix_integration_test;Username=postgres;Password=postgres";

let services;
// Unique per test run so re-running locally against a lingering database never collides.
const runId = Date.now();

before(async () => {
  // A fresh Postgres service container gives CI a clean database automatically; this makes
  // repeated local `npm test` runs against the same long-lived database behave the same way
  // -- in particular, the "first user in the database becomes Admin" test below depends on it.
  await resetDatabase(POSTGRES_URL);

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

// domix-server makes the very first user ever registered in the database an Admin (see
// UserService.CreateUserAsync's isFirstUser check) -- captured here so the self-block test
// below has real admin credentials to work with, without a separate bootstrap step.
let adminAccessToken;
let adminUserId;

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

  adminAccessToken = body.accessToken;
  adminUserId = body.user.userId;

  // Confirms the write actually reached domix-server's database, not just that auth-server
  // returned something that looked right. Uses the same internal key auth-server itself
  // presents -- this endpoint is gated to service-to-service callers (see the next test).
  const directRes = await fetch(`${services.domixServerUrl}/api/User/lookup?email=${email}`, {
    headers: { "X-Internal-Api-Key": services.internalServiceKey },
  });
  const directBody = await directRes.json();
  assert.equal(directRes.status, 200);
  assert.equal(directBody.userId, body.user.userId);
  assert.equal(directBody.role, "Admin"); // first user in a fresh database
});

test("domix-server rejects internal-only endpoints without the internal service key", async () => {
  const res = await fetch(`${services.domixServerUrl}/api/User/lookup?email=anyone@example.com`);
  assert.equal(res.status, 403);
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

test("an admin cannot block their own account", async () => {
  const res = await fetch(`${services.domixServerUrl}/api/User/${adminUserId}/block`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminAccessToken}` },
  });
  const body = await res.json();

  assert.equal(res.status, 409);
  assert.equal(body.code, "CANNOT_BLOCK_SELF");
});

test("a user cannot attach an image to another user's apartment", async () => {
  // adminUserId/adminAccessToken owns an apartment created here; a second, unrelated account
  // then tries to register an image against it directly -- this is the exact request shape the
  // real image-management UI sends, just with someone else's apartmentId, so it's what an IDOR
  // exploit against ApartmentImageController would actually look like.
  const createRes = await fetch(`${services.domixServerUrl}/api/Apartment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ city: "Tel Aviv", address: "1 Rothschild", area: "Center", price: 5000 }),
  });
  const apartment = await createRes.json();
  assert.equal(createRes.status, 200);

  const outsiderEmail = `image-outsider-${runId}@example.com`;
  const outsiderRes = await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName: `imageoutsider${runId}`, email: outsiderEmail, password: "password123" }),
  });
  const outsider = await outsiderRes.json();
  assert.equal(outsiderRes.status, 200);

  const imageRes = await fetch(`${services.domixServerUrl}/api/ApartmentImage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${outsider.accessToken}` },
    body: JSON.stringify({ apartmentId: apartment.apartmentId, imageUrl: "https://example.com/hijacked.jpg" }),
  });

  assert.equal(imageRes.status, 403);
});
