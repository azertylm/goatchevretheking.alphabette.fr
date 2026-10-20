import { useSyncExternalStore } from 'react';
import { careerRange } from './decadeFilters';
import { SportId } from './sports';
import { GoatPlayer } from './types';
import type { PyramidApi } from './usePyramidState';

/**
 * @file gameModes.ts
 * Socle commun des modes de jeu (« Les jeux du pâturage ») :
 *  - records par discipline et compteur de parties ;
 *  - série de jours consécutifs (Duel du jour) ;
 *  - tirages reproductibles (PRNG à graine) : le Duel du jour est le même
 *    pour tous les visiteurs d'une même journée ;
 *  - pronostic du classement standard (notoriété Wikidata) ;
 *  - appariements « d'époques » (joueurs d'extrémités opposées de la carrière).
 *
 * Persistance : localStorage `goat_games_v1` — clé dédiée, qui n'écrase ni
 * `goat_pyramid_*`, ni `goat_progression_v1`, ni `goat_panini_v1`, ni
 * `goat_sport_v1`.
 */

export type GameModeId = 'chrono' | 'epoques' | 'duel-du-jour' | 'quiz' | 'bouc';

export interface GameRecord {
  /** Meilleur score enregistré. */
  score: number;
  /** Date du meilleur score (millisecondes). */
  at: number;
}

export interface DailyVote {
  day: string;
  sport: SportId;
  /** Identifiant du joueur choisi ce jour-là. */
  choiceId: string;
}

/** Partie terminée, conservée pour l'historique local (« Rejouer »). */
export interface GameHistoryEntry {
  mode: GameModeId;
  sport: SportId;
  score: number;
  at: number;
}

export interface GamesState {
  /** Meilleur score par entrée `${mode}:${sport}`. */
  best: Record<string, GameRecord>;
  /** Nombre de parties jouées par mode (toutes disciplines). */
  plays: Record<string, number>;
  /** Série de jours consécutifs avec un Duel du jour voté. */
  streak: { count: number; best: number; lastDay: string | null };
  /** Votes du Duel du jour, par entrée `${jour}:${sport}`. */
  dailyVotes: Record<string, DailyVote>;
  /** Dernières parties (la plus récente en tête, 30 au maximum). */
  history: GameHistoryEntry[];
}

/** Propriétés communes à tous les modes de jeu. */
export interface GameModeProps {
  /** Discipline active. */
  sport: SportId;
  /** Joueurs de la discipline active (base complète). */
  pool: GoatPlayer[];
  /** API de la pyramide (placement des vainqueurs au sommet). */
  api: PyramidApi;
}

const STORAGE_KEY = 'goat_games_v1';

const EMPTY_STATE: GamesState = {
  best: {},
  plays: {},
  streak: { count: 0, best: 0, lastDay: null },
  dailyVotes: {},
  history: [],
};

function parseHistory(value: unknown): GameHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: GameHistoryEntry[] = [];
  for (const entry of value.slice(0, 30)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Partial<GameHistoryEntry>;
    if (typeof record.sport !== 'string' || typeof record.mode !== 'string') continue;
    const score = Math.max(0, Math.floor(Number(record.score) || 0));
    const at = Math.max(0, Math.floor(Number(record.at) || 0));
    if (!at) continue;
    entries.push({ mode: record.mode as GameModeId, sport: record.sport as SportId, score, at });
  }
  return entries;
}

function load(): GamesState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const data = JSON.parse(raw) as Partial<GamesState>;
    return {
      best: data.best && typeof data.best === 'object' ? data.best : {},
      plays: data.plays && typeof data.plays === 'object' ? data.plays : {},
      streak: {
        count: Math.max(0, Math.floor(Number(data.streak?.count) || 0)),
        best: Math.max(0, Math.floor(Number(data.streak?.best) || 0)),
        lastDay: typeof data.streak?.lastDay === 'string' ? data.streak.lastDay : null,
      },
      dailyVotes:
        data.dailyVotes && typeof data.dailyVotes === 'object' ? data.dailyVotes : {},
      history: parseHistory((data as Partial<GamesState>).history),
    };
  } catch {
    return EMPTY_STATE;
  }
}

let state: GamesState = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Navigation privée / quota : le store en mémoire reste valable.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GamesState {
  return state;
}

/** Réactivité React sur le magasin des modes de jeu. */
export function useGamesState(): GamesState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --------------------------------------------------------------------------
// Records
// --------------------------------------------------------------------------

const recordKey = (mode: GameModeId, sport: SportId): string => `${mode}:${sport}`;

