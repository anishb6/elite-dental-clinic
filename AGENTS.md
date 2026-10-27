# Contributor / agent notes

- Read `docs/ARCHITECTURE.md` first; follow its layering and naming conventions.
- Routes stay thin — put logic in `src/features/<name>/`.
- Clinic facts (phone, hours, address) live only in `src/config/site.ts`. Testimonials live in `features/clinic/data/reviews.ts` and are shared by Home and Reviews.
- Photos are files in `public/`, referenced only through `features/clinic/data/photos.ts`.
- Canonical URLs, the sitemap and robots.txt all derive from `INDEXABLE_PATHS` + `VITE_SITE_URL` (`src/config/env.public.ts`). New public page → add to `INDEXABLE_PATHS`. Never name a module that is read during SSR `*.client.ts`.
- Secrets: read via `src/config/env.server.ts` only, from `*.server.ts` modules.
- Never edit `src/routeTree.gen.ts` or `src/integrations/supabase/*`.
- Before finishing: `npm run typecheck && npm run lint && npm test` (npm is the only package manager; `package-lock.json` is the only lockfile).
