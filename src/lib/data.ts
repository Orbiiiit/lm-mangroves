// Data layer: the only module that reads content files. Pages call it; components never do.
// Phase 2 swaps these JSON imports for an Airtable adapter with the same return types.
import db from '../../data/mangroves-db.json';
import operatorsFile from '../../data/content/operators.json';
import siteContentFile from '../../data/content/site-content.json';
import vocab from '../../data/content/vocab.json';
import socialFile from '../../data/content/social.json';
import videosFile from '../../data/content/videos.json';
import articlesFile from '../../data/content/articles.json';
import listingsFile from '../../data/content/listings.json';
import compareFile from '../../data/content/compare.json';

export type Activity = 'bateau' | 'kayak' | 'marche' | 'pedalo' | 'canot';
export type OperatorKey = 'yalode' | 'bluelagoon';

export interface SiteImage {
  url: string;
  thumb?: string;
  caption: string;
  credit: string;
  license?: string;
  rights?: string;
  sourcePage?: string;
  sourceName?: string;
  relevance?: string;
}

export interface SiteSource {
  label: string;
  url: string;
  type: string;
}

export interface Site {
  slug: string;
  name: string;
  island: string;
  commune: string;
  zone: string | null;
  activities: Activity[];
  difficulty: string | null;
  duration: string | null;
  distanceKm: number | null;
  access: 'libre' | 'guidé' | 'payant';
  kidFriendly: boolean;
  birdwatching: boolean;
  photogenic: boolean;
  pmr: boolean;
  protection: string[];
  servedBy: OperatorKey | 'both' | null;
  gps: [number, number] | null;
  confidence: string;
  /** Set by an Airtable pull when a site is not « Publié » (draft, hidden); absent = published. */
  status?: string;
  facts: string[];
  sources: SiteSource[];
  images: SiteImage[];
  blurb: string;
  paragraphs: string[];
}

export interface Operator {
  key: OperatorKey;
  name: string;
  guide: string;
  guideSlug: string;
  photo: string;
  kind: string;
  mode: string;
  credential: string;
  tagline: string;
  priceEur: number;
  price: string;
  priceNote: string;
  priceDate: string;
  tourName: string;
  tourSummary: string;
  blurb: string;
  features: { icon: string; title: string; text: string }[];
  programme: string[];
  included: string[];
  bring: string[];
  practical: { label: string; value: string | null }[];
  rating: string | null;
  quotes: { quote: string; author: string }[];
  bookingUrl: string;
  contactUrl: string;
  homeSiteSlug: string;
  durationShort: string;
  minAge: number | null;
  departShort: string;
  forWho: string[];
  notIf: string[];
  about: {
    fullName: string;
    role: string;
    bio: string;
    facts: { icon: string; label: string; value: string }[];
    story: string;
    why: string;
    pitch: string;
    level: string;
    website: string;
    domain: string;
  };
  estimated: string[];
}

export interface SiteContent {
  h2?: string;
  sig?: string;
  tip?: string;
  tipBy?: OperatorKey;
  aka?: string[];
  when?: string;
  risks?: string[];
  drive?: string;
  parking?: string;
  bus?: string;
  self?: string;
  nameStory?: string;
  bag?: 'water' | 'walk' | string[];
  note?: { icon: string; title: string; text: string };
  alert?: { title: string; text: string; items?: string[] };
  estimated: string[];
  estimatedParagraphs?: number[];
}

export interface Article {
  slug: string;
  nav: string;
  crumb: string;
  category: string;
  icon: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroImg: string;
  heroCredit: string;
  updated: string;
  updatedIso: string;
  readTime: string;
  intro: string;
  brief: string;
  essentials: { lead: string; text: string }[];
  guideH2: string;
  sections: { title: string; paragraphs: string[] }[];
  /** A site is selected when it has every listed property; `activities` matches any of them. */
  select: { kidFriendly?: boolean; birdwatching?: boolean; activities?: Activity[] };
  selectionLabel: string;
  operators: OperatorKey[];
  know: { label: string; value: string }[];
  before: string;
  faq: { q: string; a: string }[];
  related: string[];
}

