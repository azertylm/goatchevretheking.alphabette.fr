/**
 * @file decadeFilters.ts
 * Moteur de filtrage temporel « décennie glissante » et filtre géographique.
 *
 * Principe : les carrières ne rentrent pas dans des cases de dix ans. On
 * propose donc des **fenêtres de 10 ans qui avancent par bonds de 5 ans** :
 * 1950-1960, 1955-1965, 1960-1970… 2015-2025. Un athlète est retenu dès que sa
 * carrière **chevauche** la fenêtre, même partiellement.
 *
 * Aucune dépendance à React : utilisable côté données comme côté interface.
 */

import type { AthleteProfile } from './athleteTypes';

export interface DecadeWindow {
  /** Identifiant stable, utilisable dans une URL ou un localStorage. */
  id: string;
  /** Première année de la fenêtre (incluse). */
  start: number;
  /** Dernière année de la fenêtre (incluse). */
  end: number;
  /** Libellé affiché : « 1950 – 1960 ». */
  label: string;
}

/** Fenêtre spéciale : aucune restriction d'époque. */
export const ALL_ERAS_ID = 'toutes';

/**
 * Génère les fenêtres décennales glissantes, par pas de 5 ans.
 *
 * Avec les valeurs par défaut (1920 → 2025) :
 * 1920-1930, 1925-1935, …, 2010-2020, 2015-2025.
 * La dernière fenêtre se termine exactement sur `maxYear`.
 */
export function generateDecadeWindows(minYear = 1920, maxYear = 2025): DecadeWindow[] {
  const span = 10;
  const step = 5;

  if (!Number.isFinite(minYear) || !Number.isFinite(maxYear) || maxYear < minYear) return [];

  const windows: DecadeWindow[] = [];
  for (let start = minYear; start + span <= maxYear; start += step) {
    windows.push({
      id: `${start}-${start + span}`,
      start,
      end: start + span,
      label: `${start} – ${start + span}`,
    });
  }

  return windows;
}

/** Fenêtres par défaut de l'application (calculées une seule fois). */
export const DECADE_WINDOWS: DecadeWindow[] = generateDecadeWindows();

/** Carrière minimale nécessaire aux filtres (compatible GoatPlayer). */
export interface CareerLike {
  careerStart?: number | null;
  careerEnd?: number | null;
  /** Ancien modèle (data/players.json) : conservé pour compatibilité. */
  startYear?: number | null;
  endYear?: number | null;
}

/** Années de carrière d'un profil, quel que soit le modèle de données. */
export function careerRange(player: CareerLike): { start: number; end: number } | null {
  const start = player.careerStart ?? player.startYear ?? null;
  const end = player.careerEnd ?? player.endYear ?? null;

  if (start === null && end === null) return null;
  // Une seule borne connue : on suppose une carrière d'une dizaine d'années.
  if (start === null) return { start: (end as number) - 10, end: end as number };
  if (end === null) return { start, end: start + 10 };

  return end >= start ? { start, end } : { start: end, end: start };
}

/**
 * Vrai si la carrière du joueur chevauche la fenêtre [start, end].
 * Un chevauchement partiel suffit (ex. carrière 1988-2002 ∩ 1995-2005).
 */
export function isPlayerInWindow(player: CareerLike, start: number, end: number): boolean {
  const range = careerRange(player);
  if (!range) return false;
  return range.start <= end && range.end >= start;
}

/** Filtre une liste d'athlètes sur une fenêtre décennale. */
export function filterByDecade<T extends CareerLike>(
  players: readonly T[],
  window: DecadeWindow | null,
): T[] {
  if (!window) return [...players];
  return players.filter((player) => isPlayerInWindow(player, window.start, window.end));
}

// --------------------------------------------------------------------------
// Filtre géographique
// --------------------------------------------------------------------------

export type GeoScope = 'monde' | 'national';

export const GEO_LABELS: Record<GeoScope, string> = {
  monde: '🌍 Mondial',
  national: '🇫🇷 National / Régional',
};

export interface GeoOptions {
  scope: GeoScope;
  /** Pays de référence pour « National / Régional » (ISO alpha-2). */
  homeCountry?: string;
}

/** Vrai si le profil appartient au périmètre géographique demandé. */
export function matchesGeo(
  player: { countryCode?: string | null },
  { scope, homeCountry = 'FR' }: GeoOptions,
): boolean {
  if (scope === 'monde') return true;
  const code = (player.countryCode ?? '').toUpperCase();
  return code === homeCountry.toUpperCase();
}

export function filterByGeo<T extends { countryCode?: string | null }>(
  players: readonly T[],
  options: GeoOptions,
): T[] {
  if (options.scope === 'monde') return [...players];
  return players.filter((player) => matchesGeo(player, options));
}

// --------------------------------------------------------------------------
// Filtre combiné (utilisé par la réserve)
// --------------------------------------------------------------------------

export interface AthleteFilter {
  /** Fenêtre décennale, ou null pour « Toutes les époques ». */
  window: DecadeWindow | null;
  scope: GeoScope;
  homeCountry?: string;
}

export function filterAthletes<T extends CareerLike & { countryCode?: string | null }>(
  players: readonly T[],
  { window, scope, homeCountry = 'FR' }: AthleteFilter,
): T[] {
  const byEra = window ? players.filter((player) => isPlayerInWindow(player, window.start, window.end)) : players;
  if (scope === 'monde') return [...byEra];
  return byEra.filter((player) => matchesGeo(player, { scope, homeCountry }));
}

/** Répartition par pays, pour l'affichage des compteurs du sélecteur. */
export function countByCountry(players: readonly AthleteProfile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const player of players) {
    const code = (player.countryCode ?? 'XX').toUpperCase();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}
