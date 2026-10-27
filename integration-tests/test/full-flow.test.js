// Exercises the real auth-server -> domix-server -> Postgres chain end to end: no mocks, no
// stubbed HTTP calls. This is what would have caught the dotenv/import-order bug fixed in
// b9a1a0b (auth-server silently talking to a stale external URL instead of the local
// domix-server) — a unit-tested auth-server alone can't see that, since the bug was entirely
// in how the two services connect to each other.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { startServices } from "../helpers/services.js";
import { resetDatabase, testQuery } from "../helpers/db.js";

const POSTGRES_URL =
  process.env.INTEGRATION_TEST_POSTGRES_URL ||
  "Host=localhost;Port=5432;Database=domix_integration_test;Username=postgres;Password=postgres";

let services;
// Unique per test run so re-running locally against a lingering database never collides.
const runId = Date.now();

before(async () => {
  // A fresh Postgres service container gives CI a clean database automatically; this makes
  // repeated local `npm test` runs against the same long-lived database behave the same way
  // Administrator setup is explicit below; there is no public first-user elevation.
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

// A test operator verifies the first account and uses the same one-off bootstrap CLI as production.
// Public registration remains unprivileged.
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
  assert.equal(directBody.role, "User"); // Public registration never elevates roles, even on an empty database.
  await testQuery(POSTGRES_URL, 'UPDATE "Users" SET "IsEmailVerified"=TRUE WHERE "UserId"=$1', [adminUserId]);
  await services.bootstrapAdmin(adminUserId);
  await services.bootstrapAdmin(adminUserId); // Same operator action is idempotent.
  const promoted = await fetch(`${services.domixServerUrl}/api/User/by-id/${adminUserId}`, { headers: { "X-Internal-Api-Key": services.internalServiceKey } });
  assert.equal((await promoted.json()).role, "Admin");
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

test("exchange preview works before publishing, stays private, and analytics run on Postgres", async () => {
  // Reuse a fixture account to retain production registration rate limits.
  const login = await authFetch("/login", {
    method: "POST", body: JSON.stringify({ userName: `imageoutsider${runId}`, password: "password123" }),
  });
  assert.equal(login.status, 200);
  const outsider = await login.json();
  const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10);
  const city = `Discovery-${runId}`;
  const created = await fetch(`${services.domixServerUrl}/api/Apartment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${outsider.accessToken}` },
    body: JSON.stringify({ city, address: "Test home", area: "Center", price: 0, listingType: "Exchange", desiredCity: "Jerusalem", availableFrom: start, availableTo: end }),
  });
  const home = await created.json();
  assert.equal(created.status, 200, JSON.stringify(home));
  const url = `${services.domixServerUrl}/api/exchange/preview?${new URLSearchParams({ destination: city, start, end })}`;
  assert.equal((await fetch(url)).status, 401);
  const preview = await fetch(url, { headers: { Authorization: `Bearer ${adminAccessToken}` } });
  assert.equal(preview.status, 200);
  const options = await preview.json();
  assert.equal(options.length, 1);
  assert.equal(options[0].apartment.apartmentId, home.apartmentId);
  assert.equal(options[0].isMutual, false);
  const own = await fetch(url, { headers: { Authorization: `Bearer ${outsider.accessToken}` } });
  assert.equal(own.status, 200);
  assert.deepEqual(await own.json(), []);
  const summary = await fetch(`${services.domixServerUrl}/api/Analytics/summary`, { headers: { Authorization: `Bearer ${adminAccessToken}` } });
  const metrics = await summary.json();
  assert.equal(summary.status, 200, JSON.stringify(metrics));
  assert.ok(metrics.availableExchangeHomes >= 1);
  assert.ok(metrics.exchangeSupplyByCity.some(row => row.city === city && row.homes === 1));
  assert.equal(typeof metrics.exchangeInquiriesWithReplyLast7Days, "number");
});


