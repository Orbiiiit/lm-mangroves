# Project documentation: Mangroves Gwada

State as of 6 Oct 2026. Design reference: `Mangroves Guadeloupe (Detail landing v12).dc.html`. Rules for building: `CLAUDE.md`, `docs/design-system.md`, `docs/components.md`.

## 1. What this is

**Working mode:** all further work happens in Claude Code, working from the documentation in this project. Stack and hosting are not decided yet (see §6): until they are, keep the data exactly as it is in `data/mangroves-db.json` and the prototype; Airtable will be connected later, as a second step, from the CSV mirror in `airtable/`.

An independent, French-language directory of the mangroves of Guadeloupe (21 sites in the data, 19 shown). It helps visitors choose a site, understand how to reach it and whether to go alone or with a guide, and then book one of two partner guided tours. It earns trust through sourced, dated, practical facts, and converts through direct bookings with partners.

- **Partners (operators):** Yalodé (guide Pascal Proust, kayak, Vieux-Bourg, Morne-à-l'Eau; adult 38 €, child 22 € non-rowing; open from age 3) and Blue Lagoon (guide Jean-Eudes, boat, Sainte-Rose; about 52 €). Prices were read in September 2026 and must stay dated.
- **Site owners:** the two guides present the site as "Nous, c'est Pascal et Jean-Eudes".
- **Audience:** visitors and residents planning an outing, many with children; searchers on long-tail French queries (site + activity + commune) and AI assistants.
- **Tone:** factual, warm, no hype; no invented reviews or ratings.
- **Not a booking engine:** it links out (UTM-tagged) to partner booking pages.

## 2. Views and routes

The design uses hash routes; the build uses the real URLs below. Built: `/`, `/mangrove/<slug>`, `/ile/<slug>`, `/commune/<slug>`, `/activite/<slug>`, `/guides/<slug>`, `/idees`, `/idees/<slug>`, `/comparatif`, plus `/robots.txt`, `/sitemap.xml`, `/llms.txt` and a 404. Not built: `/confidentialite` (legal text pending, OPEN_LOOPS OL-10). New page types must be added to `BUILT_ROUTES` (`src/lib/format.ts`) and to `src/pages/sitemap.xml.ts`.

| View | Design route | Template | Notes |
|---|---|---|---|
| Directory (home) | `#/` | DirectoryTemplate | hero, filter bar, safety alert, results (grid/list), lead capture, "Qui sommes-nous" |
| Site detail | `#/mangrove/<slug>` | SiteDetailTemplate | 21 sites; with 0, 1 or 2 guides |
| Article (SEO page) | `#/guide/<slug>` in the prototype; **production: `/idees/<slug>`** | ArticleTemplate | 5 topic pages (e.g. `mangrove-guadeloupe-en-famille`). An article is not tied to a guide (person); it is editorial content |
| Ideas index | `#/idees` (production `/idees`) | IdeasTemplate | lists the articles |
| Listing by island / commune / activity | `#/ile/<slug>`, `#/commune/<slug>`, `#/activite/<slug>` | ListingTemplate | `activite/sortie-guidee` lists guided sites |
| Guide profile | `#/guide-pascal`, `#/guide-jean-eudes` (production `/guides/pascal`, `/guides/jean-eudes`) | ProfileTemplate | |
| Comparison boat vs kayak | `#/comparatif` | CompareTemplate | still on v8 styles, to rebuild |
| Privacy | `#/confidentialite` | ProseTemplate | text needs legal review |

### Detail page section order (current)
1. Hero (type badge, alert dot, H1, commune · island, tagline, photo credit, carousel). 2. FactStrip (Visite, Difficulté, Durée, Enfants) + "Y aller avec un guide" tile when guided. 3. **Aperçu** (`#essentiel`: signature, intro, tip, "Bon à savoir", site alert). 4. Photos (grouped: site / with guide / on site). 5. **Accès** (`#acces`: how to get there, "Par vos propres moyens", "Avec un guide", Maps icon). 6. **Sécurité** (`#preparer`, `#regles`: Parc rules, risks, bag, folded disclaimer; no-guide notice). 7. **Sortie guidée** (`#visiter`: one `GuidedTourCard` per operator). 8. Réseaux sociaux. 9. Ils en parlent (folded). 10. FAQ. 11. À proximité. 12. Explorer aussi. 13. Sources et fil d'Ariane. 14. Qui sommes-nous. Guide card: sticky column from 1180 px; below, a sticky bottom bar after Aperçu.

The first answer in Aperçu (where, how to visit, duration, price, minimum age) doubles as meta description and JSON-LD `description`. Duplicated facts (commune, duration, price, directions) are intentional only where noted in `docs/archive/detail-page.md` ("Intentional repetitions").

## 3. Data

- **Source of truth for sites:** `data/mangroves-db.json` (schema + 21 sites; fields: slug, name, island, commune, zone, activities, difficulty, duration, distanceKm, access, kidFriendly, birdwatching, photogenic, pmr, protection, servedBy, gps, confidence, facts, sources, images, blurb, paragraphs; plus `rejected`, `sourceHierarchy`, `imageSources`, `publishRule`). Publishing: only `Status = Publié` and confidence not "à vérifier".
- **Airtable mirror (future):** `airtable/` has 17 CSV tables (Sites, Images, Sources, Operators, Operator Features/Practical, Reviews, **Articles, Article Sections, Article FAQ** (renamed from Guides*), Compare Rows, Tips, Hero Palettes, Islands, Site Copy, Reference Sources, Rejected Sites). Import steps and editing rules: `airtable/README.md`. Never rename a slug/key/ID once published.
- **Content moved out of the design file's logic class** into `data/content/`: `V9` → `site-content.json` (with `estimated` fields), `OPERATORS` + `OP_ABOUT` → `operators.json`, `FILTER_PAGES` + `ARTICLE` + `WHY_TILES` → `articles.json`, compare view → `compare.json`, `VIDEOS`, `SOCIAL`, `RISK`. Still in the prototype: `TIPS`, `PRIVACY` (legal review pending). `HERO_PALETTES` is a dev tool, not migrated. Airtable columns to add are listed in `docs/archive/alignment-review-and-plan.md` D1.
- **Images:** all hotlinked from third-party sites, credited and licensed per image (`imageMeta`); full source table in `docs/image-sources.md`. Guide portraits are `randomuser.me` placeholders to replace.

## 4. Content status

| Status | Item |
|---|---|
| Verified from sources | Site facts flagged `confidence = vérifié` |
| **Estimated, show with CautionNote or confirm** | "5 à 7,5 km" Rivière Salée channel width; "8 000 ha" mangrove area (Zones humides and Made in Guadeloupe sources); drive times from Pointe-à-Pitre, parking, Taonaba bus line; Taonaba name story; Blue Lagoon included/bring lists; risks and "Dans le sac" by visit type |
| Needs guide approval | Tips signed Pascal or Jean-Eudes, tour quotes, "Pourquoi y aller avec…", Jean-Eudes's full name, bio, "Depuis 2010", authorised-operator wording; confirm Yalodé's Parc national status and the "sans frais ajoutés" claim |
| Missing | Real social posts per site; real guide photos; Parc national photo permissions (29 images kept provisionally, "tous droits réservés", see `docs/image-sources.md`); Désirade content; English version; zone pages |

## 5. Interface decisions already taken (do not reopen without asking)

Bold only for alerts and values (now: two weights); one loud element per block; colours by role; corners 8 / 14 / full; no emoji; double divider lines removed (single top rule per section); "En famille" toggle in the filter bar; Maps link as icon beside "Par vos propres moyens"; disclaimers folded; mobile menu is an icon-only button; mobile filter bar is one line with a sheet; lead capture stacked with a subtle channel toggle; the quote card (large italic, faint opening mark, thin divider above author); "Y aller seul.e ou avec un guide ?" heading wording; guide-card sticky column only from 1180 px.

## 6. Stack, data flow and lead-capture intent

- **Stack and hosting: decided (7 Oct 2026).** Astro with static output, hosted on Cloudflare Pages. Every route is a real URL with complete HTML (title, meta, canonical, JSON-LD) without JavaScript.
- **Data flow (27 Oct 2026):** Airtable is the editing source (base built from `airtable/tables.ts`, the generic directory base of rivieres-canyons). The Deploy workflow pulls it into `data/` (nightly, on demand, or from an Airtable automation), checks it and deploys; the site reads only `data/` through `src/lib/data.ts`. Spec: `airtable/SPEC.md`.
- **Lead capture (intent only, nothing implemented):** the home page offers a one-time "top 5 des journées en mangrove" by SMS or e-mail, with a consent line and a link to the privacy page. Purpose: build an audience for direct partner bookings. Not wired: no provider, storage, consent logging or double opt-in yet; the form must not claim to send anything until it does. Needs a provider choice, GDPR-compliant consent wording and a legal-reviewed privacy page before launch.
- **Fonts:** Google Fonts (Spectral 600 + 400 italic, Work Sans 400 + 600, `display=swap`, preconnect); both are SIL Open Font License 1.1.

### SEO and technical requirements for the production build

From `docs/seo-audit-detail-page.md` (still valid; implementation not started):
- Real URLs per page (no hash routing); server-rendered or statically generated HTML so title, meta, canonical and JSON-LD exist without JavaScript (AI crawlers do not run JS).
- JSON-LD: TouristAttraction (+ `containedInPlace`, images with credit/licence, `dateModified`), TouristTrip + Offer + LocalBusiness when a guide serves the site, FAQPage, BreadcrumbList, Article (author, dateModified) on articles. No self-serving star-rating markup.
- FAQ answers site-specific; questions without data are omitted. `<details>` content stays in the DOM.
- Title pattern `{Site} ({Commune}) : {mode}, infos pratiques`; meta description = the opening answer (≤ 155 characters).
- Operator links: `utm_source=mangroves-gwada&utm_medium={placement}&utm_campaign={slug}`.
- `hreflang` ready for English (not started).
- Monitoring after launch: rankings and citations.

## 7. Glossary (use these words in code, data and copy)

| Term | Meaning | Not |
|---|---|---|
| **Site** | One mangrove location (the 21 records) | "destination" |
| **Zone** | Group of sites (Grand Cul-de-Sac Marin…) | |
| **Operator** | The business: Yalodé, Blue Lagoon | |
| **Guide** | The person: Pascal, Jean-Eudes | an article |
| **Tour** | A guided outing ("sortie guidée") sold by an operator | |
| **Article** | An SEO topic page (`/idees/<slug>` in production; Airtable table "Articles") | "guide" |
| **Listing** | A filtered list page (island, commune, activity) | |
| **Idea** | An outing suggestion inside an article (numbered pick) | |

## 8. File map

| Path | Role |
|---|---|
| `CLAUDE.md` | Entry point for Claude Code |
| `docs/design-system.md`, `docs/components.md` | Rules and catalogue |
| `docs/review-final.md` | Review, judgment calls, conformance backlog |
| `docs/seo-audit-detail-page.md` | SEO audit (findings still open) |
| `design-system/tokens.css`, `typography.css` | Tokens and text styles |
| `data/mangroves-db.json`, `airtable/` | Content |
| `Mangroves Guadeloupe (Detail landing v12).dc.html` | Current design (visual reference, monolith) |
| `Guide Offer Card.dc.html` | Guide card component (design) |
| `src/` | Astro build: `lib/` (data layer and page models, the only readers of `data/`), `components/{atoms,molecules,organisms}/`, `templates/`, `pages/` |
| `data/content/` | Content moved out of the prototype's logic class: operators, per-site editorial (`site-content.json`, with `estimated` fields), vocabularies, social, videos, article and listing index |

## 9. Open items

Moved to `OPEN_LOOPS.md` (repo root), the single tracker for deferred work and pending decisions.
