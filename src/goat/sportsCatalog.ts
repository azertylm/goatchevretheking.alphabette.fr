/**
 * @file sportsCatalog.ts
 * Catalogue des disciplines de Goat Chèvre The King.
 *
 * Source unique : l'application (sélecteur d'univers, libellés) et le
 * générateur de données (scripts/generate-sports-data.ts) lisent tous deux ce
 * fichier. Ajouter une discipline = ajouter une entrée ici, puis relancer
 * `bun run generate:sports`.
 *
 * `wikidata` est la classe d'occupation Wikidata (P106) utilisée pour
 * l'extraction : elle n'est jamais affichée à l'utilisateur.
 */

export interface SportDefinition {
  /** Identifiant technique (union fermée, voir `SportId`). */
  id: string;
  /** Libellé complet (desktop). */
  label: string;
  /** Libellé court (mobile, pastilles). */
  shortLabel: string;
  emoji: string;
  tagline: string;
  /** Classe d'occupation Wikidata (P106). */
  wikidata: string;
}

export const SPORTS = [
  {
    id: 'football',
    label: 'Football International',
    shortLabel: 'Football',
    emoji: '⚽',
    tagline: 'Légendes des sélections et des grands clubs',
    wikidata: 'Q937857',
  },
  {
    id: 'nba',
    label: 'Basketball NBA',
    shortLabel: 'Basket',
    emoji: '🏀',
    tagline: 'Légendes de la ligue nord-américaine',
    wikidata: 'Q3665646',
  },
  {
    id: 'tennis',
    label: 'Tennis',
    shortLabel: 'Tennis',
    emoji: '🎾',
    tagline: 'Roland-Garros, Wimbledon et les maîtres du Grand Chelem',
    wikidata: 'Q10833314',
  },
  {
    id: 'swimming',
    label: 'Natation',
    shortLabel: 'Natation',
    emoji: '🏊',
    tagline: 'Bassins olympiques et records du monde',
    wikidata: 'Q10843402',
  },
  {
    id: 'table-tennis',
    label: 'Tennis de table',
    shortLabel: 'Ping-pong',
    emoji: '🏓',
    tagline: 'Top spin, blocs et finales olympiques',
    wikidata: 'Q13382519',
  },
  {
    id: 'rugby',
    label: 'Rugby',
    shortLabel: 'Rugby',
    emoji: '🏉',
    tagline: 'Tournoi des Six Nations et Coupes du monde',
    wikidata: 'Q14089670',
  },
  {
    id: 'handball',
    label: 'Handball',
    shortLabel: 'Handball',
    emoji: '🤾',
    tagline: 'Champions d’Europe, Mondiaux et JO',
    wikidata: 'Q12840545',
  },
  {
    id: 'athletics',
    label: 'Athlétisme',
    shortLabel: 'Athlé',
    emoji: '🏃',
    tagline: 'Sprint, fond, sauts et lancers',
    wikidata: 'Q11513337',
  },
  {
    id: 'cycling',
    label: 'Cyclisme',
    shortLabel: 'Cyclisme',
    emoji: '🚴',
    tagline: 'Grands Tours, classiques et maillots jaunes',
    wikidata: 'Q2309784',
  },
  {
    id: 'judo',
    label: 'Judo',
    shortLabel: 'Judo',
    emoji: '🥋',
    tagline: 'Tatamis olympiques et ceintures noires',
    wikidata: 'Q6665249',
  },
  {
    id: 'boxing',
    label: 'Boxe',
    shortLabel: 'Boxe',
    emoji: '🥊',
    tagline: 'Poids lourds, légendes du ring et ceintures',
    wikidata: 'Q11338576',
  },
  {
    id: 'f1',
    label: 'Formule 1',
    shortLabel: 'F1',
    emoji: '🏎️',
    tagline: 'Pilotes, titres mondiaux et pole positions',
    wikidata: 'Q10841764',
  },
  {
    id: 'volleyball',
    label: 'Volley-ball',
    shortLabel: 'Volley',
    emoji: '🏐',
    tagline: 'Filet haut, smashs et finales mondiales',
    wikidata: 'Q15117302',
  },
  {
    id: 'golf',
    label: 'Golf',
    shortLabel: 'Golf',
    emoji: '⛳',
    tagline: 'Majeurs, Ryder Cup et greens légendaires',
    wikidata: 'Q11303721',
  },
  {
    id: 'ice-hockey',
    label: 'Hockey sur glace',
    shortLabel: 'Hockey',
    emoji: '🏒',
    tagline: 'NHL, patinoires et Coupes Stanley',
    wikidata: 'Q11774891',
  },
  {
    id: 'cricket',
    label: 'Cricket',
    shortLabel: 'Cricket',
    emoji: '🏏',
    tagline: 'Ashes, Coupes du monde et guichets',
    wikidata: 'Q12299841',
  },
  {
    id: 'badminton',
    label: 'Badminton',
    shortLabel: 'Badminton',
    emoji: '🏸',
    tagline: 'Volants, smashes et tournois majeurs',
    wikidata: 'Q13141064',
  },
  {
    id: 'gymnastics',
    label: 'Gymnastique',
    shortLabel: 'Gym',
    emoji: '🤸',
    tagline: 'Agrès, figures et notes parfaites',
    wikidata: 'Q13381572',
  },
  {
    id: 'fencing',
    label: 'Escrime',
    shortLabel: 'Escrime',
    emoji: '🤺',
    tagline: 'Fleuret, épée et sabre',
    wikidata: 'Q13381863',
  },
  {
    id: 'rowing',
    label: 'Aviron',
    shortLabel: 'Aviron',
    emoji: '🚣',
    tagline: 'Rameurs, huit de pointe et bassins olympiques',
    wikidata: 'Q13382576',
  },
  {
    id: 'weightlifting',
    label: 'Haltérophilie',
    shortLabel: 'Haltéro',
    emoji: '🏋️',
    tagline: 'Arraché, épaulé-jeté et records du monde',
    wikidata: 'Q13381376',
  },
  {
    id: 'wrestling',
    label: 'Lutte',
    shortLabel: 'Lutte',
    emoji: '🤼',
    tagline: 'Grâce, gréco-romaine et tapis olympiques',
    wikidata: 'Q12369333',
  },
  {
    id: 'alpine-skiing',
    label: 'Ski alpin',
    shortLabel: 'Ski',
    emoji: '⛷️',
    tagline: 'Descentes, slaloms et globes de cristal',
    wikidata: 'Q4144610',
  },
  {
    id: 'snowboarding',
    label: 'Snowboard',
    shortLabel: 'Snow',
    emoji: '🏂',
    tagline: 'Half-pipe, slopestyle et big air',
    wikidata: 'Q15709642',
  },
  {
    id: 'figure-skating',
    label: 'Patinage artistique',
    shortLabel: 'Patinage',
    emoji: '⛸️',
    tagline: 'Programmes libres, quadruples et podiums',
    wikidata: 'Q13219587',
  },
  {
    id: 'speed-skating',
    label: 'Patinage de vitesse',
    shortLabel: 'Vitesse',
    emoji: '🛼',
    tagline: 'Anneaux de glace et sprints de légende',
    wikidata: 'Q10866633',
  },
  {
    id: 'equestrian',
    label: 'Sports équestres',
    shortLabel: 'Équitation',
    emoji: '🐎',
    tagline: 'Dressage, saut d’obstacles et concours complet',
    wikidata: 'Q2730732',
  },
  {
    id: 'sailing',
    label: 'Voile',
    shortLabel: 'Voile',
    emoji: '⛵',
    tagline: 'Régates, America’s Cup et tours du monde',
    // « sailor » (Q45199) désigne les marins professionnels ; on vise le
    // pratiquant de voile sportive (Q476246).
    wikidata: 'Q476246',
  },
  {
    id: 'archery',
    label: 'Tir à l’arc',
    shortLabel: 'Tir à l’arc',
    emoji: '🏹',
    tagline: 'Cibles, arcs olympiques et précision',
    wikidata: 'Q13382355',
  },
  {
    id: 'shooting',
    label: 'Tir sportif',
    shortLabel: 'Tir',
    emoji: '🎯',
    tagline: 'Carabines, pistolets et finales olympiques',
    wikidata: 'Q17486376',
  },
] as const satisfies readonly SportDefinition[];

/** Identifiant d'une discipline (union fermée, dérivée du catalogue). */
export type SportId = (typeof SPORTS)[number]['id'];

export const SPORT_IDS: SportId[] = SPORTS.map((sport) => sport.id);

export const getSport = (id: SportId): SportDefinition =>
  (SPORTS.find((sport) => sport.id === id) ?? SPORTS[0]) as SportDefinition;

export const isSportId = (value: unknown): value is SportId =>
  typeof value === 'string' && SPORTS.some((sport) => sport.id === value);

/** Nom de fichier de la base de données de la discipline. */
export const sportDataFile = (id: SportId): string => `data/sports/${id}.json`;