test("parallel refresh requests consume a token exactly once in Postgres", async () => {
  const registered = await authFetch("/register", {
    method: "POST", headers: { "X-Forwarded-For": "192.0.2.99" }, body: JSON.stringify({ userName: `parallel${runId}`, email: `parallel-${runId}@example.com`, password: "password123" }),
  });
  assert.equal(registered.status, 200);
  const cookie = registered.headers.getSetCookie().find(value => value.startsWith("refreshToken=")).split(";")[0];
  const results = await Promise.all(Array.from({ length: 8 }, () => authFetch("/refresh", { method: "POST", headers: { Cookie: cookie } })));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 401).length, 7);
});

test("chat without provider configuration returns a structured availability error", async () => {
  const result = await fetch(`${services.domixServerUrl}/api/Chat/stream`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history: [{ role: "user", text: "Hello" }] }),
  });
  assert.equal(result.status, 401);
  const authenticated = await fetch(`${services.domixServerUrl}/api/Chat/stream`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({ history: [{ role: "user", text: "Hello" }], privacyAccepted: true, isAdult: true }),
  });
  assert.equal(authenticated.status, 503);
  assert.equal((await authenticated.json()).code, "CHAT_UNAVAILABLE");
});

test("parallel ratings are exact and repeated votes update rather than duplicate", async () => {
  const apartmentId = '66777777-7777-7777-7777-777777777777';
  await testQuery(POSTGRES_URL, `INSERT INTO "Apartments" ("ApartmentId","UserId","Status","IsAnonymous",price,city,date,area,address,description,"ViewsCount","dateInsert","Rating","RatingCount","ListingType","IsDeleted","RatingSum","RecordedRatingCount") VALUES ($1,$2,0,false,5000.90,'Test',now(),'Center','Street','',0,now(),4,9,'Rent',false,0,0)`, [apartmentId, adminUserId]);
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const res = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${110+i}` }, body: JSON.stringify({ userName: `rating${runId}_${i}`, email: `rating${runId}_${i}@example.com`, password: 'password123' }) });
    assert.equal(res.status, 200); sessions.push(await res.json());
  }
  const rate = (session, score) => fetch(`${services.domixServerUrl}/api/Apartment/${apartmentId}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ score }) });
  const results = await Promise.all(sessions.map((session, i) => rate(session, [5,4,5][i])));
  for (const result of results) assert.equal(result.status, 200);
  const listing = await fetch(`${services.domixServerUrl}/api/Apartment/${apartmentId}`, { headers: { Authorization: `Bearer ${adminAccessToken}` } }).then(r => r.json());
  assert.equal(listing.ratingCount, 3); assert.ok(Math.abs(listing.rating - 14/3) < 1e-9);
  assert.equal(listing.legacyRating, 4); assert.equal(listing.legacyRatingCount, 9); assert.equal(listing.price, 5000.90);
  const repeat = await Promise.all(Array.from({ length: 4 }, () => rate(sessions[0], 3)));
  for (const result of repeat) assert.equal(result.status, 200);
  const rows = (await testQuery(POSTGRES_URL, 'SELECT "RatingSum","RecordedRatingCount" FROM "Apartments" WHERE "ApartmentId"=$1', [apartmentId])).rows[0];
  assert.equal(Number(rows.RatingSum), 12); assert.equal(rows.RecordedRatingCount, 3);
  assert.equal(Number((await testQuery(POSTGRES_URL, 'SELECT count(*) AS n FROM "ApartmentRatings" WHERE "ApartmentId"=$1', [apartmentId])).rows[0].n), 3);
});

test("registration with a case-variant email cannot create a second identity", async () => {
  const res = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.125' }, body: JSON.stringify({ userName: `case${runId}`, email: `FLOW-${runId}@EXAMPLE.COM`, password: 'password123' }) });
  assert.equal(res.status, 400); assert.equal((await res.json()).code, 'EMAIL_EXISTS');
});

