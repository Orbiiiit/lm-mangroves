# Mangroves Gwada

French-language directory of Guadeloupe's mangroves. Static site built with [Astro](https://astro.build), hosted on Cloudflare Pages.

Read `CLAUDE.md` first (rules), then `docs/`.

## Run it

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static HTML in dist/
npm run check     # type check
```

## Deploy (Cloudflare Pages, same setup as rivieres-canyons)

GitHub Actions builds and deploys; Cloudflare only hosts. No Worker.

- **Push to `main`** → `.github/workflows/deploy.yml`: `astro check`, build, `check-dist`, then `wrangler pages deploy dist` to the Pages project **`mangrove-guadeloupe`** (created by the workflow if missing), then a check of the live `pages.dev` address. **Other branches and pull requests** → `.github/workflows/checks.yml` (same checks, no deploy).
- **Repository secrets** (GitHub → Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` (custom token, `Account · Cloudflare Pages · Edit`) and `CLOUDFLARE_ACCOUNT_ID`. Without them the workflow runs the checks and says Cloudflare is not connected.
- **`SITE_URL`** (optional repository variable): the production origin for canonical URLs, sitemap, `robots.txt`, `llms.txt`, Open Graph and JSON-LD. Default in CI: `https://mangrove-guadeloupe.fr`; local builds use `localhost`.
- **Custom domain** `mangrove-guadeloupe.fr`: Pages project → Custom domains. `www` redirects to it with a zone Redirect Rule.
- **`public/_headers`**: `noindex` on every `*.pages.dev` address, security headers, cache rules. Pages serves `404.html` for unknown URLs.
- **`INDEXABLE=false`** (build env) hides a deployment from crawlers.

## Content (Airtable)

Airtable is where content is edited. The base « Mangroves Gwada — Contenu » follows the generic directory base of rivieres-canyons (15 tables, French columns); `airtable/SPEC.md` lists every table and column, `airtable/tables.ts` maps them onto `data/`.

- **Commands:** `npm run airtable:export` (writes `SPEC.md` and `airtable/csv/`, checks that data → Airtable → data is identical), `npm run content:pull` (base → `data/`, refused with the row and column named if anything is invalid), `airtable:build | reset | columns | verify | link`.
- **GitHub Actions → Airtable** (by hand): `build-new-base` (once, with the workspace ID), `verify-base`, `add-new-columns`, `reset-and-refill-base`, `pull-content`. Secret: `AIRTABLE_TOKEN` (personal access token, scopes `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, access to the workspace).
- **Publishing:** the Deploy workflow pulls the base every night (deploys only if something changed), on demand (Run workflow → `publish-content`), or when an Airtable automation sends `repository_dispatch` `airtable-publish`. The pulled `data/` is committed back to `main`.

## Layout

| Path | What |
|---|---|
| `design-system/` | Tokens and text styles (source of truth, imported as is) |
| `data/mangroves-db.json` | Sites (unchanged) |
| `data/content/` | Operators, per-site editorial content, vocabularies, social, articles, comparison |
| `src/lib/` | Data layer (`data.ts`, the only reader of `data/`) and page models |
| `src/components/` | Atoms, molecules, organisms (`docs/components.md`) |
| `src/templates/` | Page skeletons |
| `src/pages/` | Routes: `/`, `/mangrove/<slug>`, `/ile/`, `/commune/`, `/activite/<slug>`, `/guides/<slug>`, `/idees`, `/idees/<slug>`, `/comparatif`, `robots.txt`, `sitemap.xml`, `llms.txt`, 404 |
| `*.dc.html`, `support.js`, `image-slot.js` | Design reference from Claude Design (not shipped) |
