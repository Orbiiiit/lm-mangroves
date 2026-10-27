// Airtable engine, copied from rivieres-canyons (packages/core/src/airtable) so both sites run the same code.
// Keep it in sync with that file; Mangroves-specific code lives in tables.ts, never here.
// Layer 1 · Core: Airtable as a content source, described once and used three ways:
//   1. the base spec (tables, fields, help text, who edits what) → airtable/SPEC.md
//   2. import-ready CSVs, and the round-trip check (content → CSV → content must be identical)
//   3. the build-time adapter (Airtable API → content), reading fields by ID so a renamed column breaks nothing.
// Nothing here knows about a particular directory; packages and the app declare the tables.

/** Airtable field types used by the boilerplate (API names). */
export type FieldType =
  | 'singleLineText' | 'multilineText' | 'number' | 'checkbox' | 'date' | 'url' | 'email' | 'phoneNumber'
  | 'singleSelect' | 'multipleSelects' | 'multipleRecordLinks' | 'multipleAttachments'
  | 'singleCollaborator' | 'multipleCollaborators' | 'formula' | 'count' | 'multipleLookupValues';

/** Logical cell: select = option key, link = target keys, lines = text with one item per line. */
export type Cell = string | number | boolean | string[] | null;
export type Row = Record<string, Cell>;
export type Option = { key: string; label: string };

/** Who may change a field (Business plan field permissions). Default: anyone with edit access to the table. */
export type FieldEditors = 'all' | 'orbit' | 'tech';
/** What the client's people (guides, operators) can do in a table, through their interface. */
export type ClientAccess = 'none' | 'read' | 'comment' | 'own' | 'all';

export interface Field<R = any> {
  name: string;
  type: FieldType;
  help?: string;
  options?: readonly Option[];
  /** Target table name, for links. */
  link?: string;
  /** One linked record at most. */
  single?: boolean;
  decimals?: number;
  edit?: FieldEditors;
  /** Airtable-only helper (formula, count, account): the site never reads it. */
  helper?: boolean;
  formula?: string;
  /** Interface section the field belongs to ("Contenu", "SEO"…). */
  group?: string;
  get?: (r: R) => Cell;
  set?: (r: any, v: Cell) => void;
  /** Runs once every field of the row is set (to drop an object left empty). */
  after?: (r: any) => void;
}

export interface Table<R = any> {
  /** Table name shown to editors. */
  name: string;
  /** File and content key ("listings" → listings.csv). */
  id: string;
  /** What one row is, in plain words. */
  about: string;
  /** Primary field name (what link cells show). Unique when other tables link to this one. */
  primary: string;
  /** Field holding the permanent key (slug); absent for child rows nobody links to. */
  key?: string;
  client: ClientAccess;
  fields: Field<R>[];
}

const getPath = (o: unknown, p: string): any => p.split('.').reduce<any>((x, k) => (x == null ? undefined : x[k]), o);

// ---------- dotted paths ----------
export function setPath(obj: any, path: string, value: unknown) {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) o = o[k] ??= {};
  o[ks[ks.length - 1]] = value;
}

// ---------- field helpers ----------
const empty = (v: Cell) => v === null || v === '' || (Array.isArray(v) && v.length === 0);
type Opts = Omit<Field, 'name' | 'type' | 'get' | 'set'>;

