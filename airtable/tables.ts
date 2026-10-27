// The Mangroves Airtable base: the generic directory base of rivieres-canyons (docs: airtable/SPEC.md,
// rivieres-canyons docs/AIRTABLE_BASE_DESIGN.md), mapped onto this site's content files.
// Same table and column names wherever the meaning is the same; French names (decision D6); read by field ID.
//
//   toTables(content)        content files → one list of rows per table (export, build)
//   fromTables(rows, base)   rows → content files (pull); `base` gives the parts Airtable doesn't hold
//
// Airtable keeps no row order: every ordered table has an "Ordre" column, and the pull sorts by it.
import { f, fSelect, fMulti, fLink, fLines, type Field, type Table, type Row, type Cell, type Option, toRow, fromRow } from './lib/engine';
import type { Content } from './content';

/** Table names (generic names from rivieres-canyons; "Publications" and "Comparatif" are site extras). */
export const N = {
  listing: 'Lieux', listing_one: 'Lieu', locality: 'Communes', criterion: 'Critères',
  operator: 'Opérateurs', operator_one: 'Opérateur', guide: 'Guides', offer: 'Sorties', review: 'Avis',
  image: 'Photos', source: 'Sources', article: 'Articles', article_one: 'Article', section: "Sections d'article",
  faq: 'FAQ', post: 'Publications', compare: 'Comparatif', copy: 'Textes du site',
} as const;

// ---------- small helpers ----------
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const opts = (keys: readonly string[], labels: Record<string, string> = {}): Option[] => keys.map((k) => ({ key: k, label: labels[k] ?? k }));
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const ORDER = (help = 'Position dans les listes (1, 2, 3…).') => f('Ordre', 'number', 'order', { help, edit: 'orbit' });

/** Paragraphs separated by an empty line. */
function fParagraphs(name: string, path: string, help = 'Un paragraphe par bloc, séparés par une ligne vide.'): Field {
  return {
    name, type: 'multilineText', help,
    get: (r) => ((r[path] as string[] | null) ?? []).join('\n\n') || null,
    set: (r, v) => { r[path] = typeof v === 'string' ? v.split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean) : []; },
  };
}

/** Items written one per line as "Libellé : valeur", optionally led by an icon name ("boat | Libellé : valeur"). */
function fItems(name: string, path: string, keys: { icon?: string; label: string; value: string }, o: { nullable?: boolean; help?: string } = {}): Field {
  const format = `${keys.icon ? 'icône | ' : ''}Libellé : valeur`;
  return {
    name, type: 'multilineText',
    help: `${o.help ? o.help + ' ' : ''}Une ligne par élément, au format « ${format} »${keys.icon ? ' (noms d\'icônes : voir docs/design-system.md §6)' : ''}${o.nullable ? ' ; « Libellé : » seul = non renseigné' : ''}.`,
    get: (r) => ((r[path] as any[] | null) ?? []).map((x) =>
      `${keys.icon ? `${x[keys.icon]} | ` : ''}${x[keys.label]} :${x[keys.value] == null ? '' : ' ' + x[keys.value]}`).join('\n') || null,
    set: (r, v) => {
      r[path] = (typeof v === 'string' ? v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : []).map((line) => {
        let rest = line; const item: any = {};
        if (keys.icon) {
          const i = rest.indexOf(' | ');
          if (i < 0) throw new Error(`« ${name} » : la ligne « ${line} » doit être au format « ${format} »`);
          item[keys.icon] = rest.slice(0, i).trim(); rest = rest.slice(i + 3);
        }
        const i = rest.indexOf(' :');
        if (i < 0) throw new Error(`« ${name} » : la ligne « ${line} » doit être au format « ${format} »`);
        const value = rest.slice(i + 2).trim();
        if (!value && !o.nullable) throw new Error(`« ${name} » : la ligne « ${line} » n'a pas de valeur`);
        item[keys.label] = rest.slice(0, i).trim();
        item[keys.value] = value || null;
        return item;
      });
    },
  };
}

// ---------- vocabularies (the options; values are the keys stored in the content files) ----------
/** Yes/no criteria (decision D1): activities and audience. The site knows these keys; a new one needs code. */
export const CRITERIA = [
  { key: 'bateau', label: 'Bateau', group: 'activity' }, { key: 'kayak', label: 'Kayak', group: 'activity' },
  { key: 'marche', label: 'À pied', group: 'activity' }, { key: 'pedalo', label: 'Pédalo', group: 'activity' },
  { key: 'canot', label: 'Canot', group: 'activity' },
  { key: 'en-famille', label: 'En famille', group: 'audience', flag: 'kidFriendly' },
  { key: 'oiseaux', label: 'Oiseaux', group: 'audience', flag: 'birdwatching' },
  { key: 'photogenique', label: 'Photogénique', group: 'audience', flag: 'photogenic' },
  { key: 'pmr', label: 'Accessible PMR', group: 'audience', flag: 'pmr' },
] as const;
const ACTIVITIES = CRITERIA.filter((c) => c.group === 'activity').map((c) => c.key) as string[];
const FLAGS = CRITERIA.filter((c): c is Extract<typeof c, { flag: string }> => 'flag' in c);

const STATUS: Option[] = [{ key: 'published', label: 'Publié' }, { key: 'draft', label: 'Brouillon' }, { key: 'hidden', label: 'Masqué' }, { key: 'rejected', label: 'Rejeté' }];
const ESTIMABLE: Record<string, string> = {
  drive: 'Temps de route', parking: 'Parking', bus: 'Bus', risks: 'Risques', bag: 'Sac à prévoir', when: 'Quand y aller',
  nameStory: 'Histoire du nom', self: 'Par vos propres moyens', tip: 'Conseil',
};

