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
