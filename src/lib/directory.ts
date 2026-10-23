// Home page (directory) model: hero, filter vocabularies, cards, metadata.
import { getOperator, getSites } from './data';
import { filterIsland, linkIfBuilt, routes } from './format';
import { siteCard } from './site-card';

export function buildDirectoryPage(siteUrl: string) {
  const sites = getSites();
  const cards = sites.map(siteCard);
  const islands = ['Guadeloupe', 'Marie-Galante'].filter((i) => sites.some((s) => filterIsland(s) === i));
  const ops = [getOperator('yalode'), getOperator('bluelagoon')];
  const title = 'Mangroves de Guadeloupe : où et comment les visiter';
  const description = 'Toutes les mangroves de Guadeloupe et Marie-Galante : en bateau, en kayak ou à pied.';
  const canonical = new URL('/', siteUrl).href;

  return {
    title,
    description,
    canonical,
    hero: {
      label: 'Répertoire indépendant des mangroves de Guadeloupe',
      title: 'Découvrez les plus belles mangroves de Guadeloupe',
      lead: 'On répertorie les mangroves de l\'archipel, à pied, en kayak ou en bateau, et on vous y emmène sur les plus belles.',
      // Openly licensed (Wikimedia Commons): partner photos can disappear (the Blue Lagoon ones did in Oct 2026, OL-15).
      image: { src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mangrove%2C_Petit-Canal%2C_Grande-Terre%2C_Guadeloupe%2C_2010-03-28-.jpg?width=1600', alt: '', caption: 'Mangrove de Petit-Canal', credit: 'Wikimedia Commons' },
      // Ratings only where the operator has a real, sourced one (no invented ratings).
      guides: ops.map((o) => ({ href: linkIfBuilt(routes.guide(o.guideSlug)) || '#qui-sommes-nous', photo: o.photo, name: o.name, rating: o.rating ? o.rating.split(' · ')[0] : undefined })),
    },
    filters: {
      islands: islands.map((i) => ({ value: i, label: i })),
      activities: [
        { value: 'bateau', label: 'Bateau', icon: 'boat' },
        { value: 'kayak', label: 'Kayak', icon: 'waves' },
        { value: 'marche', label: 'À pied', icon: 'footprints' },
        { value: 'pedalo', label: 'Pédalo', icon: 'waves' },
      ],
      difficulties: [{ value: 'Facile', label: 'Facile' }, { value: 'Modérée', label: 'Modérée' }],
      more: [
        { value: 'kids', label: 'Adapté enfants', icon: 'users' },
        { value: 'birds', label: 'Observation oiseaux', icon: 'bird' },
        { value: 'photo', label: 'Photogénique', icon: 'sun' },
      ],
      sorts: [
        { value: 'pertinence', label: 'Pertinence' },
        { value: 'facile', label: 'Facile d’abord' },
        { value: 'familles', label: 'Familles d’abord' },
      ],
    },
    privacyHref: linkIfBuilt(routes.privacy),
    contacts: ops.map((o) => ({ guide: o.guide, url: o.contactUrl })),
    cards,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Mangroves Gwada', url: canonical, inLanguage: 'fr' },
      {
        '@context': 'https://schema.org', '@type': 'ItemList', name: 'Mangroves de Guadeloupe',
        itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: new URL(c.href, siteUrl).href })),
      },
    ],
  };
}

export type DirectoryPageModel = ReturnType<typeof buildDirectoryPage>;