/** Option lists built from the content plus the values the site knows, so nothing present is ever refused. */
function vocab(c: Content) {
  const sites: any[] = c.db.sites;
  const sc = Object.values(c.siteContent.sites) as any[];
  return {
    islands: opts(uniq(['Guadeloupe (Basse-Terre)', 'Guadeloupe (Grande-Terre)', 'Marie-Galante', 'Désirade', 'Les Saintes', ...sites.map((s) => s.island)])),
    zones: opts(uniq(sites.map((s) => s.zone).filter(Boolean))),
    difficulty: opts(uniq(['Facile', 'Modérée', 'Difficile', ...sites.map((s) => s.difficulty).filter(Boolean)])),
    access: opts(uniq(['libre', 'guidé', 'payant', ...sites.map((s) => s.access).filter(Boolean)]), { libre: 'Libre', 'guidé': 'Avec un guide', payant: 'Payant' }),
    confidence: opts(['vérifié', 'partiel', 'à vérifier'], { 'vérifié': 'Vérifié', partiel: 'Partiel', 'à vérifier': 'À vérifier (masqué)' }),
    protection: opts(uniq(sites.flatMap((s) => s.protection))),
    risks: opts(Object.keys(c.vocab.risks), Object.fromEntries(Object.entries(c.vocab.risks).map(([k, v]: any) => [k, v.label]))),
    bag: opts(Object.keys(c.vocab.bags), { water: 'Sortie sur l\'eau', walk: 'Balade à pied' }),
    estimated: opts(uniq([...Object.keys(ESTIMABLE), ...sc.flatMap((x) => x.estimated ?? [])]), ESTIMABLE),
    rights: opts(uniq(['libre (CC)', 'opérateur partenaire', 'autorisation requise', ...sites.flatMap((s) => s.images.map((i: any) => i.rights))]),
      { 'libre (CC)': 'Libre (licence)', 'opérateur partenaire': 'Partenaire', 'autorisation requise': 'Autorisation à obtenir' }),
    relevance: opts(['mangrove', 'contexte'], { mangrove: 'Mangrove', contexte: 'Contexte' }),
    sourceTypes: opts(Object.keys(c.vocab.sourceTypes), c.vocab.sourceTypes),
  };
}

