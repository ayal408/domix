import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';
import { parseDotNetConnectionString } from '../helpers/db.js';

const url = process.env.INTEGRATION_TEST_POSTGRES_URL || 'Host=localhost;Port=5432;Database=domix_integration_test;Username=postgres;Password=postgres';
const sql = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const owner = '11111111-1111-1111-1111-111111111111';
const home = '22222222-2222-2222-2222-222222222222';
async function fixture(run) {
  const client = new pg.Client(parseDotNetConnectionString(url)); await client.connect();
  const schema = 'migration_fixture_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await run(client);
  } finally {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}
async function legacyUser(c, id = owner, email = 'Case@Example.com', name = 'Owner') {
  await c.query(`INSERT INTO "Users" ("UserId","UserName","RegistrationMethod","EmailAddress","Role","JoiningDate","IsEmailVerified","IsBlocked","LanguagePreference") VALUES ($1,$2,'Password',$3,'User',now(),false,false,'he')`, [id, name, email]);
}
async function legacyHome(c) {
  await c.query(`INSERT INTO "Apartments" ("ApartmentId","UserId","Status","IsAnonymous",price,city,date,area,address,description,"ViewsCount","dateInsert","Rating","RatingCount","ListingType") VALUES ($1,$2,0,false,5000,'Test',now(),'Center','Street','',0,now(),4,9,'Rent')`, [home, owner]);
}
test('exported complete migration SQL executes and database enforces new writes', async () => fixture(async c => {
  await c.query(sql('schema-all.sql'));
  const expectedMigrations = readdirSync(new URL('../../domix-server/ApartmentAPI/Migrations/', import.meta.url))
    .filter(name => /^\d{14}_.+\.cs$/.test(name) && !name.endsWith('.Designer.cs'))
    .map(name => name.slice(0, -3)).sort();
  const applied = (await c.query('SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId"')).rows.map(row => row.MigrationId);
  assert.deepEqual(applied, expectedMigrations);
  await legacyUser(c); await legacyHome(c);
  if ((await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Users' AND column_name='SharePhone'`)).rows.length) assert.equal((await c.query('SELECT "SharePhone" FROM "Users"')).rows[0].SharePhone, false);
  await assert.rejects(c.query('UPDATE "Apartments" SET price=-1 WHERE "ApartmentId"=$1', [home]), e => e.code === '23514');
  await assert.rejects(c.query('UPDATE "Apartments" SET "Status"=999 WHERE "ApartmentId"=$1', [home]), e => e.code === '23514');
  await assert.rejects(legacyUser(c, '33333333-3333-3333-3333-333333333333', 'case@example.com', 'Other'), e => e.code === '23505');
  await c.query('UPDATE "Apartments" SET price=5000.90 WHERE "ApartmentId"=$1', [home]);
  assert.equal(Number((await c.query('SELECT price FROM "Apartments" WHERE "ApartmentId"=$1', [home])).rows[0].price), 5000.9);
}));
test('upgrade preserves legacy ratings and orphan references without deleting records', async () => fixture(async c => {
  await c.query(sql('schema-before.sql')); await legacyUser(c); await legacyHome(c);
  // Historical invalid data must remain recoverable and archivable without inventing a new price.
  await c.query('UPDATE "Apartments" SET price=-5 WHERE "ApartmentId"=$1', [home]);
  await c.query(`INSERT INTO "Messages" ("MessageId","SenderId","OwnerId","ApartmentId","Content","CreatedAt","IsRead","IsDeleted","IsArchived") VALUES ('44444444-4444-4444-4444-444444444444',$1,$1,'99999999-9999-9999-9999-999999999999','Legacy message',now(),false,false,false)`, [owner]);
  await legacyUser(c, '33333333-3333-3333-3333-333333333333', 'buyer@example.com', 'Buyer');
  await c.query('UPDATE "Apartments" SET "IsAnonymous"=TRUE WHERE "ApartmentId"=$1', [home]);
  await c.query(`INSERT INTO "Messages" ("MessageId","SenderId","OwnerId","ApartmentId","Content","CreatedAt","IsRead","IsDeleted","IsArchived") VALUES ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333',$1,$2,'Anonymous legacy inquiry',now(),false,false,false)`, [owner, home]);
  await c.query(sql('schema-upgrade.sql'));
  const privacy = (await c.query(`SELECT "SenderIsAnonymous","RecipientIsAnonymous","Content" FROM "Messages" WHERE "MessageId"='66666666-6666-6666-6666-666666666666'`)).rows[0];
  assert.equal(privacy.SenderIsAnonymous, false); assert.equal(privacy.RecipientIsAnonymous, true); assert.equal(privacy.Content, 'Anonymous legacy inquiry');
  const conversation=(await c.query(`SELECT "ConversationId" FROM "Messages" WHERE "MessageId"='66666666-6666-6666-6666-666666666666'`)).rows[0].ConversationId;
  const {createHash}=await import('node:crypto');const key=createHash('md5').update([owner,'33333333-3333-3333-3333-333333333333'].sort().join(':')+':'+home).digest('hex');
  assert.equal(conversation.replaceAll('-',''),key);

  const a = (await c.query('SELECT * FROM "Apartments" WHERE "ApartmentId"=$1', [home])).rows[0];
  assert.equal(Number(a.price), -5);
  await c.query('UPDATE "Apartments" SET "IsDeleted"=TRUE WHERE "ApartmentId"=$1', [home]);
  assert.equal(a.Rating, 4); assert.equal(a.RatingCount, 9); assert.equal(a.RecordedRatingCount, 0);
  assert.equal((await c.query(`SELECT * FROM "Messages" WHERE "MessageId"='44444444-4444-4444-4444-444444444444'`)).rows[0].ApartmentId, '99999999-9999-9999-9999-999999999999');
  assert.equal((await c.query('SELECT "NormalizedEmail" FROM "Users" WHERE "UserId"=$1', [owner])).rows[0].NormalizedEmail, 'case@example.com');
  await assert.rejects(c.query(`INSERT INTO "Messages" ("MessageId","SenderId","OwnerId","ApartmentId","Content","CreatedAt","IsRead","IsDeleted","IsArchived") VALUES ('55555555-5555-5555-5555-555555555555',$1,$1,'99999999-9999-9999-9999-999999999999','New orphan',now(),false,false,false)`, [owner]), e => e.code === '23503');
}));
test('conflicting normalized identities abort upgrade without changing or deleting accounts', async () => fixture(async c => {
  await c.query(sql('schema-before.sql'));
  await legacyUser(c); await legacyUser(c, '33333333-3333-3333-3333-333333333333', 'case@example.com', 'Other');
  await assert.rejects(c.query(sql('schema-upgrade.sql')), /DATABASE_INTEGRITY_EMAIL_COLLISIONS/);
  await c.query('ROLLBACK');
  assert.equal(Number((await c.query('SELECT count(*) AS n FROM "Users"')).rows[0].n), 2);
  assert.equal(Number((await c.query('SELECT count(*) AS n FROM "__EFMigrationsHistory"')).rows[0].n), 6);
  assert.equal((await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Users' AND column_name='NormalizedEmail'`)).rows.length, 0);
}));
