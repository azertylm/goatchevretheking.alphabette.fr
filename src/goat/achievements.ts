import { useSyncExternalStore } from 'react';
import { GamesState } from './gameModes';
import { SPORTS } from './sportsCatalog';

/**
 * @file achievements.ts
 * Succès du pâturage : dix objectifs concrets, débloqués localement.
 *
 * Le magasin est volontairement séparé des autres clés (`goat_achievements_v1`)
 * et n'écrit jamais dans les pyramides, l'album Panini, les records ou les
 * Crottins. Un succès débloqué est définitif : il n'est jamais retiré, même si
 * l'utilisateur vide ensuite son album ou sa pyramide.
 */

export interface AchievementContext {
  /** Solde de Crottins d'Or. */
  coins: number;
  /** Score cumulé (rang caprin). */
  score: number;
  /** Magasin des modes de jeu. */
  games: GamesState;
  /** Vignettes découvertes, toutes disciplines. */
  albumCount: number;
  /** Pyramides complètes (une par discipline). */
  completedPyramids: number;
}

export interface AchievementDefinition {
  id: string;
  label: string;
  description: string;
  emoji: string;
  /** Valeur à atteindre. */
  goal: number;
  /** Progression actuelle (bornée au but). */
  progress: (ctx: AchievementContext) => number;
  /** Unité affichée à côté de la progression. */
  unit: string;
}

const playsTotal = (games: GamesState): number =>
  Object.values(games.plays).reduce((total, count) => total + count, 0);

const sportsPlayed = (games: GamesState): number =>
  new Set(Object.keys(games.best).map((key) => key.split(':')[1]).filter(Boolean)).size;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'premier-duel',
    label: 'Premier coup de corne',
    description: 'Voter dans un duel du pâturage.',
    emoji: '🐐',
    goal: 1,
    unit: 'partie',
    progress: (ctx) => playsTotal(ctx.games),
  },
  {
    id: 'chrono-20',
    label: 'Turbo chèvre',
    description: 'Voter 20 duels en 60 secondes au Défi Chrono.',
    emoji: '⏱️',
    goal: 20,
    unit: 'duels',
    progress: (ctx) =>
      Math.max(
        0,
        ...Object.entries(ctx.games.best)
          .filter(([key]) => key.startsWith('chrono:'))
          .map(([, record]) => record.score),
      ),
  },
  {
    id: 'quiz-24',
    label: 'Œil de lynx',
    description: 'Marquer 24 points sur 30 au quiz « Trouve le GOAT ».',
    emoji: '🔍',
    goal: 24,
    unit: 'points',
    progress: (ctx) =>
      Math.max(
        0,
        ...Object.entries(ctx.games.best)
          .filter(([key]) => key.startsWith('quiz:'))
          .map(([, record]) => record.score),
      ),
  },
  {
    id: 'bouc-8',
    label: 'Bouc émissaire en chef',
    description: 'Démasquer les 8 maillons faibles d’une partie.',
    emoji: '🎯',
    goal: 8,
    unit: 'maillons',
    progress: (ctx) =>
      Math.max(
        0,
        ...Object.entries(ctx.games.best)
          .filter(([key]) => key.startsWith('bouc:'))
          .map(([, record]) => record.score),
      ),
  },
  {
    id: 'epoques-7',
    label: 'Voyageur du temps',
    description: '7 votes conformes au classement standard dans les Duels d’époques.',
    emoji: '⏳',
    goal: 7,
    unit: 'votes',
    progress: (ctx) =>
      Math.max(
        0,
        ...Object.entries(ctx.games.best)
          .filter(([key]) => key.startsWith('epoques:'))
          .map(([, record]) => record.score),
      ),
  },
  {
    id: 'serie-7',
    label: 'Flamme du pâturage',
    description: 'Entretenir une série de 7 jours sur le Duel du jour.',
    emoji: '🔥',
    goal: 7,
    unit: 'jours',
    progress: (ctx) => ctx.games.streak.best,
  },
  {
    id: 'panini-100',
    label: 'Album en or',
    description: 'Découvrir 100 vignettes dans l’album Panini.',
    emoji: '📸',
    goal: 100,
    unit: 'vignettes',
    progress: (ctx) => ctx.albumCount,
  },
  {
    id: 'pyramide-complete',
    label: 'Panthéon achevé',
    description: 'Compléter une pyramide (15 places, ou 31 en mode expert).',
    emoji: '🏛️',
    goal: 1,
    unit: 'pyramide',
    progress: (ctx) => ctx.completedPyramids,
  },
  {
    id: 'crottins-500',
    label: 'Fortune de fromage',
    description: 'Cumuler 500 Crottins d’Or.',
    emoji: '🪙',
    goal: 500,
    unit: 'crottins',
    progress: (ctx) => ctx.score,
  },
  {
    id: 'explorateur',
    label: 'Explorateur des 30 disciplines',
    description: 'Jouer dans 5 disciplines différentes.',
    emoji: '🧭',
    goal: 5,
    unit: 'disciplines',
    progress: (ctx) => sportsPlayed(ctx.games),
  },
];

