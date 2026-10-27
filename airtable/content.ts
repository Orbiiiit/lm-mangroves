// The site's content files, as Airtable sees them: read them all, write them back in one stable format.
// Only these scripts and src/lib/data.ts touch data/. Parts Airtable doesn't hold (vocabulary, activity pages,
// editorial rules, file notes) are kept from the repository on every write.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../data');

/** File → content key. */
export const FILES = {
  db: 'mangroves-db.json',
  operators: 'content/operators.json',
  siteContent: 'content/site-content.json',
  articles: 'content/articles.json',
  compare: 'content/compare.json',
  social: 'content/social.json',
  videos: 'content/videos.json',
  vocab: 'content/vocab.json',
} as const;
/** Written back by a pull. vocab.json stays as it is (risk icons and labels live in code). */
const WRITTEN = ['db', 'operators', 'siteContent', 'articles', 'compare', 'social', 'videos'] as const;

export type Content = Record<keyof typeof FILES, any>;

export const readContent = (): Content =>
  Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, JSON.parse(readFileSync(resolve(DATA, f), 'utf8'))])) as Content;

export const format = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

/** Writes the files whose text changed; returns their names. */
export function writeContent(c: Content): string[] {
  const changed: string[] = [];
  for (const k of WRITTEN) {
    const file = resolve(DATA, FILES[k]);
    const text = format(c[k]);
    if (readFileSync(file, 'utf8') !== text) { writeFileSync(file, text); changed.push(FILES[k]); }
  }
  return changed;
}
