# Integration tests

Exercises the real chain — `auth-server` → `domix-server` → Postgres — with no mocking:
both services are spawned as real child processes and talk to each other over real HTTP,
against a real database. Unit tests in each service can't catch a bug in how the services
connect to each other; this is what's for that (see `b9a1a0b` for the bug it would have caught).

## Running locally

Requires a reachable Postgres with an existing (can be empty) database — `domix-server`
applies its EF Core migrations on startup.

```bash
# from the repo root
createdb domix_integration_test  # or point INTEGRATION_TEST_POSTGRES_URL at any existing DB

cd auth-server && npm install && cd ..
cd integration-tests
INTEGRATION_TEST_POSTGRES_URL="Host=localhost;Port=5432;Database=domix_integration_test;Username=postgres;Password=postgres" \
  npm test
```

`domix-server` and `auth-server` are started on fixed ports (18080 / 15000) to avoid clashing
with a `domix-server`/`auth-server` you might already have running locally for manual testing.
