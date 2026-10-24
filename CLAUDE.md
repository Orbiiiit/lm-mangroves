# CLAUDE.md: Mangroves Gwada

Read this first, every session. Then read `docs/design-system.md` (rules) and keep `docs/components.md` (catalogue) and `design-system/tokens.css` + `typography.css` open when building UI. Project context: `docs/project.md`. Open questions and known gaps: `docs/review-final.md`.

## What you are building
A French-language directory of Guadeloupe's mangroves: browse and filter 21 sites, read a sourced detail page per site, optionally book one of two partner guided tours (Yalodé kayak, Blue Lagoon boat). Mobile is the primary experience (most visitors are on phones); desktop is an enhancement. SEO and AI-search citability are core requirements (real URLs, server-rendered HTML, JSON-LD).

## The design reference
`Mangroves Guadeloupe (Detail landing v12).dc.html` is the visual reference (a monolithic prototype with inline styles and hash routes) and `Guide Offer Card.dc.html` the guide card. Reproduce what they look like, but implement with tokens and the component catalogue, never by copying inline literals. Where the prototype disagrees with the docs, the docs win; the known differences are in `docs/review-final.md` §4. Older versions were removed from the project.

## Non-negotiable rules
1. **Tokens only.** Components use tier-2 tokens (`--color-text-secondary`, `--space-4`, `--radius-container`…) from `design-system/tokens.css`. Never write a raw hex/px/shadow/z-index/font value in a component. Never use `--palette-*` in a component.
2. **Text styles only.** Use the 11 `.text-*` styles. Never set font-size/weight/line-height/letter-spacing/text colour by hand.
3. **Do not invent.** No new token, text style, colour, size, radius, shadow or breakpoint without the user's approval. If something is missing: use the nearest existing one and list a "Proposed addition" (name, role, value, why) in your reply.
4. **Reuse before creating.** Search `docs/components.md`. Reuse with props → compose from existing molecules → only then create a new component at the lowest fitting atomic level. Register every new component in `docs/components.md` in the same change.
5. **Mobile first.** Base CSS at 360 px; enlarge with `@media (min-width: 600px | 880px | 1180px)` only. No `max-width` queries; no JS-driven layout.
6. **One loud thing per block**: one filled button per viewport; labels never bold; two font weights only (400, 600); italic only for `text-quote`.
7. **Targets ≥ 44 px**, inputs 16 px, visible `:focus-visible` ring, `lang="fr"`, alt text on photos, real heading order (one `h1`).
8. **Disclaimers and alerts are folded by default** (`<details>`). **Unverified facts get `CautionNote` ("à confirmer").**
9. **No emoji** in UI; SVG line icons with text labels or `aria-label`.
10. **Copy is French**, sentence case. Don't rewrite user-provided text. Don't invent facts, prices, reviews or ratings; prices carry their date.

## Naming (see `docs/design-system.md` §2 for the full table)
- **Name the role, never the look.** Not `DarkBand`, `PillButton`, `BigCard`, `coral`, `sand`, `HomeHero2`.
- Tokens: `--color-{text|surface|border|action|status|operator|overlay|social}-{role}`; ordinal scales `--space-1…8`, `--font-size-1…8`; shape `--radius-{control|container|full}`; elevation `--elevation-{overlap|bar|thumb}`.
- Components: PascalCase, variants as props (`<Button variant="primary">`), CSS in BEM (`.block__part--modifier`), state via `aria-*`/`data-state`.
- Folders: `components/atoms|molecules|organisms/{Name}/`, `templates/`, `pages/`. Atoms never contain atoms; a level uses only the levels below it; only pages fetch data.
- Domain words (`docs/project.md` §7): **site, zone, operator (business), guide (person), tour, article (SEO page), listing, idea**. Never call an article a "guide".

## Atomic order of work
tokens → text styles → atoms → molecules → organisms → templates → pages. Build and check each level before the next. Compose, don't duplicate.

## Restyling
The look must be changeable without renames: edit palette values or re-point semantic tokens; keep names and component APIs. Component-specific values are local tier-3 tokens built from tier-2 tokens.