// ---------- tables ----------
export function tables(c: Content): Table[] {
  const v = vocab(c);
  const G = (group: string, fd: Field): Field => ({ ...fd, group });
  return [
    {
      name: N.listing, id: 'listings', primary: 'Nom', key: 'Slug', client: 'comment',
      about: 'Une mangrove (une fiche du site). « Rejeté » = écartée après recherche : elle reste ici pour ne pas être ajoutée à nouveau.',
      fields: [
        G('Contenu', f('Nom', 'singleLineText', 'name')),
        G('Contenu', f('Slug', 'singleLineText', 'slug', { edit: 'tech', help: 'Adresse de la page (/mangrove/slug). Ne plus changer une fois publiée.' })),
        G('Contenu', ORDER('Position dans l\'annuaire (1 = en premier).')),
        G('Contenu', fSelect('Statut', 'status', STATUS, { edit: 'orbit', help: 'Seuls les lieux « Publié » (et pas « À vérifier ») sont sur le site.' })),
        G('Contenu', f('Note de statut', 'multilineText', 'statusNote', { edit: 'orbit', help: 'Raison du rejet ou du masquage. Interne.' })),
        G('Contenu', f('Accroche', 'multilineText', 'blurb', { help: 'Une phrase, sur les cartes.' })),
        G('Contenu', fParagraphs('Description', 'paragraphs')),
        G('Contenu', f('Phrase signature', 'multilineText', 'sig', { help: 'La phrase en exergue de la fiche.' })),
        G('Contenu', f('Titre H2 — aperçu', 'singleLineText', 'h2')),
        G('Contenu', fLines('Repères clés', 'facts')),
        G('Contenu', fLines('Autres noms', 'aka')),
        G('Contenu', f('Histoire du nom', 'multilineText', 'nameStory')),
        G('Contenu', f('Conseil — texte', 'multilineText', 'tip')),
        G('Contenu', fLink('Conseil — opérateur', 'tipBy', N.operator, { single: true, help: 'Le guide qui signe le conseil. Vide = « Le conseil de l\'équipe ».' })),
        G('Repères', fLink('Critères', 'criteria', N.criterion, { help: 'Activités (dans l\'ordre d\'affichage) et public.' })),
        G('Repères', fSelect('Difficulté', 'difficulty', v.difficulty)),
        G('Repères', f('Durée', 'singleLineText', 'duration', { help: 'Texte libre (« 15 à 30 min »).' })),
        G('Repères', f('Distance (km)', 'number', 'distanceKm', { decimals: 1 })),
        G('Repères', fSelect('Accès', 'access', v.access)),
        G('Repères', fMulti('Protection', 'protection', v.protection)),
        G('Repères', fLink(N.operator, 'operators', N.operator, { help: 'Les guides partenaires qui y emmènent.' })),
        G('Lieu', fSelect('Île', 'island', v.islands)),
        G('Lieu', fSelect('Zone', 'zone', v.zones)),
        G('Lieu', fLink(N.locality, 'communes', N.locality, { help: 'Dans l\'ordre d\'affichage (« Baie-Mahault / Les Abymes »).' })),
        G('Lieu', f('Latitude', 'number', 'lat', { decimals: 6, help: 'Uniquement depuis une source publiée.' })),
        G('Lieu', f('Longitude', 'number', 'lng', { decimals: 6 })),
        G('Accès', f('Quand y aller', 'multilineText', 'when')),
        G('Accès', f('Accès — route', 'singleLineText', 'drive')),
        G('Accès', f('Accès — bus', 'singleLineText', 'bus')),
        G('Accès', f('Accès — parking', 'singleLineText', 'parking')),
        G('Accès', f('Accès — par vos propres moyens', 'multilineText', 'self')),
        G('Sécurité', fSelect('Sac à prévoir', 'bag', v.bag)),
        G('Sécurité', fMulti('Risques', 'risks', v.risks)),
        G('Sécurité', f('Encadré — icône', 'singleLineText', 'noteIcon', { help: 'Nom d\'icône (docs/design-system.md §6).' })),
        G('Sécurité', f('Encadré — titre', 'singleLineText', 'noteTitle')),
        G('Sécurité', f('Encadré — texte', 'multilineText', 'noteText')),
        G('Sécurité', f('Alerte — titre', 'singleLineText', 'alertTitle', { help: 'Une alerte (fermeture, danger) : repliée sur la page.' })),
        G('Sécurité', f('Alerte — texte', 'multilineText', 'alertText')),
        G('Sécurité', fLines('Alerte — points', 'alertItems')),
        G('Suivi', fSelect('Niveau de vérification', 'confidence', v.confidence, { edit: 'orbit', help: '« À vérifier » masque le lieu du site.' })),
        G('Suivi', fMulti('À confirmer', 'estimated', v.estimated, { help: 'Valeurs estimées : affichées avec « à confirmer ».' })),
        G('Suivi', f('Paragraphes à confirmer', 'singleLineText', 'estParas', { help: 'Numéros des paragraphes de la description à confirmer (« 1, 2 »).' })),
        G('Suivi', f('Photos à trouver', 'singleLineText', 'imagesTodo')),
        G('Suivi', f('Note interne', 'multilineText', 'internalNote', { edit: 'orbit', help: 'Jamais affichée.' })),
      ],
    },
    {
      name: N.locality, id: 'localities', primary: 'Nom', key: 'Nom', client: 'read',
      about: 'Une commune. Les pages /commune/… sont créées depuis les lieux qui y sont rattachés.',
      fields: [f('Nom', 'singleLineText', 'name')],
    },
    {
      name: N.criterion, id: 'criteria', primary: 'Critère', key: 'Clé', client: 'read',
      about: 'Un critère oui/non (activité ou public). Le site connaît ces clés : un nouveau critère demande une modification du code.',
      fields: [
        f('Critère', 'singleLineText', 'label'), f('Clé', 'singleLineText', 'key', { edit: 'tech' }),
        fSelect('Groupe', 'group', [{ key: 'activity', label: 'Activité' }, { key: 'audience', label: 'Public' }], { edit: 'tech' }),
        ORDER(),
      ],
    },
    {
      name: N.operator, id: 'operators', primary: 'Nom', key: 'Clé', client: 'own',
      about: 'Une entreprise partenaire. Sa sortie est dans « Sorties », son guide dans « Guides ».',
      fields: [
        f('Nom', 'singleLineText', 'name'), f('Clé', 'singleLineText', 'key', { edit: 'tech' }), ORDER(),
        fSelect('Type', 'kind', [{ key: 'bateau', label: 'Bateau' }, { key: 'kayak', label: 'Kayak' }], { edit: 'orbit' }),
        f('Mode', 'singleLineText', 'mode', { help: '« En bateau », « En kayak ».' }),
        f('Accréditation', 'singleLineText', 'credential', { help: 'Ex. « Guide brevet d\'État · 4,9 ★ · +1 880 avis ».' }),
        f('Accroche', 'multilineText', 'tagline'),
        f('Présentation', 'multilineText', 'blurb'),
        f('Présentation — accueil', 'multilineText', 'pitch', { help: 'Le court texte du bloc « Qui sommes-nous ».' }),
        f('Niveau', 'singleLineText', 'level'),
        f('Note', 'singleLineText', 'rating', { edit: 'orbit', help: 'Ex. « 4,9 · +1 880 avis ». Seulement avec une source vérifiable.' }),
        f('Site web', 'url', 'website'), f('Domaine', 'singleLineText', 'domain'),
        f('Page contact', 'url', 'contactUrl'),
        f('Lien de réservation', 'url', 'bookingUrl', { help: 'Le site y ajoute le suivi (UTM).' }),
        fLines('Pour qui', 'forWho'), fLines('Pas pour vous si', 'notIf'),
        f('Comparatif — texte', 'multilineText', 'cmpText', { help: 'Page /comparatif.' }),
        f('Comparatif — idéal pour', 'singleLineText', 'cmpIdeal'),
        f('Comparatif — mode', 'singleLineText', 'cmpMode'),
      ],
    },
    {
      name: N.guide, id: 'guides', primary: 'Prénom', key: 'Clé', client: 'own',
      about: 'Un guide : sa page /guides/…, sa photo, son histoire.',
      fields: [
        f('Prénom', 'singleLineText', 'first'), f('Clé', 'singleLineText', 'key', { edit: 'tech', help: 'Adresse de la page (/guides/clé).' }),
        fLink(N.operator_one, 'operator', N.operator, { single: true, edit: 'orbit' }),
        f('Nom complet', 'singleLineText', 'fullName'),
        f('Photo', 'url', 'photo', { help: 'Lien du portrait.' }),
        f('Rôle', 'singleLineText', 'role'), f('Bio', 'multilineText', 'bio'),
        fItems('Repères', 'facts', { icon: 'icon', label: 'label', value: 'value' }),
        f('Histoire', 'multilineText', 'story', { help: 'Sa phrase, à la première personne.' }),
        f('Pourquoi avec ce guide', 'multilineText', 'why'),
      ],
    },
    {
      name: N.offer, id: 'offers', primary: 'Nom', key: 'Slug', client: 'own',
      about: 'La sortie guidée d\'un opérateur, rattachée à son lieu principal.',
      fields: [
        f('Nom', 'singleLineText', 'name', { group: 'Contenu' }),
        f('Slug', 'singleLineText', 'key', { group: 'Contenu', edit: 'tech' }),
        fLink(N.operator_one, 'operator', N.operator, { single: true, group: 'Contenu', edit: 'orbit' }),
        fLink(N.listing_one, 'listing', N.listing, { single: true, group: 'Contenu', edit: 'orbit', help: 'Le lieu principal de la sortie.' }),
        f('Résumé', 'multilineText', 'summary', { group: 'Contenu' }),
        f('Prix adulte (€)', 'number', 'priceEur', { group: 'Prix et durée' }),
        f('Note de prix', 'singleLineText', 'priceNote', { group: 'Prix et durée', help: '« par adulte, tarif indicatif ».' }),
        f('Prix relevés en', 'singleLineText', 'priceDate', { group: 'Prix et durée', help: 'Mois et année (« septembre 2026 ») : affiché à côté du prix.' }),
        f('Durée', 'singleLineText', 'durationShort', { group: 'Prix et durée' }),
        f('Âge minimum', 'number', 'minAge', { group: 'Prix et durée' }),
        f('Départ', 'singleLineText', 'departShort', { group: 'Prix et durée' }),
        fItems('Points forts', 'features', { icon: 'icon', label: 'title', value: 'text' }, {}),
        fLines('Programme', 'programme', { group: 'Programme' }),
        fLines('Inclus', 'included', { group: 'Programme' }),
        fLines('À apporter', 'bring', { group: 'Programme' }),
        fItems('Infos pratiques', 'practical', { label: 'label', value: 'value' }, { nullable: true }),
        fMulti('À confirmer', 'estimated', opts(['included', 'bring'], { included: 'Inclus', bring: 'À apporter' }), { group: 'Programme' }),
      ],
    },
    {
      name: N.review, id: 'reviews', primary: 'Réf', key: 'Réf', client: 'comment',
      about: 'Un avis client réel, avec sa source dans « Auteur » (« Sandra, avis Google »).',
      fields: [
        f('Réf', 'singleLineText', 'id', { edit: 'orbit' }),
        fLink(N.operator_one, 'operator', N.operator, { single: true }), ORDER(),
        f('Citation', 'multilineText', 'quote'), f('Auteur', 'singleLineText', 'author'),
      ],
    },
    {
      name: N.image, id: 'images', primary: 'Réf', key: 'Réf', client: 'own',
      about: 'Une photo d\'un lieu, avec son crédit et ses droits.',
      fields: [
        f('Réf', 'singleLineText', 'id', { edit: 'orbit' }),
        fLink(N.listing_one, 'listing', N.listing, { single: true }), ORDER('Position dans la galerie (1 = photo principale).'),
        f('Lien de la photo', 'url', 'url'), f('Miniature', 'url', 'thumb'),
        f('Légende', 'singleLineText', 'caption'), f('Crédit', 'singleLineText', 'credit', { help: 'Obligatoire.' }),
        f('Licence', 'singleLineText', 'license'),
        fSelect('Droits', 'rights', v.rights, { edit: 'orbit' }),
        f('Source — nom', 'singleLineText', 'sourceName'), f('Source — page', 'url', 'sourcePage'),
        fSelect('Pertinence', 'relevance', v.relevance),
        f('Note', 'singleLineText', 'note'),
      ],
    },
    {
      name: N.source, id: 'sources', primary: 'Réf', key: 'Réf', client: 'read',
      about: 'Une source d\'information d\'un lieu.',
      fields: [
        f('Réf', 'singleLineText', 'id', { edit: 'orbit' }),
        fLink(N.listing_one, 'listing', N.listing, { single: true }), ORDER(),
        f('Nom', 'singleLineText', 'label'), f('Lien', 'url', 'url'),
        fSelect('Type', 'type', v.sourceTypes),
      ],
    },
    {
      name: N.article, id: 'articles', primary: 'Libellé', key: 'Slug', client: 'read',
      about: 'Une page « idée de sortie » (/idees/…) : textes et sélection de lieux.',
      fields: [
        f('Libellé', 'singleLineText', 'nav', { group: 'Contenu', help: 'Nom dans les menus.' }),
        f('Slug', 'singleLineText', 'slug', { group: 'Contenu', edit: 'tech' }), ORDER(),
        f("Fil d'Ariane", 'singleLineText', 'crumb', { group: 'Contenu' }),
        f('Catégorie', 'singleLineText', 'category', { group: 'Contenu' }),
        f('Icône', 'singleLineText', 'icon', { group: 'Contenu' }),
        f('Titre (H1)', 'singleLineText', 'title', { group: 'Contenu' }),
        f('Photo principale', 'url', 'heroImg', { group: 'Contenu' }),
        f('Crédit photo', 'singleLineText', 'heroCredit', { group: 'Contenu' }),
        f('Mis à jour le', 'date', 'updatedIso', { group: 'Contenu' }),
        f('Temps de lecture', 'singleLineText', 'readTime', { group: 'Contenu' }),
        f('Introduction', 'multilineText', 'intro', { group: 'Contenu' }),
        f('Réponse courte', 'multilineText', 'brief', { group: 'Contenu', help: 'La réponse en deux phrases (reprise par Google et les assistants IA).' }),
        f('Titre H2 — guide', 'singleLineText', 'guideH2', { group: 'Contenu' }),
        fItems('Bon à savoir', 'know', { label: 'label', value: 'value' }),
        f('Avant de partir', 'multilineText', 'before', { group: 'Contenu' }),
        fLines('Réponses rapides', 'quick', { group: 'Contenu' }),
        fLink(N.criterion, 'select', N.criterion, { group: 'Sélection', help: 'Les lieux qui ont au moins un de ces critères.' }),
        f('Sélection — libellé', 'singleLineText', 'selectionLabel', { group: 'Sélection' }),
        fLink(N.operator, 'operators', N.operator, { group: 'Sélection' }),
        fLink('Articles liés', 'related', N.article, { group: 'Sélection' }),
        f('Titre SEO', 'singleLineText', 'metaTitle', { group: 'SEO', help: '65 caractères maximum.' }),
        f('Description SEO', 'multilineText', 'metaDescription', { group: 'SEO', help: '155 caractères maximum.' }),
      ],
    },
    {
      name: N.section, id: 'sections', primary: 'Titre', client: 'read',
      about: 'Un bloc d\'article : point clé (en tête) ou section.',
      fields: [
        f('Titre', 'singleLineText', 'title'),
        fLink(N.article_one, 'article', N.article, { single: true }),
        fSelect('Genre', 'kind', [{ key: 'takeaway', label: 'Point clé' }, { key: 'section', label: 'Section' }]), ORDER(),
        fParagraphs('Texte', 'text'),
      ],
    },
    {
      name: N.faq, id: 'faq', primary: 'Question', client: 'comment',
      about: 'Une question-réponse d\'un article. (Celles des lieux sont calculées depuis leurs données.)',
      fields: [
        f('Question', 'singleLineText', 'q'), fLink(N.article_one, 'article', N.article, { single: true }), ORDER(),
        f('Réponse', 'multilineText', 'a'),
      ],
    },
    {
      name: N.post, id: 'posts', primary: 'Réf', key: 'Réf', client: 'read',
      about: 'Une publication sur un lieu : un article ou post existant, ou une vidéo à trouver (recherche).',
      fields: [
        f('Réf', 'singleLineText', 'id', { edit: 'orbit' }),
        fLink(N.listing_one, 'listing', N.listing, { single: true }),
        fSelect('Genre', 'kind', [{ key: 'post', label: 'Article ou post' }, { key: 'video', label: 'Vidéo (recherche)' }]), ORDER(),
        f('Plateforme', 'singleLineText', 'platform'), f('Compte', 'singleLineText', 'account'),
        f('Titre', 'singleLineText', 'title'), f('Date', 'singleLineText', 'date'),
        f('Texte', 'multilineText', 'text'), f('Lien', 'url', 'url'),
        f('Recherche', 'singleLineText', 'query', { help: 'Pour une vidéo : les mots cherchés sur la plateforme.' }),
      ],
    },
    {
      name: N.compare, id: 'compare', primary: 'Critère', key: 'Critère', client: 'read',
      about: 'Une ligne du tableau « Bateau ou kayak ? » (/comparatif).',
      fields: [f('Critère', 'singleLineText', 'label'), ORDER(), f('Bateau', 'multilineText', 'boat'), f('Kayak', 'multilineText', 'kayak')],
    },
    {
      name: N.copy, id: 'copy', primary: 'Clé', key: 'Clé', client: 'none',
      about: 'Un texte du site. Modifier « Texte » ou « Liste », jamais la clé.',
      fields: [
        f('Clé', 'singleLineText', 'key', { edit: 'tech' }), f('Page', 'singleLineText', 'page'),
        f('Texte', 'multilineText', 'text'),
        fItems('Liste', 'items', { icon: 'icon', label: 'title', value: 'text' }),
      ],
    },
  ];
}

