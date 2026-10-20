import { careerRange } from './decadeFilters';
import { GamesState, GameModeId } from './gameModes';
import { SPORTS, SportId, getSport } from './sportsCatalog';
import { readPyramidProgress } from './pyramidModel';
import { GoatPlayer } from './types';

/**
 * @file collector.ts
 * Lectures dérivées pour la vitrine du joueur : badges de décennies, tableau
 * d'honneur des records et bilan de carrière. Aucune écriture ici : tout est
 * recalculé à partir des magasins existants (pyramides, jeux, Crottins).
 */

/** Décennies couvertes par l'application (début de carrière). */
export const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;

export type DecadeTier = 'none' | 'bronze' | 'or';

export interface DecadeBadge {
  decade: number;
  label: string;
  count: number;
  tier: DecadeTier;
}

/** Seuils : 1 joueur = bronze, 3 joueurs = or. */
const GOLD_THRESHOLD = 3;

/**
 * Badges de décennies de la pyramide active : un badge est obtenu dès qu'un
 * joueur dont la carrière démarre dans la décennie est placé dans la pyramide.
 */
export function decadeBadges(
  assignments: Record<string, string>,
  players: readonly GoatPlayer[],
): DecadeBadge[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const counts = new Map<number, number>();

  for (const playerId of Object.values(assignments)) {
    if (!playerId) continue;
    const player = byId.get(playerId);
    if (!player) continue;
    const range = careerRange(player);
    if (!range) continue;
    const decade = Math.floor(range.start / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }

  return DECADES.map((decade) => {
    const count = counts.get(decade) ?? 0;
    return {
      decade,
      label: `${decade}`,
      count,
      tier: count >= GOLD_THRESHOLD ? 'or' : count >= 1 ? 'bronze' : 'none',
    };
  });
}

/** Nombre de décennies explorées (badge bronze au minimum). */
export function exploredDecades(badges: readonly DecadeBadge[]): number {
  return badges.filter((badge) => badge.tier !== 'none').length;
}

export interface HonorRow {
  sport: SportId;
  sportLabel: string;
  emoji: string;
  score: number;
  at: number;
}

/**
 * Tableau d'honneur d'un mode : les trois meilleurs records de l'utilisateur,
 * toutes disciplines confondues. Les scores d'un même mode sont comparables
 * entre eux (duels, points, maillons, votes conformes).
 */
export function honorBoard(games: GamesState, mode: GameModeId): HonorRow[] {
  return Object.entries(games.best)
    .filter(([key]) => key.startsWith(`${mode}:`))
    .map(([key, record]) => {
      const sport = key.slice(mode.length + 1) as SportId;
      const definition = getSport(sport);
      return {
        sport,
        sportLabel: definition.shortLabel,
        emoji: definition.emoji,
        score: record.score,
        at: record.at,
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, 3);
}

/** Nombre de disciplines où la pyramide est complète. */
export function completedPyramids(): number {
  return SPORTS.filter((sport) => readPyramidProgress(sport.id).complete).length;
}

/** Nombre total de places remplies, toutes disciplines confondues. */
export function totalPlacedPlayers(): number {
  let total = 0;
  for (const sport of SPORTS) {
    total += readPyramidProgress(sport.id).filled;
  }
  return total;
}

export interface CareerStats {
  /** Parties jouées, tous modes confondus. */
  plays: number;
  /** Disciplines jouées au moins une fois. */
  sportsPlayed: number;
  /** Série de jours en cours / record. */
  dayStreak: number;
  bestDayStreak: number;
  /** Pyramides complètes. */
  completed: number;
  /** Places remplies, toutes disciplines. */
  placed: number;
  /** Dernière partie (millisecondes) ou null. */
  lastPlayedAt: number | null;
}

export function careerStats(games: GamesState): CareerStats {
  const plays = Object.values(games.plays).reduce((total, count) => total + count, 0);
  const sportsPlayed = new Set(
    Object.keys(games.best)
      .map((key) => key.split(':')[1])
      .filter(Boolean),
  ).size;
  const lastPlayedAt = games.history[0]?.at ?? null;
  return {
    plays,
    sportsPlayed,
    dayStreak: games.streak.count,
    bestDayStreak: games.streak.best,
    completed: completedPyramids(),
    placed: totalPlacedPlayers(),
    lastPlayedAt,
  };
}

/** Libellé court d'un mode de jeu. */
export const MODE_LABELS: Record<GameModeId, string> = {
  chrono: 'Défi Chrono',
  epoques: "Duels d'époques",
  'duel-du-jour': 'Duel du jour',
  quiz: 'Trouve le GOAT',
  bouc: 'Bouc Émissaire',
};

/** Date lisible et courte (« 20 oct. 2026 »). */
export function formatShortDate(at: number): string {
  try {
    return new Date(at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