test("account deletion revokes API access while preserving the recipient's history", async () => {
  const registered = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.140' }, body: JSON.stringify({ userName: `delete${runId}`, email: `delete${runId}@example.com`, password: 'password123' }) });
  assert.equal(registered.status, 200);
  const session = await registered.json();
  const homeId = '88777777-7777-7777-7777-777777777777';
  const messageId = '99777777-7777-7777-7777-777777777777';
  await testQuery(POSTGRES_URL, `INSERT INTO "Apartments" ("ApartmentId","UserId","Status","IsAnonymous",price,city,date,area,address,description,"ViewsCount","dateInsert","Rating","RatingCount","ListingType","IsDeleted","RatingSum","RecordedRatingCount") VALUES ($1,$2,0,false,5000,'Test',now(),'Center','Street','',0,now(),0,0,'Rent',false,0,0)`, [homeId, session.user.userId]);
  await testQuery(POSTGRES_URL, `INSERT INTO "Messages" ("MessageId","SenderId","OwnerId","ApartmentId","Content","CreatedAt","IsRead","IsDeleted","IsArchived") VALUES ($1,$2,$3,$4,'Retained history',now(),false,false,false)`, [messageId, session.user.userId, adminUserId, homeId]);
  const deleted = await fetch(`${services.domixServerUrl}/api/User/${session.user.userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(deleted.status, 204);
  const access = await fetch(`${services.domixServerUrl}/api/Apartment/all`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  assert.equal(access.status, 401);
  const history = (await testQuery(POSTGRES_URL, 'SELECT "Content","SenderId" FROM "Messages" WHERE "MessageId"=$1', [messageId])).rows;
  assert.equal(history.length, 1); assert.equal(history[0].Content, 'Retained history');
  const listing = await fetch(`${services.domixServerUrl}/api/Apartment/${homeId}`, { headers: { Authorization: `Bearer ${adminAccessToken}` } });
  assert.equal(listing.status, 404);
  const account = (await testQuery(POSTGRES_URL, 'SELECT "IsDeleted","EmailAddress","PasswordHash" FROM "Users" WHERE "UserId"=$1', [session.user.userId])).rows[0];
  assert.equal(account.IsDeleted, true); assert.equal(account.EmailAddress, null); assert.equal(account.PasswordHash, null);
});

test("privacy boundaries protect anonymous listings, contacts, exports and support copies", async () => {
  const registration = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.200' },
    body: JSON.stringify({ userName: `privacy${runId}`, email: `privacy-${runId}@example.com`, password: 'password123' }) });
  assert.equal(registration.status, 200);
  const session = await registration.json();
  const request = (path, token, method = 'GET', body) => fetch(`${services.domixServerUrl}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined,
  });
  const created = await request('/Apartment', adminAccessToken, 'POST', { city: 'Privacy city', area: 'Center', address: 'Secret street 81', price: 1234.56, listingType: 'Rent', isAnonymous: true });
  assert.equal(created.status, 200); const own = await created.json();
  assert.equal(own.userId, adminUserId);
  const viewed = await request(`/Apartment/${own.apartmentId}`, session.accessToken);
  const listing = await viewed.json(); assert.equal(listing.userId, '00000000-0000-0000-0000-000000000000');
  assert.equal(listing.address, 'Center'); assert.equal(listing.latitude, null); assert.equal(listing.longitude, null);
  assert.equal((await request(`/User/by-id/${adminUserId}`, session.accessToken)).status, 403);
  assert.equal((await request(`/privacy/listing-contact/${own.apartmentId}`, session.accessToken)).status, 404);
  const filtered = await (await request(`/Apartment/Search?ownerId=${adminUserId}`, session.accessToken)).json();
  assert.equal(filtered.some(a => a.apartmentId === own.apartmentId), false);
  const preview = await fetch(`${services.domixServerUrl}/api/Apartment/${own.apartmentId}/og`);
  assert.equal(preview.status, 200); const html = await preview.text(); assert.equal(html.includes('Secret street 81'), false); assert.equal(html.includes('og:image'), false);
  const inquiry = await request('/Message', session.accessToken, 'POST', { apartmentId: own.apartmentId, content: 'Private inquiry' });
  assert.equal(inquiry.status, 200);
  const stored = await testQuery(POSTGRES_URL, 'SELECT "OwnerId" FROM "Messages" WHERE "MessageId"=$1', [(await inquiry.json()).messageId]);
  assert.equal(stored.rows[0].OwnerId, adminUserId);
  const ticket = await request('/Support', session.accessToken, 'POST', { message: 'Private support', contactEmail: 'copy@example.com', transcript: [{ role: 'user', text: 'Do not attach this' }] });
  assert.equal(ticket.status, 200); const support = await ticket.json(); assert.equal(support.transcript, null);
  const exported = await request('/privacy/export', session.accessToken); assert.equal(exported.status, 200);
  const exportText = await exported.text(); assert.equal(exportText.includes('passwordHash'), false); assert.equal(exportText.includes('secret-google-id'), false);
  assert.equal(exportText.includes('Private support'), true);
  const deleted = await request(`/User/${session.user.userId}`, session.accessToken, 'DELETE'); assert.equal(deleted.status, 204);
  assert.equal((await request('/privacy/export', session.accessToken)).status, 401);
  const scrubbed = (await testQuery(POSTGRES_URL, 'SELECT "ContactEmail","Transcript","Message" FROM "SupportTickets" WHERE "SupportTicketId"=$1', [support.supportTicketId])).rows[0];
  assert.equal(scrubbed.ContactEmail, null); assert.equal(scrubbed.Transcript, null); assert.equal(scrubbed.Message.includes('Private support'), false);
});