/** A field stored at a dotted path, as is. */
export function f(name: string, type: FieldType, path: string, o: Opts = {}): Field {
  const isText = ['singleLineText', 'multilineText', 'url', 'email', 'phoneNumber', 'date'].includes(type);
  return {
    name, type, ...o,
    get: (r) => getPath(r, path) ?? (type === 'checkbox' ? false : null),
    set: (r, v) => setPath(r, path, type === 'checkbox' ? !!v : isText ? (empty(v) ? null : v) : (empty(v) ? (o.link && !o.single ? [] : null) : v)),
  };
}
/** Text that is required by the schema but may be empty in Airtable: empty becomes "". */
export function fText(name: string, path: string, o: Opts = {}): Field {
  return { name, type: 'multilineText', ...o, get: (r) => getPath(r, path) || null, set: (r, v) => setPath(r, path, (v as string) ?? '') };
}
/** Single select: content holds the key, Airtable shows the label. */
export function fSelect(name: string, path: string, options: readonly Option[], o: Opts = {}): Field {
  return { ...f(name, 'singleSelect', path, o), options };
}
/** Multiple select. */
export function fMulti(name: string, path: string, options: readonly Option[], o: Opts = {}): Field {
  return { name, type: 'multipleSelects', options, ...o, get: (r) => getPath(r, path) ?? [], set: (r, v) => setPath(r, path, (v as string[]) ?? []) };
}
/** Link to records of another table, by key. */
export function fLink(name: string, path: string, table: string, o: Opts & { single?: boolean } = {}): Field {
  return {
    name, type: 'multipleRecordLinks', link: table, ...o,
    get: (r) => { const v = getPath(r, path); return o.single ? (v ? [v] : []) : v ?? []; },
    set: (r, v) => {
      const list = (v as string[] | null) ?? [];
      if (o.single && list.length > 1) throw new Error(`« ${name} » : un seul lien attendu, ${list.length} trouvés (${list.join(', ')})`);
      setPath(r, path, o.single ? list[0] ?? null : list);
    },
  };
}
/** A list of short texts, one per line. */
export function fLines(name: string, path: string, o: Opts = {}): Field {
  return {
    name, type: 'multilineText', ...o,
    help: o.help ?? 'Un élément par ligne.',
    get: (r) => ((getPath(r, path) as string[] | null) ?? []).join('\n') || null,
    set: (r, v) => setPath(r, path, splitLines(v)),
  };
}
const splitLines = (v: Cell) => (typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : []);

/**
 * A list of items written "Libellé : valeur" (one per line), optionally led by an icon and followed by " — détail".
 * Keeps two- to four-part items readable without a child table.
 */
export function fLabelled(name: string, path: string, parts: { icon?: boolean; detail?: string } = {}, o: Opts = {}): Field {
  const format = `${parts.icon ? 'icône ' : ''}Libellé : valeur${parts.detail ? ' — précision' : ''}`;
  return {
    name, type: 'multilineText', ...o,
    help: `${o.help ? o.help + ' ' : ''}Une ligne par élément, au format « ${format} ».`,
    get: (r) => ((getPath(r, path) as any[] | null) ?? []).map((x) =>
      `${parts.icon && x.icon ? x.icon + ' ' : ''}${x.label} : ${x.value}${parts.detail && x[parts.detail] ? ' — ' + x[parts.detail] : ''}`).join('\n') || null,
    set: (r, v) => setPath(r, path, splitLines(v).map((line) => {
      let rest = line, icon: string | null = null, detail: string | null = null;
      if (parts.icon) { const m = rest.match(/^(\p{Extended_Pictographic}[\p{Extended_Pictographic}️‍⃣]*)\s+/u); if (m) { icon = m[1]; rest = rest.slice(m[0].length); } }
      if (parts.detail) { const i = rest.indexOf(' — '); if (i >= 0) { detail = rest.slice(i + 3); rest = rest.slice(0, i); } }
      const i = rest.indexOf(' : ');
      if (i < 0) throw new Error(`« ${name} » : la ligne « ${line} » doit être au format « ${format} »`);
      return { ...(parts.icon ? { icon: icon ?? '' } : {}), label: rest.slice(0, i), value: rest.slice(i + 3), ...(parts.detail ? { [parts.detail]: detail } : {}) };
    })),
  };
}
/** An Airtable-only helper (formula, count, account field). */
export function fHelper(name: string, type: FieldType, help: string, o: Opts = {}): Field {
  return { name, type, help, helper: true, ...o };
}

/** "{key: label}" → options. */
export const optionsOf = (o: Record<string, string | { label: string }>): Option[] =>
  Object.entries(o).map(([key, v]) => ({ key, label: typeof v === 'string' ? v : v.label }));

