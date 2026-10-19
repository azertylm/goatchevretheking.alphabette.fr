/**
 * @file pyramidModel.ts
 * Modèle de la pyramide GOAT : étages, identifiants de cases et état persisté.
 */

export interface PyramidTier {
  level: number;
  places: number;
  label: string;
  /** Étage 5 activable via l'interrupteur « Mode Expert (16) ». */
  expert?: boolean;
}

export const PYRAMID_TIERS: PyramidTier[] = [
  { level: 1, places: 1, label: 'Le GOAT Ultime' },
  { level: 2, places: 2, label: 'Les intouchables' },
  { level: 3, places: 4, label: 'Les demi-dieux' },
  { level: 4, places: 8, label: 'Le panthéon' },
  { level: 5, places: 16, label: 'Mode Expert', expert: true },
];

export const slotId = (level: number, index: number): string => `L${level}-${index}`;

export const visibleTiers = (expertMode: boolean): PyramidTier[] =>
  PYRAMID_TIERS.filter((tier) => !tier.expert || expertMode);

export const visibleSlotIds = (expertMode: boolean): string[] =>
  visibleTiers(expertMode).flatMap((tier) =>
    Array.from({ length: tier.places }, (_, index) => slotId(tier.level, index)),
  );

/** Nombre total de places (16 avec le mode expert). */
export const totalPlaces = (expertMode: boolean): number => visibleSlotIds(expertMode).length;

export interface PyramidState {
  /** slotId -> playerId */
  assignments: Record<string, string>;
  /** Un seul joueur peut porter le badge « Hot Take 🔥 ». */
  hotTake: string | null;
  expertMode: boolean;
}

export const createEmptyPyramid = (): PyramidState => ({
  assignments: {},
  hotTake: null,
  expertMode: false,
});

/**
 * Clé de stockage : **une pyramide par discipline**
 * (`goat_pyramid_football`, `goat_pyramid_nba`, …). Changer d'univers charge
 * donc la pyramide correspondante sans jamais écraser les autres.
 */
const storageKey = (sport: string): string => `goat_pyramid_${sport}`;

/** Anciennes clés (v1 → v3) : lues une fois pour ne perdre aucun classement. */
const legacyKeys = (sport: string): string[] => [`goat_pyramid_v3_${sport}`, `goat_pyramid_v2_${sport}`];

const parsePyramid = (raw: string): PyramidState | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<PyramidState>;
    return {
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
      hotTake: typeof parsed.hotTake === 'string' ? parsed.hotTake : null,
      expertMode: parsed.expertMode === true,
    };
  } catch {
    return null;
  }
};

/* ── Notification de changement ──────────────────────────────────────────────
   La barre de disciplines affiche l'état d'avancement des 30 pyramides : elle
   doit se rafraîchir dès qu'une pyramide est modifiée, même si c'est un autre
   composant qui l'a modifiée. Un simple compteur de révision suffit. */
const listeners = new Set<() => void>();
let revision = 0;

export function subscribePyramidStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Instantané stable pour `useSyncExternalStore`. */
export function pyramidStoreRevision(): number {
  return revision;
}

const notify = (): void => {
  revision += 1;
  listeners.forEach((listener) => listener());
};

export function loadPyramid(sport: string): PyramidState {
  try {
    const raw = localStorage.getItem(storageKey(sport));
    if (raw) return parsePyramid(raw) ?? createEmptyPyramid();

    // Migration transparente depuis l'ancienne clé (aucune perte de classement).
    for (const legacy of legacyKeys(sport)) {
      const old = localStorage.getItem(legacy);
      if (!old) continue;
      const migrated = parsePyramid(old);
      if (!migrated) continue;
      localStorage.setItem(storageKey(sport), JSON.stringify(migrated));
      localStorage.removeItem(legacy);
      return migrated;
    }
    return createEmptyPyramid();
  } catch {
    return createEmptyPyramid();
  }
}

export function savePyramid(sport: string, state: PyramidState): void {
  try {
    localStorage.setItem(storageKey(sport), JSON.stringify(state));
    notify();
  } catch {
    /* stockage plein ou indisponible : l'état reste en mémoire */
  }
}

export function clearStoredPyramid(sport: string): void {
  try {
    localStorage.removeItem(storageKey(sport));
    notify();
  } catch {
    /* ignoré */
  }
}

export interface PyramidProgress {
  /** Cases remplies (étages visibles). */
  filled: number;
  /** Cases visibles (15, ou 31 en mode expert). */
  total: number;
  /** Pyramide complète. */
  complete: boolean;
  /** Aucun joueur placé. */
  empty: boolean;
}

/** Avancement d'une discipline, lu directement dans le stockage. */
export function readPyramidProgress(sport: string): PyramidProgress {
  const state = loadPyramid(sport);
  const total = totalPlaces(state.expertMode);
  const filled = visibleSlotIds(state.expertMode).filter((id) => Boolean(state.assignments[id])).length;
  return { filled, total, complete: total > 0 && filled === total, empty: filled === 0 };
}