test('notification cleanup is personal, monotonic and preserves newer announcements', async () => {
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const response = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${220 + i}` },
      body: JSON.stringify({ userName: `notice${i}${runId}`, email: `notice-${i}-${runId}@example.com`, password: 'password123' }) });
    assert.equal(response.status, 200); sessions.push(await response.json());
  }
  const { randomUUID } = await import('node:crypto');
  const oldId = randomUUID(), newId = randomUUID();
  await testQuery(POSTGRES_URL, 'INSERT INTO "Notifications" ("NotificationId","Title","Message","CreatedAt","CreatedByUserId") VALUES ($1,$2,$3,$4,$5)',
    [oldId, 'Old notice', 'Previous notice', '2025-01-01T00:00:00Z', adminUserId]);
  const request = (path, session, body) => fetch(`${services.domixServerUrl}/api/Notification${path}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` }, body: body ? JSON.stringify(body) : undefined
  });
  assert.equal((await request('/dismiss', sessions[0], { through: '2025-01-01T00:00:00Z' })).status, 204);
  assert.equal((await request('/dismiss', sessions[0], { through: '2024-01-01T00:00:00Z' })).status, 204);
  await testQuery(POSTGRES_URL, 'INSERT INTO "Notifications" ("NotificationId","Title","Message","CreatedAt","CreatedByUserId") VALUES ($1,$2,$3,$4,$5)',
    [newId, 'New notice', 'Newer notice', '2026-01-01T00:00:00Z', adminUserId]);
  const own = await (await request('', sessions[0])).json(); const other = await (await request('', sessions[1])).json();
  assert.equal(own.notifications.some(n => n.notificationId === oldId), false);
  assert.equal(own.notifications.some(n => n.notificationId === newId), true);
  assert.equal(other.notifications.some(n => n.notificationId === oldId), true);
  assert.equal((await request('/dismiss', sessions[0], { through: '2099-01-01T00:00:00Z' })).status, 400);
  assert.equal((await testQuery(POSTGRES_URL, 'SELECT COUNT(*)::int AS count FROM "Notifications" WHERE "NotificationId"=$1', [oldId])).rows[0].count, 1);
});

test('verification resend reports unavailable delivery instead of claiming sent', async () => {
  const registered = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.229' },
    body: JSON.stringify({ userName: `mailfailure${runId}`, email: `mailfailure-${runId}@example.com`, password: 'password123' }) });
  assert.equal(registered.status, 200); const session = await registered.json();
  const resend = await authFetch('/resend-verification', { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` }, body: '{}' });
  assert.equal(resend.status, 503); const result = await resend.json();
  assert.equal(result.code, 'EMAIL_SEND_FAILED'); assert.notEqual(result.sent, true);
});

