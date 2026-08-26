Quick frontend scaffold notes

- Entry: `src/main.tsx`
- App root / routes: `src/App.tsx`
- API clients: `src/api/http.ts` (`authClient`, `dataClient`), per-resource modules alongside it (`auth.api.ts`, `users.api.ts`, `apartments.api.ts`, `messages.api.ts`, `images.api.ts`, `ops.api.ts`)
- Auth/session state: `src/stores/auth.store.ts` (zustand)
- Access token storage: `src/api/tokenStore.ts` (in-memory only; the refresh token lives in an httpOnly cookie)
- i18n: `src/i18n/index.ts` (en/he/es/fr)
- React Query hooks: `src/hooks/*`
- Feature UI: `src/features/*`

Install dependencies:

```bash
cd domix-client
npm install
```

Dev:

```bash
npm run dev
```

Checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run build
```