// ---------- copy keys (site texts held in Airtable) ----------
const COPY = [
  { key: 'comparatif-titre', page: '/comparatif', get: (c: Content) => c.compare.title, set: (c: Content, r: any) => { c.compare.title = r.text ?? ''; } },
  { key: 'comparatif-intro', page: '/comparatif', get: (c: Content) => c.compare.intro, set: (c: Content, r: any) => { c.compare.intro = r.text ?? ''; } },
  { key: 'comparatif-bilan-titre', page: '/comparatif', get: (c: Content) => c.compare.summaryTitle, set: (c: Content, r: any) => { c.compare.summaryTitle = r.text ?? ''; } },
  { key: 'comparatif-bilan', page: '/comparatif', get: (c: Content) => c.compare.summary, set: (c: Content, r: any) => { c.compare.summary = r.text ?? ''; } },
  { key: 'pourquoi-un-guide', page: 'articles, listes', list: true, get: (c: Content) => c.articles.whyGuideTiles, set: (c: Content, r: any) => { c.articles.whyGuideTiles = r.items ?? []; } },
] as const;

// ---------- content → rows ----------
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const frDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

export function toTables(c: Content): Record<string, Row[]> {
  const T = Object.fromEntries(tables(c).map((t) => [t.id, t]));
  const rows = (id: string, recs: any[]) => recs.map((r) => toRow(T[id], r));
  const sites: any[] = c.db.sites;
  const ops: any[] = c.operators.operators;
  const arts: any[] = c.articles.articles;
  const cmpOps = new Map<string, any>((c.compare.operators ?? []).map((o: any) => [o.key, o]));

  const listings = [
    ...sites.map((s, i) => {
      const x = c.siteContent.sites[s.slug] ?? {};
      return {
        order: i + 1, slug: s.slug, name: s.name, status: s.status ?? 'published', statusNote: s.statusNote ?? null,
        confidence: s.confidence, island: s.island, zone: s.zone, communes: s.commune ? s.commune.split(' / ') : [],
        criteria: [...s.activities, ...FLAGS.filter((fl) => s[fl.flag]).map((fl) => fl.key)],
        difficulty: s.difficulty, duration: s.duration, distanceKm: s.distanceKm, access: s.access, protection: s.protection,
        operators: s.servedBy === 'both' ? ['yalode', 'bluelagoon'] : s.servedBy ? [s.servedBy] : [],
        lat: s.gps?.[0] ?? null, lng: s.gps?.[1] ?? null, blurb: s.blurb, paragraphs: s.paragraphs, facts: s.facts,
        imagesTodo: s.imagesTodo ?? null, internalNote: s.internalNote ?? null,
        h2: x.h2 ?? null, sig: x.sig ?? null, tip: x.tip ?? null, tipBy: x.tipBy ?? null, nameStory: x.nameStory ?? null, aka: x.aka ?? [],
        when: x.when ?? null, risks: x.risks ?? [], drive: x.drive ?? null, bus: x.bus ?? null, parking: x.parking ?? null, bag: x.bag ?? null, self: x.self ?? null,
        noteIcon: x.note?.icon ?? null, noteTitle: x.note?.title ?? null, noteText: x.note?.text ?? null,
        alertTitle: x.alert?.title ?? null, alertText: x.alert?.text ?? null, alertItems: x.alert?.items ?? [],
        estimated: x.estimated ?? [], estParas: x.estimatedParagraphs ? x.estimatedParagraphs.map((n: number) => n + 1).join(', ') : null,
      };
    }),
    ...(c.db.rejected ?? []).map((r: any, i: number) => ({ order: sites.length + i + 1, slug: `rejete-${slugify(r.name)}`, name: r.name, status: 'rejected', statusNote: r.reason, communes: [], criteria: [], protection: [], operators: [], paragraphs: [], facts: [], aka: [], risks: [], alertItems: [], estimated: [] })),
  ];

  return {
    listings: rows('listings', listings),
    localities: rows('localities', uniq(sites.flatMap((s) => (s.commune ? s.commune.split(' / ') : []))).sort((a, b) => a.localeCompare(b, 'fr')).map((name) => ({ name }))),
    criteria: rows('criteria', CRITERIA.map((cr, i) => ({ ...cr, order: i + 1 }))),
    operators: rows('operators', ops.map((o, i) => ({
      order: i + 1, key: o.key, name: o.name, kind: o.kind, mode: o.mode, credential: o.credential, tagline: o.tagline, blurb: o.blurb,
      pitch: o.about.pitch, level: o.about.level, rating: o.rating, website: o.about.website, domain: o.about.domain,
      contactUrl: o.contactUrl, bookingUrl: o.bookingUrl, forWho: o.forWho, notIf: o.notIf,
      cmpText: cmpOps.get(o.key)?.text ?? null, cmpIdeal: cmpOps.get(o.key)?.idealFor ?? null, cmpMode: cmpOps.get(o.key)?.mode ?? null,
    }))),
    guides: rows('guides', ops.map((o) => ({
      key: o.guideSlug, first: o.guide, operator: o.key, fullName: o.about.fullName, photo: o.photo, role: o.about.role, bio: o.about.bio,
      facts: o.about.facts, story: o.about.story, why: o.about.why,
    }))),
    offers: rows('offers', ops.map((o) => ({
      key: o.key, name: o.tourName, operator: o.key, listing: o.homeSiteSlug, summary: o.tourSummary, priceEur: o.priceEur, priceNote: o.priceNote,
      priceDate: o.priceDate, durationShort: o.durationShort, minAge: o.minAge, departShort: o.departShort, features: o.features,
      programme: o.programme, included: o.included, bring: o.bring, practical: o.practical, estimated: o.estimated,
    }))),
    reviews: rows('reviews', ops.flatMap((o) => o.quotes.map((q: any, i: number) => ({ id: `${o.key}-avis-${i + 1}`, operator: o.key, order: i + 1, ...q })))),
    images: rows('images', sites.flatMap((s) => s.images.map((im: any, i: number) => ({ id: `${s.slug}-photo-${i + 1}`, listing: s.slug, order: i + 1, ...im })))),
    sources: rows('sources', sites.flatMap((s) => s.sources.map((so: any, i: number) => ({ id: `${s.slug}-source-${i + 1}`, listing: s.slug, order: i + 1, ...so })))),
    articles: rows('articles', arts.map((a, i) => ({
      ...a, order: i + 1,
      select: Object.entries(a.select ?? {}).flatMap(([k, val]) => k === 'activities' ? (val as string[]) : val ? [FLAGS.find((fl) => fl.flag === k)?.key ?? k] : []),
    }))),
    sections: rows('sections', arts.flatMap((a) => [
      ...a.essentials.map((e: any, i: number) => ({ title: e.lead, article: a.slug, kind: 'takeaway', order: i + 1, text: [e.text] })),
      ...a.sections.map((s: any, i: number) => ({ title: s.title, article: a.slug, kind: 'section', order: i + 1, text: s.paragraphs })),
    ])),
    faq: rows('faq', arts.flatMap((a) => a.faq.map((q: any, i: number) => ({ ...q, article: a.slug, order: i + 1 })))),
    posts: rows('posts', [
      ...Object.entries(c.social.sites).flatMap(([slug, list]: any) => list.map((p: any, i: number) => ({ id: `${slug}-post-${i + 1}`, listing: slug, kind: 'post', order: i + 1, platform: p.platform, account: p.handle, date: p.date, text: p.caption, url: p.url }))),
      ...Object.entries(c.videos.sites).flatMap(([slug, list]: any) => list.map((p: any, i: number) => ({ id: `${slug}-video-${i + 1}`, listing: slug, kind: 'video', order: i + 1, platform: p.platform, account: p.author, title: p.title, query: p.q }))),
    ]),
    compare: rows('compare', c.compare.rows.map((r: any, i: number) => ({ ...r, order: i + 1 }))),
    copy: rows('copy', COPY.map((k) => ({ key: k.key, page: k.page, ...('list' in k ? { items: k.get(c) } : { text: k.get(c) }) }))),
  };
}