// ---------- records ↔ rows ----------
export function toRow(t: Table, r: unknown): Row {
  const row: Row = {};
  for (const fd of t.fields) if (fd.get) row[fd.name] = fd.get(r);
  return row;
}
/** Row → record. A badly formatted cell is reported with its table and row (into `errors`, or thrown). */
export function fromRow(t: Table, row: Row, init: () => any = () => ({}), errors?: string[]): any {
  const r = init();
  for (const fd of t.fields) {
    if (!fd.set) continue;
    try { fd.set(r, row[fd.name] ?? null); } catch (e) {
      const msg = `${t.name} « ${row[t.primary] ?? '?'} » · ${(e as Error).message}`;
      if (!errors) throw new Error(msg);
      errors.push(msg);
    }
  }
  for (const fd of t.fields) fd.after?.(r);
  return r;
}

// ---------- logical rows ↔ Airtable cell values (labels and primary values) ----------
export class Codec {
  private keyToPrimary = new Map<string, Map<string, string>>();
  private primaryToKey = new Map<string, Map<string, string>>();
  constructor(private tables: Table[], rows: Record<string, Row[]>, private errors: string[]) {
    for (const t of tables.filter((x) => x.key)) {
      const kp = new Map<string, string>(), pk = new Map<string, string>();
      for (const row of rows[t.id] ?? []) {
        const k = String(row[t.key!] ?? ''), p = String(row[t.primary] ?? '');
        if (pk.has(p)) errors.push(`${t.name} : « ${p} » apparaît deux fois dans « ${t.primary} » (il doit être unique)`);
        kp.set(k, p); pk.set(p, k);
      }
      this.keyToPrimary.set(t.name, kp); this.primaryToKey.set(t.name, pk);
    }
  }
  /** Logical → what Airtable shows (labels, primary values). */
  out(fd: Field, v: Cell): Cell {
    if (v === null) return null;
    if (fd.options) {
      const lab = (k: string) => fd.options!.find((o) => o.key === k)?.label ?? (this.errors.push(`${fd.name} : option inconnue « ${k} »`), k);
      return Array.isArray(v) ? v.map(lab) : lab(String(v));
    }
    if (fd.link) return (v as string[]).map((k) => this.keyToPrimary.get(fd.link!)?.get(k) ?? (this.errors.push(`${fd.name} : « ${k} » introuvable dans ${fd.link}`), k));
    return v;
  }
  /** What Airtable shows → logical. Unknown values are errors, never guesses. */
  in(fd: Field, v: Cell, where: string): Cell {
    if (v === null || v === '') return null;
    if (fd.options) {
      const key = (l: string) => fd.options!.find((o) => o.label === l)?.key ?? (this.errors.push(`${where} · ${fd.name} : « ${l} » n'est pas une option prévue`), l);
      return Array.isArray(v) ? v.map(key) : key(String(v));
    }
    if (fd.link) return (v as string[]).map((p) => this.primaryToKey.get(fd.link!)?.get(p) ?? (this.errors.push(`${where} · ${fd.name} : « ${p} » introuvable dans ${fd.link}`), p));
    return v;
  }
}

