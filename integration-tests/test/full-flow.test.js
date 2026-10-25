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

test("logout revokes the refresh token so it can no longer be used to refresh", async () => {
  const email = `revoke-${runId}@example.com`;
  const userName = `revoke${runId}`;
  const registerRes = await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password: "password123" }),
  });
  assert.equal(registerRes.status, 200);

  const refreshCookie = registerRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("refreshToken="))
    .split(";")[0];

  // The token still works before logout -- establishes the baseline this test is actually
  // checking, rather than just proving logout doesn't crash.
  const beforeLogout = await authFetch("/refresh", {
    method: "POST",
    headers: { Cookie: refreshCookie },
  });
  assert.equal(beforeLogout.status, 200);

  const logoutRes = await authFetch("/logout", {
    method: "POST",
    headers: { Cookie: refreshCookie },
  });
  assert.equal(logoutRes.status, 204);

  const afterLogout = await authFetch("/refresh", {
    method: "POST",
    headers: { Cookie: refreshCookie },
  });
  assert.equal(afterLogout.status, 401);
});

test("refresh rotates the refresh token, so a reused old one is rejected", async () => {
  const email = `rotate-${runId}@example.com`;
  const userName = `rotate${runId}`;
  const registerRes = await authFetch("/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password: "password123" }),
  });
  assert.equal(registerRes.status, 200);

  const originalCookie = registerRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("refreshToken="))
    .split(";")[0];

  const firstRefresh = await authFetch("/refresh", {
    method: "POST",
    headers: { Cookie: originalCookie },
  });
  assert.equal(firstRefresh.status, 200);

  const rotatedCookie = firstRefresh.headers
    .getSetCookie()
    .find((c) => c.startsWith("refreshToken="))
    .split(";")[0];
  // Rotation only means something if the new cookie is a genuinely different token.
  assert.notEqual(rotatedCookie, originalCookie);

  // The original token was consumed by the refresh above -- reusing it is exactly what a stolen,
  // already-used refresh token would look like.
  const reuseOriginal = await authFetch("/refresh", {
    method: "POST",
    headers: { Cookie: originalCookie },
  });
  assert.equal(reuseOriginal.status, 401);

  // The rotated token, on the other hand, is the legitimate live session and must keep working.
  const useRotated = await authFetch("/refresh", {
    method: "POST",
    headers: { Cookie: rotatedCookie },
  });
  assert.equal(useRotated.status, 200);
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

test("exchange acceptance atomically reserves both homes and cancellation releases them", async () => {
  async function user(suffix) {
    const response = await authFetch("/register", { method: "POST", body: JSON.stringify({ userName: `swap${suffix}${runId}`, email: `swap-${suffix}-${runId}@example.com`, password: "password123" }) });
    assert.equal(response.status, 200); return response.json();
  }
  const [a, b] = await Promise.all([user("a"), user("b")]);
  async function api(token, path, body, method = "POST") {
    return fetch(`${services.domixServerUrl}/api/exchange${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const start = day(10), end = day(13);
  async function home(token, address, city) {
    const response = await fetch(`${services.domixServerUrl}/api/Apartment`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ city, address, area: "Center", price: 0, listingType: "Exchange", desiredCity: "Haifa", availableFrom: day(5), availableTo: day(30), guestCapacity: 6, kosherKitchen: true }) });
    assert.equal(response.status, 200); return response.json();
  }
  const offered = await home(a.accessToken, "Herzl 1", "Haifa");
  const targets = [await home(b.accessToken, "Jaffa 1", "Jerusalem"), await home(b.accessToken, "Jaffa 2", "Jerusalem")];
  const pending = [];
  for (const target of targets) {
    const response = await api(a.accessToken, "/requests", { offeredApartmentId: offered.apartmentId, requestedApartmentId: target.apartmentId, start, end, guests: 3 });
    assert.equal(response.status, 200); pending.push(await response.json());
  }
  const selfAccept = await api(a.accessToken, `/requests/${pending[0].id}/decision`, { action: "Accept", revision: 0 });
  assert.equal(selfAccept.status, 403);
  const results = await Promise.all(pending.map(request => api(b.accessToken, `/requests/${request.id}/decision`, { action: "Accept", revision: 0, recipientGuests: 2 })));
  const details = await Promise.all(results.map(async response => ({ status: response.status, body: await response.json() })));
  assert.deepEqual(details.map(result => result.status).sort(), [200, 409], JSON.stringify(details));
  const accepted = details.find(result => result.status === 200).body;
  const ownerCalendar = await api(a.accessToken, `/calendar/${offered.apartmentId}`, undefined, "GET");
  assert.equal((await ownerCalendar.json()).reservations.length, 1);
  const foreignCalendar = await api(b.accessToken, `/calendar/${offered.apartmentId}`, undefined, "GET");
  assert.equal(foreignCalendar.status, 403);
  const block = await api(a.accessToken, `/calendar/${offered.apartmentId}`, { start, end, isAvailable: false });
  assert.equal(block.status, 409);
  const cancel = await api(a.accessToken, `/requests/${accepted.id}/decision`, { action: "Cancel", revision: accepted.revision });
  assert.equal(cancel.status, 200);
  const remaining = pending.find(request => request.id !== accepted.id);
  const acceptRemaining = await api(b.accessToken, `/requests/${remaining.id}/decision`, { action: "Accept", revision: 0, recipientGuests: 2 });
  assert.equal(acceptRemaining.status, 200, await acceptRemaining.text());
  const watch = await api(a.accessToken, "/watches", { offeredApartmentId: offered.apartmentId, destination: "Jerusalem", start: day(15), end: day(18), frequency: "Daily" });
  assert.equal(watch.status, 200); const savedWatch = await watch.json();
  const stopAlerts = await api(a.accessToken, `/watches/${savedWatch.id}/frequency`, "Off", "PATCH");
  assert.equal(stopAlerts.status, 204);
  const foreignStop = await api(b.accessToken, `/watches/${savedWatch.id}/frequency`, "Off", "PATCH");
  assert.equal(foreignStop.status, 404);
  const report = await api(a.accessToken, "/reports", { apartmentId: targets[0].apartmentId, reason: "Please check this listing" });
  assert.equal(report.status, 200);
  const blockUser = await api(a.accessToken, `/blocks/${b.user.userId}`);
  assert.equal(blockUser.status, 204);
  const matches = await api(a.accessToken, `/matches?offeredApartmentId=${offered.apartmentId}&destination=Jerusalem&start=${day(15)}&end=${day(18)}`, undefined, "GET");
  assert.equal(matches.status, 200); assert.equal((await matches.json()).length, 0);

});