// ---------- rows → content ----------
/** Builds an object in a fixed key order. Modes: 'opt' = omitted when empty, 'null' = null when empty, 'str' = "" when empty, 'arr' = [] when empty, 'req' = as is. */
type Mode = 'opt' | 'null' | 'str' | 'arr' | 'req';
function obj(spec: [string, unknown, Mode][]) {
  const o: Record<string, unknown> = {};
  for (const [k, v, m] of spec) {
    if (m === 'opt' && isEmpty(v)) continue;
    o[k] = isEmpty(v) ? (m === 'null' ? null : m === 'str' ? '' : m === 'arr' ? [] : v ?? null) : v;
  }
  return o;
}
const byOrder = (a: any, b: any) => (a.order ?? 1e9) - (b.order ?? 1e9);

export function fromTables(logical: Record<string, Row[]>, base: Content, errors: string[]): Content | null {
  const before = errors.length;
  const T = Object.fromEntries(tables(base).map((t) => [t.id, t]));
  const recs = (id: string) => (logical[id] ?? []).map((row) => fromRow(T[id], row, () => ({}), errors)).sort(byOrder);
  const listings = recs('listings'), operators = recs('operators'), guides = recs('guides'), offers = recs('offers');
  const reviews = recs('reviews'), images = recs('images'), sources = recs('sources'), articles = recs('articles');
  const sections = recs('sections'), faq = recs('faq'), posts = recs('posts'), compare = recs('compare'), copy = recs('copy');
  const known = new Set(CRITERIA.map((cr) => cr.key));
  const childOf = (list: any[], field: string, key: string) => list.filter((r) => r[field] === key);
  const need = (cond: unknown, msg: string) => { if (!cond) errors.push(msg); };

  // Lieux
  const slugs = new Set<string>();
  const kept = listings.filter((l) => l.status !== 'rejected');
  for (const l of listings) {
    need(l.name, `${N.listing} : une ligne n'a pas de nom`);
    need(l.slug, `${N.listing} « ${l.name} » : Slug vide`);
    if (slugs.has(l.slug)) errors.push(`${N.listing} : le slug « ${l.slug} » apparaît deux fois`);
    slugs.add(l.slug);
    for (const k of l.criteria) if (!known.has(k)) errors.push(`${N.listing} « ${l.name} » : critère « ${k} » inconnu du site (à ajouter dans le code d'abord)`);
  }
  for (const l of kept) {
    need(l.island, `${N.listing} « ${l.name} » : Île vide`);
    need(l.communes.length, `${N.listing} « ${l.name} » : aucune commune`);
    need(l.confidence, `${N.listing} « ${l.name} » : Niveau de vérification vide`);
    if (l.operators.length > 2) errors.push(`${N.listing} « ${l.name} » : trois opérateurs ou plus, le site en gère deux au plus`);
  }
  const servedBy = (ops: string[]) => (ops.length === 2 ? 'both' : ops[0] ?? null);
  const sites = kept.map((l) => obj([
    ['slug', l.slug, 'req'], ['name', l.name, 'req'], ['island', l.island, 'req'], ['commune', l.communes.join(' / '), 'req'], ['zone', l.zone, 'null'],
    ['activities', l.criteria.filter((k: string) => ACTIVITIES.includes(k)), 'arr'], ['difficulty', l.difficulty, 'null'], ['duration', l.duration, 'null'],
    ['distanceKm', l.distanceKm, 'null'], ['access', l.access, 'null'],
    ...FLAGS.map((fl): [string, unknown, Mode] => [fl.flag, l.criteria.includes(fl.key), 'req']),
    ['protection', l.protection, 'arr'], ['servedBy', servedBy(l.operators), 'null'],
    ['gps', l.lat != null && l.lng != null ? [l.lat, l.lng] : null, 'null'], ['confidence', l.confidence, 'req'],
    ['facts', l.facts, 'arr'],
    ['sources', childOf(sources, 'listing', l.slug).map((s) => obj([['label', s.label, 'str'], ['url', s.url, 'str'], ['type', s.type, 'str']])), 'arr'],
    ['internalNote', l.internalNote, 'opt'],
    ['images', childOf(images, 'listing', l.slug).map((im) => obj([
      ['url', im.url, 'str'], ['thumb', im.thumb, 'str'], ['caption', im.caption, 'str'], ['credit', im.credit, 'str'], ['license', im.license, 'str'],
      ['rights', im.rights, 'str'], ['sourcePage', im.sourcePage, 'str'], ['sourceName', im.sourceName, 'str'], ['relevance', im.relevance, 'str'], ['note', im.note, 'opt'],
    ])), 'arr'],
    ['blurb', l.blurb, 'str'], ['paragraphs', l.paragraphs, 'arr'], ['imagesTodo', l.imagesTodo, 'opt'],
    ['status', l.status === 'published' ? null : l.status, 'opt'], ['statusNote', l.status === 'published' ? null : l.statusNote, 'opt'],
  ]));
  const db = {
    ...base.db, sites,
    rejected: listings.filter((l) => l.status === 'rejected').map((l) => ({ name: l.name, reason: l.statusNote ?? '' })),
  };
  const siteContent = {
    ...base.siteContent,
    sites: Object.fromEntries(kept.map((l) => {
      const paras = (l.estParas ?? '').split(/[,\s]+/).filter(Boolean).map((n: string) => Number(n) - 1);
      if (paras.some((n: number) => !Number.isInteger(n) || n < 0)) errors.push(`${N.listing} « ${l.name} » : « Paragraphes à confirmer » doit être une liste de numéros (« 1, 2 »)`);
      return [l.slug, obj([
        ['h2', l.h2, 'opt'], ['sig', l.sig, 'opt'], ['tip', l.tip, 'opt'], ['tipBy', l.tipBy, 'opt'], ['nameStory', l.nameStory, 'opt'], ['aka', l.aka, 'opt'],
        ['when', l.when, 'opt'], ['risks', l.risks, 'opt'], ['drive', l.drive, 'opt'], ['bus', l.bus, 'opt'], ['parking', l.parking, 'opt'], ['bag', l.bag, 'opt'],
        ['self', l.self, 'opt'],
        ['note', l.noteTitle || l.noteText ? obj([['icon', l.noteIcon, 'opt'], ['title', l.noteTitle, 'str'], ['text', l.noteText, 'str']]) : null, 'opt'],
        ['alert', l.alertTitle || l.alertText ? obj([['title', l.alertTitle, 'str'], ['text', l.alertText, 'str'], ['items', l.alertItems, 'opt']]) : null, 'opt'],
        ['estimated', l.estimated, 'opt'], ['estimatedParagraphs', paras, 'opt'],
      ])];
    })),
  };

  // Opérateurs + Guides + Sorties + Avis → one operator record each (the site's shape)
  const ops = operators.map((o) => {
    const g = guides.filter((x) => x.operator === o.key), t = offers.filter((x) => x.operator === o.key);
    if (g.length !== 1) errors.push(`${N.operator} « ${o.name} » : il faut exactement un guide dans « ${N.guide} » (trouvé : ${g.length})`);
    if (t.length !== 1) errors.push(`${N.operator} « ${o.name} » : il faut exactement une sortie dans « ${N.offer} » (trouvé : ${t.length})`);
    const gd = g[0] ?? {}, tr = t[0] ?? {};
    need(tr.priceEur != null, `${N.offer} « ${tr.name ?? o.name} » : Prix adulte vide`);
    need(tr.priceDate, `${N.offer} « ${tr.name ?? o.name} » : « Prix relevés en » vide (un prix porte toujours sa date)`);
    return obj([
      ['key', o.key, 'req'], ['name', o.name, 'req'], ['guide', gd.first, 'str'], ['guideSlug', gd.key, 'str'], ['photo', gd.photo, 'str'],
      ['kind', o.kind, 'str'], ['mode', o.mode, 'str'], ['credential', o.credential, 'str'], ['tagline', o.tagline, 'str'],
      ['priceEur', tr.priceEur, 'null'], ['price', tr.priceEur != null ? `${tr.priceEur} €` : null, 'null'], ['priceNote', tr.priceNote, 'str'], ['priceDate', tr.priceDate, 'str'],
      ['tourName', tr.name, 'str'], ['tourSummary', tr.summary, 'str'], ['blurb', o.blurb, 'str'],
      ['features', tr.features, 'arr'], ['programme', tr.programme, 'arr'], ['included', tr.included, 'arr'], ['bring', tr.bring, 'arr'], ['practical', tr.practical, 'arr'],
      ['rating', o.rating, 'null'],
      ['quotes', childOf(reviews, 'operator', o.key).map((q) => obj([['quote', q.quote, 'str'], ['author', q.author, 'str']])), 'arr'],
      ['bookingUrl', o.bookingUrl, 'str'], ['contactUrl', o.contactUrl, 'str'], ['homeSiteSlug', tr.listing, 'null'],
      ['durationShort', tr.durationShort, 'str'], ['minAge', tr.minAge, 'null'], ['departShort', tr.departShort, 'str'],
      ['forWho', o.forWho, 'arr'], ['notIf', o.notIf, 'arr'],
      ['about', obj([
        ['fullName', gd.fullName, 'str'], ['role', gd.role, 'str'], ['bio', gd.bio, 'str'], ['facts', gd.facts, 'arr'], ['story', gd.story, 'str'],
        ['why', gd.why, 'str'], ['pitch', o.pitch, 'str'], ['level', o.level, 'str'], ['website', o.website, 'str'], ['domain', o.domain, 'str'],
      ]), 'req'],
      ['estimated', tr.estimated, 'arr'],
    ]);
  });

  // Articles + sections + FAQ
  const flagOf = (k: string) => FLAGS.find((fl) => fl.key === k)?.flag;
  const arts = articles.map((a) => {
    const acts = a.select.filter((k: string) => ACTIVITIES.includes(k)), flags = a.select.filter((k: string) => !ACTIVITIES.includes(k));
    if (acts.length && flags.length) errors.push(`${N.article} « ${a.nav} » : sélection mêlant activités et public, le site ne sait pas la lire`);
    if (flags.length > 1) errors.push(`${N.article} « ${a.nav} » : un seul critère de public possible dans la sélection`);
    const mine = (kind: string) => sections.filter((s) => s.article === a.slug && s.kind === kind);
    return obj([
      ['slug', a.slug, 'req'], ['nav', a.nav, 'str'], ['crumb', a.crumb, 'str'], ['category', a.category, 'str'], ['icon', a.icon, 'str'],
      ['title', a.title, 'str'], ['metaTitle', a.metaTitle, 'str'], ['metaDescription', a.metaDescription, 'str'], ['heroImg', a.heroImg, 'str'],
      ['heroCredit', a.heroCredit, 'str'], ['updated', a.updatedIso ? frDate(a.updatedIso) : '', 'str'], ['updatedIso', a.updatedIso, 'str'],
      ['readTime', a.readTime, 'str'], ['intro', a.intro, 'str'], ['brief', a.brief, 'str'],
      ['essentials', mine('takeaway').map((s) => ({ lead: s.title ?? '', text: s.text.join('\n\n') })), 'arr'],
      ['guideH2', a.guideH2, 'str'],
      ['sections', mine('section').map((s) => ({ title: s.title ?? '', paragraphs: s.text })), 'arr'],
      ['select', acts.length ? { activities: acts } : flags.length ? { [flagOf(flags[0])!]: true } : {}, 'req'],
      ['selectionLabel', a.selectionLabel, 'str'], ['operators', a.operators, 'arr'], ['know', a.know, 'arr'], ['before', a.before, 'str'],
      ['faq', childOf(faq, 'article', a.slug).map((q) => ({ q: q.q ?? '', a: q.a ?? '' })), 'arr'],
      ['related', a.related, 'arr'], ['quick', a.quick, 'arr'],
    ]);
  });

  // Publications → social.json (posts) and videos.json (video searches), grouped by site in the directory's order
  const order = new Map(kept.map((l, i) => [l.slug, i]));
  const bySite = (kind: string, make: (p: any) => unknown) => Object.fromEntries(
    uniq(posts.filter((p) => p.kind === kind).map((p) => p.listing)).sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
      .map((slug) => [slug, posts.filter((p) => p.kind === kind && p.listing === slug).map(make)]));
  const social = { ...base.social, sites: bySite('post', (p) => obj([['platform', p.platform, 'str'], ['handle', p.account, 'str'], ['date', p.date, 'str'], ['caption', p.text, 'str'], ['url', p.url, 'str']])) };
  const videos = { ...base.videos, sites: bySite('video', (p) => obj([['platform', p.platform, 'str'], ['author', p.account, 'str'], ['title', p.title, 'str'], ['q', p.query, 'str']])) };

  // Comparatif + site texts
  const comparePage = {
    ...base.compare,
    operators: operators.filter((o) => o.cmpText).map((o) => ({ key: o.key, mode: o.cmpMode ?? '', text: o.cmpText, idealFor: o.cmpIdeal ?? '' })),
    rows: compare.map((r) => ({ label: r.label, boat: r.boat ?? '', kayak: r.kayak ?? '' })),
  };
  const out: Content = { ...base, db, siteContent, operators: { ...base.operators, operators: ops }, articles: { ...base.articles, articles: arts }, compare: comparePage, social, videos };
  for (const k of COPY) {
    const r = copy.find((x) => x.key === k.key);
    if (!r) errors.push(`${N.copy} : la clé « ${k.key} » manque`);
    else k.set(out, r);
  }
  // Keep the files' key order for the parts built from Airtable (articles.json: whyGuideTiles first, compare.json as before).
  out.articles = { _note: base.articles._note, whyGuideTiles: out.articles.whyGuideTiles, articles: out.articles.articles };
  out.compare = { _note: base.compare._note, title: out.compare.title, intro: out.compare.intro, operators: out.compare.operators, rows: out.compare.rows, summaryTitle: out.compare.summaryTitle, summary: out.compare.summary };
  return errors.length > before ? null : out;
}

/** Placeholder records for empty Cell values (re-exported for the scripts). */
export type { Row, Cell, Table, Field };