export interface AchievementState {
  /** Identifiant → date de déblocage (millisecondes). */
  unlocked: Record<string, number>;
}

const STORAGE_KEY = 'goat_achievements_v1';

function parseStored(): AchievementState {
  const empty: AchievementState = { unlocked: {} };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Partial<AchievementState>;
    const unlocked: Record<string, number> = {};
    for (const [id, at] of Object.entries(data.unlocked ?? {})) {
      const value = Number(at);
      if (Number.isFinite(value) && value > 0) unlocked[id] = value;
    }
    return { unlocked };
  } catch {
    return empty;
  }
}

let state: AchievementState = parseStored();
const listeners = new Set<() => void>();
const toastListeners = new Set<() => void>();
let toasts: string[] = [];
/** Identifiants déjà signalés pendant cette session (évite les doublons). */
const announced = new Set<string>();

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible : le déblocage reste valable pour la session */
  }
}

const emit = () => listeners.forEach((listener) => listener());
const emitToasts = () => toastListeners.forEach((listener) => listener());

export function subscribeAchievements(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAchievementState(): AchievementState {
  return state;
}

export function useAchievements(): AchievementState {
  return useSyncExternalStore(subscribeAchievements, getAchievementState, getAchievementState);
}

/** Fichier de toasts (succès débloqués à afficher en bas de l'écran). */
export function subscribeAchievementToasts(listener: () => void): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function getAchievementToasts(): string[] {
  return toasts;
}

export function dismissAchievementToast(id: string): void {
  if (!toasts.includes(id)) return;
  toasts = toasts.filter((entry) => entry !== id);
  emitToasts();
}

/**
 * Compare l'état courant aux objectifs et débloque les succès atteints.
 * Retourne les identifiants nouvellement obtenus.
 */
export function syncAchievements(ctx: AchievementContext): string[] {
  const unlocked: string[] = [];
  let changed = false;

  for (const achievement of ACHIEVEMENTS) {
    if (state.unlocked[achievement.id]) continue;
    if (achievement.progress(ctx) < achievement.goal) continue;
    unlocked.push(achievement.id);
    changed = true;
  }

  if (changed) {
    const now = Date.now();
    const next = { ...state.unlocked };
    for (const id of unlocked) next[id] = now;
    state = { unlocked: next };
    persist();
    emit();
  }

  const fresh = unlocked.filter((id) => !announced.has(id));
  if (fresh.length > 0) {
    fresh.forEach((id) => announced.add(id));
    // Quatre notifications au maximum à l'écran : les plus récentes.
    toasts = [...toasts, ...fresh].slice(-4);
    emitToasts();
    // Disparition automatique et décalée (7 s, puis toutes les 0,9 s).
    if (typeof window !== 'undefined') {
      fresh.forEach((id, index) => {
        window.setTimeout(() => {
          if (!toasts.includes(id)) return;
          toasts = toasts.filter((entry) => entry !== id);
          emitToasts();
        }, 7000 + index * 900);
      });
    }
  }

  return unlocked;
}

/** Nombre de succès débloqués (pour les résumés). */
export function achievementCount(snapshot: AchievementState = state): number {
  return ACHIEVEMENTS.filter((achievement) => Boolean(snapshot.unlocked[achievement.id])).length;
}

/** Nombre de disciplines jouées (utilisé par le panneau « Bilan »). */
export const playedSportsCount = (games: GamesState): number => sportsPlayed(games);

/** Toutes les disciplines du catalogue (pour scanner les pyramides complètes). */
export const ALL_SPORTS = SPORTS;