// ---------- CSV (RFC 4180, as Airtable imports and exports it) ----------
const quote = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
function csvCell(fd: Field, v: Cell): string {
  if (v === null) return '';
  return quote(Array.isArray(v) ? v.join(',') : fd.type === 'checkbox' ? (v ? 'checked' : '') : String(v));
}
export function writeCsv(t: Table, rows: Row[], codec: Codec): string {
  const fields = t.fields.filter((fd) => !fd.helper);
  const lines = [fields.map((fd) => quote(fd.name)).join(',')];
  for (const row of rows) lines.push(fields.map((fd) => csvCell(fd, codec.out(fd, row[fd.name] ?? null))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}
/** CSV text → rows with Airtable-shaped values (labels, primary values), typed by the spec. */
export function readCsv(t: Table, text: string): Row[] {
  const [head, ...body] = parseCsv(text).filter((r) => r.some((c) => c !== ''));
  return body.map((cells) => {
    const row: Row = {};
    head.forEach((name, i) => {
      const fd = t.fields.find((x) => x.name === name); if (!fd) return;
      const raw = cells[i] ?? '';
      row[name] = fd.type === 'checkbox' ? raw === 'checked'
        : raw === '' ? null
          : fd.type === 'number' ? Number(raw)
            : fd.type === 'multipleSelects' || fd.type === 'multipleRecordLinks' ? raw.split(',').map((x) => x.trim())
              : raw;
    });
    return row;
  });
}

/** Characters Airtable splits on when it turns imported text into links or multiple selects. */
export function checkImportable(tables: Table[], rows: Record<string, Row[]>): string[] {
  const errs: string[] = [];
  const linked = new Set(tables.flatMap((t) => t.fields.filter((x) => x.link).map((x) => x.link!)));
  for (const t of tables) {
    if (linked.has(t.name)) for (const r of rows[t.id] ?? []) if (String(r[t.primary]).includes(',')) errs.push(`${t.name} : « ${r[t.primary]} » contient une virgule, l'import des liens la couperait`);
    for (const fd of t.fields.filter((x) => x.options && x.type === 'multipleSelects')) for (const o of fd.options!) if (o.label.includes(',')) errs.push(`${t.name} · ${fd.name} : l'option « ${o.label} » contient une virgule`);
  }
  return errs;
}

// ---------- Airtable API (build time) ----------
/** Field and table IDs, written by `airtable:link` once the base exists. Columns are read by ID: renaming one breaks nothing. */
export interface BaseMap { base_id: string; tables: Record<string, { id: string; fields: Record<string, string> }> }

/** Reads every table through the API and returns rows with Airtable-shaped values, keyed by our field names. */
export async function fetchBase(tables: Table[], map: BaseMap, token: string): Promise<Record<string, Row[]>> {
  const raw: Record<string, { id: string; fields: Record<string, unknown> }[]> = {};
  for (const t of tables) {
    const tm = map.tables[t.name]; if (!tm) throw new Error(`table « ${t.name} » absente de airtable.map.json (lancez airtable:link)`);
    const recs: any[] = []; let offset: string | undefined;
    do {
      const j = await api(token, 'GET', `/${map.base_id}/${tm.id}?returnFieldsByFieldId=true&pageSize=100${offset ? `&offset=${offset}` : ''}`);
      recs.push(...j.records); offset = j.offset;
    } while (offset);
    raw[t.name] = recs;
  }
  // Link cells hold record IDs: turn them into the target's primary value, like a CSV export.
  const primaryById = new Map<string, string>();
  for (const t of tables) for (const r of raw[t.name]) primaryById.set(r.id, String(r.fields[map.tables[t.name].fields[t.primary]] ?? ''));
  const out: Record<string, Row[]> = {};
  for (const t of tables) out[t.id] = raw[t.name].map((r) => {
    const row: Row = {};
    for (const fd of t.fields) {
      const id = map.tables[t.name].fields[fd.name]; if (!id) continue;
      const v = r.fields[id] as any;
      row[fd.name] = v === undefined ? (fd.type === 'checkbox' ? false : null)
        : fd.link ? (v as string[]).map((x) => primaryById.get(x) ?? x)
          : fd.type === 'multipleAttachments' ? (v as { url: string }[]).map((a) => a.url)
            : fd.type === 'singleCollaborator' || fd.type === 'multipleCollaborators' ? null
              : v;
    }
    return row;
  });
  return out;
}

/** Matches the base's tables and fields to the spec by name, once. Returns the map and what is missing or extra. */
export async function linkBase(tables: Table[], baseId: string, token: string) {
  const meta = await api(token, 'GET', `/meta/bases/${baseId}/tables`) as { tables: { id: string; name: string; fields: { id: string; name: string; type: string }[] }[] };
  const map: BaseMap = { base_id: baseId, tables: {} }; const problems: string[] = [];
  for (const t of tables) {
    const mt = meta.tables.find((x) => x.name === t.name);
    if (!mt) { problems.push(`table manquante : ${t.name}`); continue; }
    map.tables[t.name] = { id: mt.id, fields: {} };
    for (const fd of t.fields) {
      const mf = mt.fields.find((x) => x.name === fd.name);
      if (!mf) { if (!fd.helper) problems.push(`${t.name} : champ manquant « ${fd.name} »`); continue; }
      if (mf.type !== fd.type && !fd.helper) problems.push(`${t.name} · ${fd.name} : type ${mf.type}, attendu ${fd.type}`);
      map.tables[t.name].fields[fd.name] = mf.id;
    }
  }
  return { map, problems };
}

// ---------- Building a base through the API (schema + records) ----------
const API = 'https://api.airtable.com/v0';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** One API call, paced under Airtable's 5 requests/second and retried on 429 / 5xx. */
export async function api(token: string, method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    await sleep(250);
    const res = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(2000 * 2 ** attempt); continue; }
    throw new Error(`Airtable ${method} ${path}: ${res.status} ${text}`);
  }
}

