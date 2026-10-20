import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoatPlayer } from './types';
import { SportId } from './sports';
import { pastureAudio } from './pastureAudio';
import {
  PyramidState,
  clearStoredPyramid,
  createEmptyPyramid,
  loadPyramid,
  savePyramid,
  totalPlaces,
  visibleSlotIds,
} from './pyramidModel';

/**
 * @file usePyramidState.ts
 * État de la pyramide GOAT : placements, badge Hot Take, mode expert.
 *
 * **Une pyramide par discipline** : l'état est sauvegardé sous
 * `goat_pyramid_${sportId}`. Passer d'un sport à l'autre charge la pyramide
 * correspondante ; les autres classements restent intacts.
 *
 * Le placement d'une carte déclenche un retour sonore contextuel (rebond, ou
 * clochette royale sur la case du GOAT ultime).
 */

export interface PyramidApi {
  state: PyramidState;
  placedIds: string[];
  filledVisibleCount: number;
  totalVisibleCount: number;
  isComplete: boolean;
  place: (targetSlot: string, playerId: string) => void;
  removeFromSlot: (targetSlot: string) => void;
  clearSlot: (targetSlot: string) => void;
  chaosFill: (pool: GoatPlayer[]) => void;
  toggleHotTake: (playerId: string) => void;
  setExpertMode: (enabled: boolean) => void;
  /** Adopte un classement reçu par lien (`?p=…`) : remplace la pyramide en cours. */
  adopt: (input: {
    assignments: Record<string, string>;
    hotTake?: string | null;
    expertMode?: boolean;
  }) => void;
  reset: () => void;
}

/** Case du GOAT ultime : elle mérite la clochette royale. */
const GOAT_SLOT = 'L1-0';

interface PyramidEntry {
  sport: SportId;
  pyramid: PyramidState;
}

export function usePyramidState(sport: SportId): PyramidApi {
  // Discipline et pyramide voyagent ensemble : impossible de sauvegarder
  // l'état d'un sport sous la clé d'un autre pendant la transition.
  const [entry, setEntry] = useState<PyramidEntry>(() => ({ sport, pyramid: loadPyramid(sport) }));

  // Changement de discipline : on charge la pyramide de la discipline choisie.
  useEffect(() => {
    setEntry((prev) => (prev.sport === sport ? prev : { sport, pyramid: loadPyramid(sport) }));
  }, [sport]);

  // Sauvegarde automatique, uniquement lorsque la pyramide en mémoire
  // appartient bien à la discipline affichée.
  useEffect(() => {
    if (entry.sport !== sport) return;
    savePyramid(sport, entry.pyramid);
  }, [sport, entry]);

  const state = entry.pyramid;

  const update = useCallback((updater: (prev: PyramidState) => PyramidState) => {
    setEntry((prev) => ({ ...prev, pyramid: updater(prev.pyramid) }));
  }, []);

  const placedIds = useMemo(
    () => Object.values(state.assignments).filter((value): value is string => Boolean(value)),
    [state.assignments],
  );

  const visibleSlots = useMemo(() => visibleSlotIds(state.expertMode), [state.expertMode]);
  const filledVisibleCount = visibleSlots.filter((id) => Boolean(state.assignments[id])).length;
  const totalVisibleCount = visibleSlots.length;

  /** Place un joueur sur une case (le retire de sa case précédente le cas échéant). */
  const place = useCallback(
    (targetSlot: string, playerId: string) => {
      update((prev) => {
        const assignments = { ...prev.assignments };

        // Un joueur n'occupe qu'une seule case.
        for (const [key, value] of Object.entries(assignments)) {
          if (value === playerId) delete assignments[key];
        }

        // Si la case cible était occupée, on échange les positions.
        const displaced = assignments[targetSlot];
        const previousSlot = Object.entries(prev.assignments).find(([, value]) => value === playerId)?.[0];
        assignments[targetSlot] = playerId;
        if (displaced && previousSlot) assignments[previousSlot] = displaced;

        return { ...prev, assignments };
      });

      // Retour sonore : clochette royale sur la case du GOAT, rebond ailleurs.
      if (targetSlot === GOAT_SLOT) pastureAudio.playRoyalChime();
      else pastureAudio.playBounce();
    },
    [update],
  );

  const removeFromSlot = useCallback(
    (targetSlot: string) => {
      update((prev) => {
        const assignments = { ...prev.assignments };
        const removed = assignments[targetSlot];
        delete assignments[targetSlot];
        return {
          ...prev,
          assignments,
          hotTake: removed && prev.hotTake === removed ? null : prev.hotTake,
        };
      });
    },
    [update],
  );

  const clearSlot = removeFromSlot;

  /** Mode Chaos 🎲 : remplit les cases vides restantes au hasard. */
  const chaosFill = useCallback(
    (pool: GoatPlayer[]) => {
      update((prev) => {
        const assignments = { ...prev.assignments };
        const used = new Set(Object.values(assignments));
        const available = pool.filter((player) => !used.has(player.id));

        for (const id of visibleSlotIds(prev.expertMode)) {
          if (assignments[id]) continue;
          if (available.length === 0) break;
          const index = Math.floor(Math.random() * available.length);
          assignments[id] = available[index].id;
          available.splice(index, 1);
        }

        return { ...prev, assignments };
      });
    },
    [update],
  );

  /** Badge « Hot Take 🔥 » : un seul joueur marqué à la fois. */
  const toggleHotTake = useCallback(
    (playerId: string) => {
      update((prev) => ({ ...prev, hotTake: prev.hotTake === playerId ? null : playerId }));
    },
    [update],
  );

  const setExpertMode = useCallback(
    (enabled: boolean) => {
      update((prev) => ({ ...prev, expertMode: enabled }));
    },
    [update],
  );

  /** Adopte un classement reçu par lien : nouveau point de départ (riposte). */
  const adopt = useCallback(
    (input: { assignments: Record<string, string>; hotTake?: string | null; expertMode?: boolean }) => {
      update((prev) => ({
        assignments: { ...input.assignments },
        hotTake:
          input.hotTake && Object.values(input.assignments).includes(input.hotTake)
            ? input.hotTake
            : null,
        expertMode: input.expertMode ?? prev.expertMode,
      }));
      pastureAudio.playRoyalChime();
    },
    [update],
  );

  const reset = useCallback(() => {
    clearStoredPyramid(sport);
    setEntry((prev) => ({ sport, pyramid: { ...createEmptyPyramid() } }));
  }, [sport]);

  return {
    state,
    placedIds,
    filledVisibleCount,
    totalVisibleCount,
    isComplete: totalVisibleCount > 0 && filledVisibleCount === totalVisibleCount,
    place,
    removeFromSlot,
    clearSlot,
    chaosFill,
    toggleHotTake,
    setExpertMode,
    adopt,
    reset,
  };
}

export { totalPlaces };