/** Meilleur score d'un mode pour une discipline (0 si jamais joué). */
export function bestScore(mode: GameModeId, sport: SportId, snapshot?: GamesState): number {
  const source = snapshot ?? state;
  return source.best[recordKey(mode, sport)]?.score ?? 0;
}

/** Enregistre le score d'une partie : meilleur score + compteur de parties. */
export function recordGame(mode: GameModeId, sport: SportId, score: number): void {
  const safeScore = Math.max(0, Math.round(score));
  const key = recordKey(mode, sport);
  const previous = state.best[key];
  const best =
    previous && previous.score >= safeScore ? previous : { score: safeScore, at: Date.now() };

  state = {
    ...state,
    best: { ...state.best, [key]: best },
    plays: { ...state.plays, [mode]: (state.plays[mode] ?? 0) + 1 },
    history: [{ mode, sport, score: safeScore, at: Date.now() }, ...state.history].slice(0, 30),
  };
  persist();
  emit();
}

// --------------------------------------------------------------------------
// Duel du jour : jours, série, votes
// --------------------------------------------------------------------------

/** Clé de jour locale (« 2026-10-19 ») — minuit local, pas UTC. */
export function dayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Décale une clé de jour de `delta` jours (négatif accepté). */
export function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(year, (month || 1) - 1, date || 1);
  value.setDate(value.getDate() + delta);
  return dayKey(value);
}

/** Jour lisible en français (« mardi 13 octobre »). */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Vote déjà enregistré pour ce jour et cette discipline. */
export function dailyVoteFor(day: string, sport: SportId, snapshot?: GamesState): DailyVote | null {
  const source = snapshot ?? state;
  return source.dailyVotes[`${day}:${sport}`] ?? null;
}

/**
 * Enregistre le vote du jour et met à jour la série.
 * Le premier vote d'une journée prolonge la série ; les suivants (autres
 * disciplines) ne la comptent qu'une fois.
 */
export function registerDailyVote(day: string, sport: SportId, choiceId: string): void {
  const key = `${day}:${sport}`;
  if (state.dailyVotes[key]) return;

  let count = state.streak.count;
  if (state.streak.lastDay !== day) {
    count = state.streak.lastDay === shiftDay(day, -1) ? state.streak.count + 1 : 1;
  }

  state = {
    ...state,
    dailyVotes: { ...state.dailyVotes, [key]: { day, sport, choiceId } },
    streak: { count, best: Math.max(state.streak.best, count), lastDay: day },
  };
  persist();
  emit();
}

// --------------------------------------------------------------------------
// Tirages reproductibles
// --------------------------------------------------------------------------

/** Empreinte FNV-1a d'une chaîne (graine de tirage). */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange (Fisher-Yates) piloté par un générateur. */
export function shuffleWith<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

// --------------------------------------------------------------------------
// Classement standard (prestige) et pronostics
// --------------------------------------------------------------------------

/** Nom affiché du classement de référence (à garder identique partout). */
export const STANDARD_RANKING_LABEL = 'classement standard (palmarès recensé)';

/**
 * Prestige d'un joueur au **classement standard**.
 *
 * Les bases par discipline ne publient pas la notoriété Wikipédia : le palmarès
 * recensé (`trophiesCount`) est le seul indice de prestige disponible, et il est
 * très souvent nul (plusieurs centaines de carrières sans trophée recensé par
 * discipline). Les critères secondaires — marque « légende », puis longévité —
 * donnent un classement **total et stable**, au lieu d'égalités tranchées par
 * l'ordre alphabétique.
 */
export function standardScore(player: GoatPlayer): number {
  const trophies = Math.max(0, player.trophiesCount ?? player.fame ?? 0);
  const legend = player.isLegend ? 1 : 0;
  const range = careerRange(player);
  const span = range ? Math.max(0, range.end - range.start) : 0;
  return trophies * 1_000_000 + legend * 100_000 + Math.min(99_999, span * 100);
}

/** Classement standard : prestige décroissant (1 = le plus prestigieux). */
export function consensusRanking(players: readonly GoatPlayer[]): GoatPlayer[] {
  return [...players].sort((a, b) => {
    const delta = standardScore(b) - standardScore(a);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name, 'fr');
  });
}

/** Rang standard (1 = le plus notoire) par identifiant de joueur. */
export function consensusRanks(players: readonly GoatPlayer[]): Map<string, number> {
  return new Map(consensusRanking(players).map((player, index) => [player.id, index + 1]));
}