/** Airtable field definition for the create-base / create-field endpoints (links are added afterwards). */
function fieldDefinition(fd: Field, tableIds: Record<string, string>) {
  const base = { name: fd.name, type: fd.type, ...(fd.help ? { description: fd.help.slice(0, 20000) } : {}) };
  switch (fd.type) {
    case 'number': return { ...base, options: { precision: fd.decimals ?? 0 } };
    case 'checkbox': return { ...base, options: { icon: 'check', color: 'greenBright' } };
    case 'date': return { ...base, options: { dateFormat: { name: 'iso' } } };
    case 'singleSelect': case 'multipleSelects': return { ...base, options: { choices: fd.options!.map((o) => ({ name: o.label })) } };
    // The API refuses "prefersSingleRecordLink" on create: single links are enforced by the adapter (fLink, one record).
    case 'multipleRecordLinks': return { ...base, options: { linkedTableId: tableIds[fd.link!] } };
    default: return base;
  }
}
/** Added one by one after the tables exist, so one refused field cannot block the whole base. */
const later = (fd: Field) => ['multipleRecordLinks', 'singleCollaborator', 'multipleCollaborators', 'multipleAttachments'].includes(fd.type);
/** Helpers the API cannot create (computed fields, reverse links): left for a person, listed in the report. */
const manualHelper = (fd: Field) => fd.helper && ['formula', 'count', 'multipleLookupValues', 'multipleRecordLinks'].includes(fd.type);

/**
 * Creates a new base in a workspace with every table and field of the spec.
 * Tables are created with their plain fields, then links are added (Airtable creates the reverse link itself).
 */
export async function createBase(tables: Table[], workspaceId: string, name: string, token: string) {
  const problems: string[] = [];
  const plain = (t: Table) => {
    const fields = t.fields.filter((fd) => !later(fd) && !manualHelper(fd));
    const primary = fields.find((fd) => fd.name === t.primary)!;
    return [primary, ...fields.filter((fd) => fd !== primary)];
  };
  const created = await api(token, 'POST', '/meta/bases', {
    name, workspaceId,
    tables: tables.map((t) => ({ name: t.name, description: t.about.slice(0, 20000), fields: plain(t).map((fd) => fieldDefinition(fd, {})) })),
  });
  const baseId: string = created.id;
  const tableIds: Record<string, string> = Object.fromEntries(created.tables.map((t: any) => [t.name, t.id]));
  for (const t of tables)
    for (const fd of t.fields.filter((x) => later(x) && !manualHelper(x))) {
      try { await api(token, 'POST', `/meta/bases/${baseId}/tables/${tableIds[t.name]}/fields`, fieldDefinition(fd, tableIds)); }
      catch (e) { problems.push(`${t.name} · ${fd.name}: ${(e as Error).message}`); }
    }
  const manual = tables.flatMap((t) => t.fields.filter((fd) => manualHelper(fd)).map((fd) => ({ table: t.name, field: fd })));
  return { baseId, tableIds, problems, manual };
}

/**
 * Writes logical rows into an empty base: records first (without links), then the links, by record ID.
 * Values are sent as Airtable shows them (option labels); keys of linked records become record IDs.
 */
