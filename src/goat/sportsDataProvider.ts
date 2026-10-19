/**
 * @file sportsDataProvider.ts
 * Accès aux bases d'athlètes, **une discipline à la fois**.
 *
 * Les fichiers `data/sports/<discipline>.json` sont découpés par Vite en autant
 * de modules séparés : `import()` ne charge en mémoire que la discipline
 * demandée (≈ 500 profils), jamais les 15 000. Un repli HTTP
 * (`/api/goat/sports/:sport`) permet de régénérer les données sans reconstruire
 * l'application.
 */

import type { AthleteProfile, SportDataset, SportsIndex } from './athleteTypes';
import { SPORTS, isSportId, getSport, type SportId } from './sportsCatalog';
import type { GoatPlayer } from './types';

// Modules JSON importés à la demande (un chunk par discipline).
// `blocklist.json` vit dans le même dossier mais n'est pas une base : exclu.
const datasetLoaders = import.meta.glob<SportDataset>(
  ['../../data/sports/*.json', '!../../data/sports/blocklist.json'],
  { import: 'default' },
);

const indexLoader = import.meta.glob<SportsIndex>('../../data/sports/index.json', {
  import: 'default',
});

const datasetCache = new Map<SportId, Promise<SportDataset>>();
let indexCache: Promise<SportsIndex> | null = null;

/** Chemin du module correspondant à une discipline, s'il existe. */
function loaderFor(sport: SportId) {
  const suffix = `/data/sports/${sport}.json`;
  const key = Object.keys(datasetLoaders).find((path) => path.endsWith(suffix));
  return key ? datasetLoaders[key] : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Base indisponible (HTTP ${response.status}).`);
  return (await response.json()) as T;
}

/**
 * Charge la base d'une discipline.
 * Le résultat (promesse) est mémorisé : les appels suivants sont instantanés.
 */
export function loadSportData(sport: SportId, force = false): Promise<SportDataset> {
  if (force) datasetCache.delete(sport);

  const cached = datasetCache.get(sport);
  if (cached) return cached;

  const loader = loaderFor(sport);
  const promise = (async () => {
    if (loader) {
      const dataset = await loader();
      return validateDataset(dataset, sport);
    }
    // Repli : données régénérées après le build, servies par le serveur.
    return validateDataset(await fetchJson<SportDataset>(`/api/goat/sports/${sport}`), sport);
  })();

  datasetCache.set(sport, promise);
  // Un échec ne doit pas rester en cache : on pourra réessayer.
  promise.catch(() => datasetCache.delete(sport));
  return promise;
}

function validateDataset(dataset: SportDataset | undefined, sport: SportId): SportDataset {
  if (!dataset || !Array.isArray(dataset.athletes)) {
    throw new Error(`Base de ${getSport(sport).shortLabel} indisponible.`);
  }
  return { ...dataset, sport };
}

/** Sommaire (effectifs par discipline), sans charger les profils. */
export function loadSportsIndex(): Promise<SportsIndex> {
  if (indexCache) return indexCache;

  const key = Object.keys(indexLoader)[0];
  const promise: Promise<SportsIndex> = (async () => {
    if (key) return indexLoader[key]();
    return fetchJson<SportsIndex>('/api/goat/sports');
  })();

  indexCache = promise;
  promise.catch(() => {
    indexCache = null;
  });
  return promise;
}

/** Sommaire construit localement (repli si `index.json` est absent). */
export async function loadSportsSummary(): Promise<Array<{ sport: SportId; label: string; count: number }>> {
  try {
    const index = await loadSportsIndex();
    return index.sports;
  } catch {
    return SPORTS.map((sport) => ({ sport: sport.id, label: sport.label, count: 0 }));
  }
}

/** Nombre d'athlètes connus pour une discipline (0 si la base est absente). */
export async function countAthletes(sport: SportId): Promise<number> {
  try {
    const index = await loadSportsIndex();
    return index.sports.find((entry) => entry.sport === sport)?.count ?? 0;
  } catch {
    return 0;
  }
}

// --------------------------------------------------------------------------
// Adaptation au modèle de l'application (pyramide, cartes, partage)
// --------------------------------------------------------------------------

const careerLabel = (athlete: AthleteProfile): string => {
  const { careerStart, careerEnd, isCurrentlyCompeting } = athlete;
  if (isCurrentlyCompeting || careerEnd >= new Date().getFullYear()) {
    return `${careerStart} - Présent`;
  }
  return careerStart === careerEnd ? `${careerStart}` : `${careerStart} - ${careerEnd}`;
};

/**
 * Convertit un profil d'athlète en joueur exploitable par la pyramide.
 * Les composants existants (carte, partage, controverse) restent inchangés.
 */
export function toGoatPlayer(athlete: AthleteProfile, sport: SportId): GoatPlayer {
  return {
    id: athlete.id,
    name: athlete.name,
    sport,
    image: athlete.imageUrl,
    commonsUrl: athlete.imageUrl,
    startYear: athlete.careerStart,
    endYear: athlete.isCurrentlyCompeting ? null : athlete.careerEnd,
    career: careerLabel(athlete),
    // La notoriété n'est pas publiée dans les bases par discipline : le
    // palmarès sert d'indice de prestige pour les classements (controverse).
    fame: athlete.trophiesCount,
    countryCode: athlete.countryCode,
    careerStart: athlete.careerStart,
    careerEnd: athlete.careerEnd,
    trophiesCount: athlete.trophiesCount,
    isLegend: athlete.isLegend,
    isCurrentlyCompeting: athlete.isCurrentlyCompeting,
    careerEstimated: athlete.careerEstimated,
  };
}

/** Charge une discipline et renvoie directement les joueurs prêts à l'emploi. */
export async function loadPlayersForSport(sport: SportId): Promise<GoatPlayer[]> {
  const dataset = await loadSportData(sport);
  return dataset.athletes.map((athlete) => toGoatPlayer(athlete, sport));
}

/** Liste des disciplines disposant réellement de données. */
export async function listAvailableSports(): Promise<SportId[]> {
  const index = await loadSportsIndex().catch(() => null);
  if (!index) return [];
  return index.sports.filter((entry) => entry.count > 0).map((entry) => entry.sport);
}

/** Vide le cache (utile après une régénération des données). */
export function clearSportsCache(): void {
  datasetCache.clear();
  indexCache = null;
}

export { isSportId };