## Definition of done for any UI change
- Uses only tokens and text styles; no stray literals (grep the diff).
- Works at 360, 375, 600, 880, 1180, 1440; no horizontal scroll.
- Focus, hover (pointer only), active, disabled states; keyboard reachable.
- Contrast: text 4.5:1 (3:1 ≥ 24 px), non-text 3:1.
- Component registered/updated in `docs/components.md`; deviations noted in your reply.

## Content and data
Sites live in `data/mangroves-db.json` (Airtable mirror in `airtable/`, rules in `airtable/README.md`). Editorial content moved out of the prototype lives in `data/content/` (operators, per-site content with `estimated` fields, vocabularies, articles, comparison). Only `src/lib/data.ts` reads `data/`. Slugs/keys are permanent. Only the tips (TIPS) and the privacy text (PRIVACY) are still in the prototype's logic class; move them into data before using them. Estimated figures are listed in `docs/project.md` §4; show them as unverified.

## Decided
- **Working mode:** all work continues in Claude Code from these docs.
- **Stack (decided 7 Oct 2026):** Astro, static output (one HTML file per route, JavaScript only for small interactions). Hosting (24 Oct 2026, aligned with rivieres-canyons): Cloudflare Pages project `mangrove-guadeloupe`, deployed by GitHub Actions on push to `main` (`.github/workflows/deploy.yml`, `wrangler.toml`), domain https://mangrove-guadeloupe.fr. No Worker. Code in `src/` (see `README.md`).
- **Data:** keep `data/mangroves-db.json` as is for now; Airtable comes later (tables in `airtable/`, articles live in `Articles`, `Article Sections`, `Article FAQ`).
- **URLs:** articles `/idees/<slug>` (not linked to a guide), guide profiles `/guides/<slug>`, sites `/mangrove/<slug>`.
- **Access framing (7 Oct 2026):** every mangrove is free to visit; some on foot, others need a boat or kayak (own or rented) or a guide, who brings real advantages. All copy follows this: "L’accès est gratuit", then how to reach it, the guide as an option (`howToReach` in `src/lib/format.ts`). Sites with no access mode in the data make no access claim.
- **Lead capture:** intent only (`docs/project.md` §6); do not wire or imply sending.
- **Fonts:** Google Fonts (Spectral 600 + 400 italic, Work Sans 400 + 600).

## Things to ask the user rather than decide
Further URL scheme changes, new colours or sizes, renaming existing components or tokens, anything in `docs/review-final.md` §3 and §6, legal copy, partner claims (authorisations, prices, ratings).

## Open loops and reviews
Deferred work and pending decisions live in `OPEN_LOOPS.md` (one tracker; don't start another). After each big step, run `/step-review` (`.claude/skills/step-review/`): it checks the built HTML and the source mechanically, then stops at a fix plan for approval. After a UI change, run `/ux-review` (`.claude/skills/ux-review/`): it measures the UX rules in a browser, walks the visitor tasks on a phone and on desktop, and stops at a fix plan the same way.

## Lessons from previous steps
- Judge SEO on the built HTML (`dist/`), not the source: missing routes, duplicate titles and missing metadata only show there.
- Never link to a route that isn't built; build the target first, or render the label without a link until it exists.
- A build prompt must state the routes in scope, the production origin (`SITE_URL`), and the crawl files expected (robots, sitemap, llms.txt, 404).
- When copying content from the prototype, cross-check every date, price or rule stated in two places; keep each fact in one data field (the Îlet Blanc closure dates contradicted each other).
- Text styles set `text-wrap`, which overrides an inherited `white-space: nowrap`: keep "38 €" together with a non-breaking space in data, not with CSS.
- `.on-inverse` recolours every text style inside it: put it on the text block, never on a container holding white badges or chips.
- The page's opening answer (meta description, JSON-LD `description`) must also be visible in the body, where an assistant can quote it.
- Screenshots in the cloud sandbox: pass `HTTPS_PROXY` to Chromium; some image hosts stay blocked, which is not a site bug.
- Partner-hosted URLs break without notice (Blue Lagoon's photos and tour page, Oct 2026): before a release, check booking links and images on the live site, and prefer openly licensed or self-hosted images.

## Style of work
Be concise. Prefer small targeted changes; don't refactor unrelated code. State what you changed and any proposed additions at the end of your reply.
