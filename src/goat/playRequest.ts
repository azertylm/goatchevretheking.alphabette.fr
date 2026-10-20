import { GameModeId } from './gameModes';

/**
 * @file playRequest.ts
 * Pont minuscule entre la barre de disciplines (bouton « Surprise ») et le menu
 * de jeu. Le changement de discipline démonte puis remonte le menu : la demande
 * est donc **mémorisée au niveau du module**, puis consommée au montage.
 */

export type PlayRequest = GameModeId | 'surprise';

const EVENT = 'goat:play-request';

let pending: PlayRequest | null = null;

/** Demande l'ouverture d'un mode (ou d'un mode au hasard). */
export function requestPlay(mode: PlayRequest): void {
  pending = mode;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** Lit et efface la demande en attente. */
export function consumePlayRequest(): PlayRequest | null {
  const value = pending;
  pending = null;
  return value;
}

export function subscribePlayRequest(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Tire un mode au hasard parmi ceux proposés. */
export function randomMode(modes: readonly GameModeId[]): GameModeId {
  return modes[Math.floor(Math.random() * modes.length)] ?? 'chrono';
}
