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

## Deploy (Cloudflare Workers)

The Worker `mangroves` serves the static build at **https://mangrove-guadeloupe.fr** (custom domain attached in the Cloudflare dashboard). Workers Builds runs on every push: build command `npm run build`, deploy command `npx wrangler deploy` (config in `wrangler.jsonc`: assets from `dist`, our `404.html` for unknown URLs). Node 22 (`.node-version`).

- **`SITE_URL`** (build variable, Settings → Build → Variables): the production origin used by canonical URLs, the sitemap, `robots.txt`, `llms.txt`, Open Graph and JSON-LD. Without it, Workers Builds fall back to `https://mangrove-guadeloupe.fr` (`astro.config.mjs`).
- **`INDEXABLE=false`** hides a deployment from crawlers (pages get `noindex`, `robots.txt` disallows all). Pages are indexed by default.
- **`public/_headers`**: security headers and cache rules for every response.

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