/**
 * Pronostic du classement standard, en pourcentage pour le joueur de gauche.
 * Borné à 50–96 % : un duel n'est jamais joué d'avance, jamais parfaitement égal.
 */
export function forecastPercent(left: GoatPlayer, right: GoatPlayer): number {
  const a = Math.max(1, standardScore(left));
  const b = Math.max(1, standardScore(right));
  const share = a / (a + b);
  return Math.max(50, Math.min(96, Math.round(50 + (share - 0.5) * 92)));
}

/** Vainqueur du classement standard d'un face-à-face. */
export function standardWinner(left: GoatPlayer, right: GoatPlayer): GoatPlayer {
  const delta = standardScore(right) - standardScore(left);
  if (delta !== 0) return delta > 0 ? right : left;
  return left.name.localeCompare(right.name, 'fr') <= 0 ? left : right;
}

// --------------------------------------------------------------------------
// Époques
// --------------------------------------------------------------------------

/** Décennie de début de carrière (1990, 2000…), ou null si inconnue. */
export function decadeOf(player: GoatPlayer): number | null {
  const range = careerRange(player);
  if (!range) return null;
  return Math.floor(range.start / 10) * 10;
}

/** Écart d'années entre les débuts de carrière (null si non daté). */
export function eraDistance(left: GoatPlayer, right: GoatPlayer): number | null {
  const a = careerRange(left);
  const b = careerRange(right);
  if (!a || !b) return null;
  return Math.abs(a.start - b.start);
}

/**
 * Appariements « d'époques » : chaque duel oppose un joueur du tiers le plus
 * ancien à un joueur du tiers le plus récent, en privilégiant les visages
 * connus (notoriété) à chaque extrémité.
 */
export function eraPairs(
  pool: readonly GoatPlayer[],
  count: number,
  random: () => number = Math.random,
): Array<[GoatPlayer, GoatPlayer]> {
  const dated = pool.filter((player) => careerRange(player) !== null);
  if (dated.length < 4) return [];

  const ordered = [...dated].sort((a, b) => {
    const startA = careerRange(a)?.start ?? 0;
    const startB = careerRange(b)?.start ?? 0;
    return startA - startB || a.id.localeCompare(b.id);
  });

  const third = Math.max(1, Math.floor(ordered.length / 3));
  const oldest = ordered.slice(0, third);
  const newest = ordered.slice(-third);
  const window = Math.max(count + 4, 12);
  const byPrestige = (list: GoatPlayer[]) =>
    [...list].sort((a, b) => standardScore(b) - standardScore(a)).slice(0, window);

  const lefts = shuffleWith(byPrestige(oldest), random);
  const rights = shuffleWith(byPrestige(newest), random);

  const pairs: Array<[GoatPlayer, GoatPlayer]> = [];
  const used = new Set<string>();
  for (const left of lefts) {
    if (pairs.length >= count) break;
    const right = rights.find((candidate) => candidate.id !== left.id && !used.has(candidate.id));
    if (!right) break;
    used.add(left.id);
    used.add(right.id);
    pairs.push([left, right]);
  }
  return pairs;
}

/** Duel du jour : même face-à-face pour tous, tiré de la discipline et du jour. */
export function dailyPair(
  pool: readonly GoatPlayer[],
  sport: SportId,
  day: string,
): [GoatPlayer, GoatPlayer] | null {
  const random = mulberry32(hashString(`${sport}:${day}`));
  const pairs = eraPairs(pool, 1, random);
  if (pairs.length > 0) return pairs[0];
  if (pool.length < 2) return null;
  const shuffled = shuffleWith([...pool].sort((a, b) => a.id.localeCompare(b.id)), random);
  return [shuffled[0], shuffled[1]];
}

// --------------------------------------------------------------------------
// Sommet de la pyramide (placement des vainqueurs)
// --------------------------------------------------------------------------

/** Cases du sommet, du GOAT ultime (L1-0) à l'étage 4 (ou 5 en mode expert). */
export function topSlots(expertMode: boolean): string[] {
  const slots = ['L1-0'];
  const tiers = expertMode ? 5 : 4;
  for (let level = 2; level <= tiers; level += 1) {
    for (let index = 0; index < 2 ** (level - 1); index += 1) slots.push(`L${level}-${index}`);
  }
  return slots;
}

/** Première case libre du sommet, ou null si le sommet est complet. */
export function nextFreeTopSlot(
  assignments: Record<string, string>,
  expertMode: boolean,
): string | null {
  return topSlots(expertMode).find((slot) => !assignments[slot]) ?? null;
}