test('message email choice is self-scoped and unread count belongs only to the recipient', async () => {
  const sessions = [];
  for (let i = 0; i < 2; i++) {
    const response = await authFetch('/register', { method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${230+i}` },
      body: JSON.stringify({ userName: `msgpref${i}${runId}`, email: `msgpref-${i}-${runId}@example.com`, password: 'password123' }) });
    assert.equal(response.status, 200); sessions.push(await response.json());
  }
  const request = (path, session, method = 'GET', body) => fetch(`${services.domixServerUrl}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` }, body: body ? JSON.stringify(body) : undefined
  });
  assert.equal((await (await request('/privacy/message-preferences', sessions[0])).json()).receiveMessageEmails, true);
  assert.equal((await request('/privacy/message-preferences', sessions[0], 'PATCH', { receiveMessageEmails: false, userId: sessions[1].user.userId })).status, 204);
  assert.equal((await (await request('/privacy/message-preferences', sessions[0])).json()).receiveMessageEmails, false);
  assert.equal((await (await request('/privacy/message-preferences', sessions[1])).json()).receiveMessageEmails, true);
  async function realtime(session) {
    const negotiation = await fetch(`${services.domixServerUrl}/api/hubs/presence/negotiate?negotiateVersion=1`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` } });
    assert.equal(negotiation.status, 200); const info = await negotiation.json();
    const socket = new WebSocket(`${services.domixServerUrl.replace('http:', 'ws:')}/api/hubs/presence?id=${encodeURIComponent(info.connectionToken)}&access_token=${encodeURIComponent(session.accessToken)}`);
    const events = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('Realtime handshake did not complete')); }, 5000);
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Realtime connection failed')); });
      socket.addEventListener('open', () => socket.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e'));
      socket.addEventListener('message', event => {
        for (const part of String(event.data).split('\x1e').filter(Boolean)) {
          const frame = JSON.parse(part);
          if (!frame.type) socket.send(JSON.stringify({ type: 1, invocationId: 'ready', target: 'GetActiveUserCount', arguments: [] }) + '\x1e');
          if (frame.type === 3 && frame.invocationId === 'ready') { clearTimeout(timer); resolve(); }
          if (frame.type === 1) events.push(frame);
        }
      });
    });
    return { socket, events };
  }
  const recipientLive = await realtime(sessions[0]), senderLive = await realtime(sessions[1]);
  let sent;
  try {
    sent = await request('/Message', sessions[1], 'POST', { ownerId: sessions[0].user.userId, content: 'A private message with email opted out' });
    assert.equal(sent.status, 200);
    const deadline = Date.now() + 3000;
    while (!recipientLive.events.some(e => e.target === 'MessageReceived') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    const event = recipientLive.events.find(e => e.target === 'MessageReceived');
    assert.ok(event); assert.equal(typeof event.arguments[0].messageId, 'string');
    assert.deepEqual(Object.keys(event.arguments[0]), ['messageId']);
    assert.equal(senderLive.events.some(e => e.target === 'MessageReceived'), false);
  } finally { recipientLive.socket.close(); senderLive.socket.close(); }

  assert.equal(sent.status, 200);
  assert.equal((await (await request('/Message/unread-count', sessions[0])).json()).count, 1);
  assert.equal((await (await request('/Message/unread-count', sessions[1])).json()).count, 0);
  const delivery = await testQuery(POSTGRES_URL, 'SELECT COUNT(*)::int AS count FROM "EmailDeliveries" WHERE "Recipient"=$1', [`msgpref-0-${runId}@example.com`]);
  // The initial verification attempt is recorded; sending the private message adds no email attempt.
  assert.equal(delivery.rows[0].count, 1);
});
