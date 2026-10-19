/**
 * @file soundPreference.ts
 * Préférence sonore du joueur, mémorisée dans le navigateur.
 *
 * Les retours sonores (rebond de carte, sifflet d'arbitre, clochette royale)
 * sont actifs par défaut — aucun son ne peut de toute façon partir avant un
 * premier geste de l'utilisateur — mais ils restent coupables d'un clic.
 */

import { pastureAudio } from './pastureAudio';

const STORAGE_KEY = 'goat_sound_v1';

/** Vrai si les sons du jeu sont autorisés. */
export function readSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function storeSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* stockage indisponible : la préférence reste valable pour la session */
  }
}

/** Applique la préférence mémorisée au gestionnaire audio (au démarrage). */
export function applyStoredSoundPreference(): boolean {
  const enabled = readSoundEnabled();
  pastureAudio.setEnabled(enabled);
  return enabled;
}