export async function pushRows(tables: Table[], map: BaseMap, rows: Record<string, Row[]>, codec: Codec, token: string) {
  const recIds: Record<string, string[]> = {};
  const byKey: Record<string, Map<string, string>> = {};
  const value = (fd: Field, v: Cell) => {
    const out = codec.out(fd, v);
    if (out === null || out === '' || (Array.isArray(out) && !out.length)) return undefined;
    return fd.type === 'checkbox' ? (out ? true : undefined) : out;
  };
  const batches = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / 10) }, (_, i) => a.slice(i * 10, i * 10 + 10));
  for (const t of tables) {
    const tm = map.tables[t.name]; const list = rows[t.id] ?? [];
    const plain = t.fields.filter((fd) => fd.get && fd.type !== 'multipleRecordLinks' && tm.fields[fd.name]);
    recIds[t.id] = [];
    for (const chunk of batches(list)) {
      const res = await api(token, 'POST', `/${map.base_id}/${tm.id}`, {
        typecast: false,
        records: chunk.map((row) => ({ fields: Object.fromEntries(plain.map((fd) => [tm.fields[fd.name], value(fd, row[fd.name] ?? null)]).filter(([, v]) => v !== undefined)) })),
      });
      recIds[t.id].push(...res.records.map((r: any) => r.id));
    }
    if (t.key) byKey[t.name] = new Map(list.map((row, i) => [String(row[t.key!]), recIds[t.id][i]]));
  }
  for (const t of tables) {
    const tm = map.tables[t.name]; const list = rows[t.id] ?? [];
    const links = t.fields.filter((fd) => fd.get && fd.type === 'multipleRecordLinks' && !fd.helper && tm.fields[fd.name]);
    if (!links.length) continue;
    const updates = list.map((row, i) => ({
      id: recIds[t.id][i],
      fields: Object.fromEntries(links.map((fd) => [tm.fields[fd.name], ((row[fd.name] as string[] | null) ?? []).map((k) => {
        const id = byKey[fd.link!]?.get(k); if (!id) throw new Error(`${t.name} · ${fd.name}: « ${k} » not found in ${fd.link}`); return id;
      })]).filter(([, v]) => (v as string[]).length)),
    })).filter((u) => Object.keys(u.fields).length);
    for (const chunk of batches(updates)) await api(token, 'PATCH', `/${map.base_id}/${tm.id}`, { records: chunk });
  }
  return Object.fromEntries(Object.entries(recIds).map(([k, v]) => [k, v.length]));
}

/** Adds the spec's fields that the base lacks (creatable ones). Returns what was added and what failed. */
export async function addMissingFields(tables: Table[], baseId: string, token: string) {
  const meta = await api(token, 'GET', `/meta/bases/${baseId}/tables`) as { tables: { id: string; name: string; fields: { name: string }[] }[] };
  const tableIds = Object.fromEntries(meta.tables.map((t) => [t.name, t.id]));
  const added: string[] = [], problems: string[] = [];
  for (const t of tables) {
    const mt = meta.tables.find((x) => x.name === t.name);
    if (!mt) { problems.push(`table manquante : ${t.name} (à créer à la main ou base à recréer)`); continue; }
    for (const fd of t.fields.filter((x) => !manualHelper(x) && !mt.fields.some((f) => f.name === x.name))) {
      try { await api(token, 'POST', `/meta/bases/${baseId}/tables/${mt.id}/fields`, fieldDefinition(fd, tableIds)); added.push(`${t.name} · ${fd.name}`); }
      catch (e) { problems.push(`${t.name} · ${fd.name}: ${(e as Error).message}`); }
    }
  }
  return { added, problems };
}

/** Deletes every record of the spec's tables (used only by the explicit "reset" job). */
export async function clearTables(tables: Table[], map: BaseMap, token: string) {
  let n = 0;
  for (const t of tables) {
    const tm = map.tables[t.name]; if (!tm) continue;
    const ids: string[] = []; let offset: string | undefined;
    do {
      const j = await api(token, 'GET', `/${map.base_id}/${tm.id}?pageSize=100&fields%5B%5D=${encodeURIComponent(tm.fields[t.primary] ?? '')}${offset ? `&offset=${offset}` : ''}`);
      ids.push(...j.records.map((r: any) => r.id)); offset = j.offset;
    } while (offset);
    for (let i = 0; i < ids.length; i += 10)
      await api(token, 'DELETE', `/${map.base_id}/${tm.id}?${ids.slice(i, i + 10).map((x) => `records%5B%5D=${x}`).join('&')}`);
    n += ids.length;
  }
  return n;
}
