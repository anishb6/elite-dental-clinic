# Contributor / agent notes

- Read `docs/ARCHITECTURE.md` first; follow its layering and naming conventions.
- Routes stay thin — put logic in `src/features/<name>/`.
- Clinic facts (phone, hours, address) live only in `src/config/site.ts`. Testimonials live in `features/clinic/data/reviews.ts` and are shared by Home and Reviews.
- Photos are files in `public/`, referenced only through `features/clinic/data/photos.ts`.
- Canonical URLs, the sitemap and robots.txt all derive from `INDEXABLE_PATHS` + `VITE_SITE_URL` (`src/config/env.public.ts`). New public page → add to `INDEXABLE_PATHS`. Never name a module that is read during SSR `*.client.ts`.
- Secrets: read via `src/config/env.server.ts` only, from `*.server.ts` modules. No other file touches `process.env` / `import.meta.env`.
- Browser-called API paths live in `src/api/endpoints.ts`; browser HTTP goes through `apiRequest` (`src/api/http-client.ts`). Failures are `AppError`s - show `getUserMessage(e)`, branch on `getErrorStatus(e)`; never leave a `catch` empty.
- Server handlers get the service-role client from `getAdminClient()` (`src/server/services/database.server.ts`) and guard internal endpoints with `requireNotifySecret()`; don't re-implement either.
- File names are kebab-case. Dead code gets deleted, not commented out or kept "for compatibility".
- Never edit `src/routeTree.gen.ts` or `src/integrations/supabase/*`.
- Before finishing: `npm run typecheck && npm run lint && npm test` (npm is the only package manager; `package-lock.json` is the only lockfile).
