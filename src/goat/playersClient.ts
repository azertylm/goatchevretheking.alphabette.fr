import { GoatPlayer, PlayersPayload } from './types';
import { SportId } from './sports';
import { loadSportData, toGoatPlayer } from './sportsDataProvider';

/**
 * @file playersClient.ts
 * Base de joueurs d'un univers sportif.
 *
 * Deux sources, dans cet ordre :
 *  1. les bases par discipline (`data/sports/<sport>.json`), chargées à la
 *     demande et tenant compte des 30 sports ;
 *  2. l'ancienne base `/api/goat/players` (football et NBA historiques), en
 *     secours si la discipline n'a pas encore ses données.
 *
 * Le cache mémoire est partagé entre les deux sources.
 */

const cache = new Map<SportId, PlayersPayload>();

const legacyCounts = (sport: SportId, total: number): PlayersPayload['counts'] => ({
  football: sport === 'football' ? total : 0,
  nba: sport === 'nba' ? total : 0,
  total,
});

async function fetchLegacy(sport: SportId): Promise<PlayersPayload> {
  const response = await fetch(`/api/goat/players?sport=${sport}`, {
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || `Base de joueurs indisponible (HTTP ${response.status}).`,
    );
  }

  return payload as PlayersPayload;
}

export async function fetchPlayers(sport: SportId, force = false): Promise<PlayersPayload> {
  const cached = cache.get(sport);
  if (cached && !force) return cached;

  let payload: PlayersPayload;

  try {
    const dataset = await loadSportData(sport, force);
    const players = dataset.athletes.map((athlete) => toGoatPlayer(athlete, sport));
    payload = {
      generatedAt: dataset.generatedAt,
      source: dataset.source,
      license: dataset.license,
      counts: legacyCounts(sport, players.length),
      players,
    };
  } catch (error) {
    // Discipline sans données dédiées : on retombe sur l'ancienne base.
    if (sport !== 'football' && sport !== 'nba') throw error;
    payload = await fetchLegacy(sport);
  }

  cache.set(sport, payload);
  return payload;
}

export function getCachedPlayer(sport: SportId, playerId: string | null | undefined): GoatPlayer | undefined {
  if (!playerId) return undefined;
  return cache.get(sport)?.players.find((player) => player.id === playerId);
}

export function clearPlayersCache(): void {
  cache.clear();
}
