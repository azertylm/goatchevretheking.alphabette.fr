import { useSyncExternalStore } from 'react';

/**
 * @file useGoatProgression.ts
 * Gamification « Crottins d'Or » : monnaie fictive + titres de noblesse caprine.
 *
 * Store module-level (.subscriptions) lu par useSyncExternalStore :
 * le badge de l'en-tête et les mini-jeux restent synchronisés sans contexte global.
 * Persistance : localStorage `goat_progression_v1` (clé dédiée, n'écrase jamais
 * `goat_pyramid_v3_*`, `goat_photo_frames_v1` ni `goat_sport_v1`).
 */

export interface GoatRank {
  /** Score cumulé minimal pour obtenir le titre. */
  threshold: number;
  title: string;
  blason: string;
}

export const GOAT_RANKS: GoatRank[] = [
  { threshold: 0, title: 'Simple Chevreau', blason: '🐐' },
  { threshold: 50, title: 'Bouc Émissaire', blason: '🎯' },
  { threshold: 150, title: 'Baron de Rocamadour', blason: '🧀' },
  { threshold: 300, title: 'Duc du Pâturage', blason: '👑' },
  { threshold: 500, title: 'GOAT Suprême', blason: '🏆' },
];

export type CrottinGainReason = 'duel' | 'pyramide';

export interface GoatProgressionState {
  /** Solde dépensable de Crottins d'Or. */
  coins: number;
  /** Score cumulé (détermine le rang, jamais dépensé). */
  score: number;
  /** Dernier gain (pour l'animation du badge). */
  lastGain: { amount: number; reason: CrottinGainReason; at: number } | null;
}

interface StoragePayload {
  coins: number;
  score: number;
}

const STORAGE_KEY = 'goat_progression_v1';

function parseStored(): Omit<GoatProgressionState, 'lastGain'> {
  const fallback: Omit<GoatProgressionState, 'lastGain'> = { coins: 0, score: 0 };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<StoragePayload>;
    const coins = Math.max(0, Math.floor(Number(data.coins) || 0));
    const score = Math.max(0, Math.floor(Number(data.score) || 0));
    return { coins, score };
  } catch {
    return fallback;
  }
}

let state: GoatProgressionState = { ...parseStored(), lastGain: null };
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoragePayload = { coins: state.coins, score: state.score };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Mode navigation privée / quota : le store en mémoire reste valable.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Attribue des Crottins d'Or (+ met à jour le score cumulé et le rang). */
export function addCrottins(amount: number, reason: CrottinGainReason): void {
  const gain = Math.max(0, Math.floor(amount));
  if (gain <= 0) return;
  state = {
    coins: state.coins + gain,
    score: state.score + gain,
    lastGain: { amount: gain, reason, at: Date.now() },
  };
  persist();
  emit();
}

export function currentRank(): GoatRank {
  let rank = GOAT_RANKS[0];
  for (const candidate of GOAT_RANKS) {
    if (state.score >= candidate.threshold) rank = candidate;
  }
  return rank;
}

export function nextRank(): GoatRank | null {
  for (const candidate of GOAT_RANKS) {
    if (candidate.threshold > state.score) return candidate;
  }
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GoatProgressionState {
  return state;
}

/** Réactivité React sur le store module-level. */
export function useGoatProgression(): GoatProgressionState &
  Pick<GoatRank, 'title'> & { rank: GoatRank; next: GoatRank | null; progressPct: number } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const rank = currentRank();
  const next = nextRank();
  const span = next ? next.threshold - rank.threshold : 1;
  const done = next ? snapshot.score - rank.threshold : 1;
  return {
    ...snapshot,
    rank,
    next,
    title: rank.title,
    progressPct: next ? Math.min(100, Math.max(0, Math.round((done / span) * 100))) : 100,
  };
}
