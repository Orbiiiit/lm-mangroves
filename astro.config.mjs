// @ts-check
import { defineConfig } from 'astro/config';

// Static output: every route is plain HTML at build time (SEO and AI crawlers need it without JS).
// SITE_URL is the production origin; it feeds canonical URLs and JSON-LD.
// Pages are indexed by default (src/lib/site-config.ts). Any CI build (GitHub Actions deploys to Cloudflare Pages)
// uses SITE_URL, else the production domain; a local build uses localhost.
const LIVE_ORIGIN = 'https://mangrove-guadeloupe.fr';
const inCI = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.CF_PAGES || process.env.WORKERS_CI);

export default defineConfig({
  site: process.env.SITE_URL || (inCI ? LIVE_ORIGIN : 'http://localhost:4321'),
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