/** Publishing rule (data/mangroves-db.json `publishRule`): hide sites still "à vérifier", and drafts or hidden sites (Airtable « Statut »). */
const isPublished = (s: Site) => s.confidence !== 'à vérifier' && (!s.status || s.status === 'published');

/** Image order: mangrove shots first, partner photos first on guided sites (as in the prototype). */
function orderImages(s: Site): SiteImage[] {
  const rank = (i: SiteImage) => (i.relevance === 'mangrove' ? 0 : 2) + (s.servedBy && i.rights === 'opérateur partenaire' ? 0 : 1);
  return (s.images || []).slice().sort((a, b) => rank(a) - rank(b));
}

const allSites: Site[] = (db.sites as unknown as Site[]).map((s) => ({
  ...s,
  zone: s.zone ?? null,
  protection: s.protection || [],
  facts: s.facts || [],
  sources: s.sources || [],
  paragraphs: s.paragraphs || [],
  blurb: s.blurb || '',
  images: orderImages(s),
}));

export const getSites = (): Site[] => allSites.filter(isPublished);
/** Date of the site database version ("2026-09-29d" → "2026-09-29"), used as dateModified until sites carry their own. */
export const getDataDate = (): string => String(db.version).slice(0, 10);
export const getSite = (slug: string): Site | undefined => getSites().find((s) => s.slug === slug);

// Prices never break between the amount and the currency.
const nbsp = (v: string) => v.replace(/ €/g, '\u00a0€');
const operators = (operatorsFile.operators as unknown as Operator[]).map((o) => ({ ...o, price: nbsp(o.price), priceNote: nbsp(o.priceNote) }));
export const getOperators = (): Operator[] => operators;
export const getOperator = (key: OperatorKey): Operator => {
  const o = operators.find((x) => x.key === key);
  if (!o) throw new Error(`Unknown operator "${key}" in data/content/operators.json`);
  return o;
};

const siteContent = siteContentFile.sites as unknown as Record<string, SiteContent>;
export const getSiteContent = (slug: string): SiteContent => siteContent[slug] || { estimated: [] };

export const getRisk = (key: string) => (vocab.risks as Record<string, { icon: string; label: string }>)[key];
export const getBag = (name: 'water' | 'walk') => vocab.bags[name];
export const getZone = (zone: string | null) =>
  zone ? (vocab.zones as Record<string, typeof vocab.zones['Grand Cul-de-Sac Marin']>)[zone] : undefined;
export const getDefaultSafety = () => vocab.defaultSafety;
export const getSourceTypeLabel = (type: string) => (vocab.sourceTypes as Record<string, string>)[type] || type;

export const getSocial = (slug: string) =>
  ((socialFile.sites as Record<string, { platform: string; handle: string; date: string; caption: string; url: string }[]>)[slug]) || [];
export const getVideos = (slug: string) =>
  ((videosFile.sites as Record<string, { platform: string; author: string; title: string; q: string }[]>)[slug]) || [];

export const getArticles = (): Article[] => articlesFile.articles as unknown as Article[];
export const getArticle = (slug: string) => getArticles().find((a) => a.slug === slug);
export const getWhyGuideTiles = () => articlesFile.whyGuideTiles;
export const articleSites = (a: Article): Site[] =>
  getSites().filter((s) =>
    (a.select.kidFriendly === undefined || s.kidFriendly === a.select.kidFriendly) &&
    (a.select.birdwatching === undefined || s.birdwatching === a.select.birdwatching) &&
    (!a.select.activities || a.select.activities.some((x) => s.activities.includes(x))));
export const getActivityListings = () => listingsFile.activities;

export const getCompare = () => ({ ...compareFile, rows: compareFile.rows.map((r) => ({ ...r, boat: nbsp(r.boat), kayak: nbsp(r.kayak) })) });
