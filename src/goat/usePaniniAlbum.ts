import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { SportId } from './sports';

/**
 * @file usePaniniAlbum.ts
 * « Panini virtuel » : album de vignettes par discipline.
 *
 * L'album retient l'identifiant de chaque joueur **découvert** par
 * l'utilisateur : vignette cliquée dans la réserve, joueur placé sur la
 * pyramide, vote d'un duel express ou badge Hot Take. Tout est conservé dans
 * `localStorage` (clé `goat_panini_v1`), sans compte ni serveur.
 *
 * Le module expose un petit magasin observable (`useSyncExternalStore`) : la
 * jauge de collection se met à jour partout où elle est affichée, et reste
 * synchronisée entre deux onglets ouverts.
 */

const STORAGE_KEY = 'goat_panini_v1';
const MAX_IDS_PER_SPORT = 2000;

interface AlbumState {
  version: 1;
  sports: Record<string, string[]>;
}

const EMPTY_IDS: string[] = [];

const emptyAlbum = (): AlbumState => ({ version: 1, sports: {} });

function readAlbum(): AlbumState {
  if (typeof window === 'undefined') return emptyAlbum();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAlbum();
    const parsed = JSON.parse(raw) as Partial<AlbumState>;
    const sports: Record<string, string[]> = {};
    for (const [sport, ids] of Object.entries(parsed?.sports ?? {})) {
      if (!Array.isArray(ids)) continue;
      const clean = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (clean.length > 0) sports[sport] = [...new Set(clean)].slice(0, MAX_IDS_PER_SPORT);
    }
    return { version: 1, sports };
  } catch {
    return emptyAlbum();
  }
}

let album: AlbumState = readAlbum();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(album));
  } catch {
    /* stockage indisponible : l'album reste en mémoire pour la session */
  }
}

/** Abonnement pour `useSyncExternalStore`. */
export function subscribePaniniAlbum(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Instantané courant de l'album (identité stable tant qu'il ne change pas). */
export function getPaniniAlbum(): AlbumState {
  return album;
}

/** Enregistre des vignettes découvertes pour une discipline. */
export function discoverVignettes(
  sport: SportId | string,
  playerIds: ReadonlyArray<string | null | undefined>,
): void {
  if (!sport) return;

  const known = album.sports[sport] ?? EMPTY_IDS;
  const knownSet = new Set(known);
  const added: string[] = [];

  for (const id of playerIds) {
    if (typeof id !== 'string' || id.length === 0) continue;
    if (knownSet.has(id)) continue;
    knownSet.add(id);
    added.push(id);
  }

  if (added.length === 0) return;

  album = {
    version: 1,
    sports: {
      ...album.sports,
      [sport]: [...known, ...added].slice(0, MAX_IDS_PER_SPORT),
    },
  };
  persist();
  emit();
}

/** Vignettes déjà découvertes pour une discipline. */
export function getDiscoveredIds(sport: SportId | string): string[] {
  return album.sports[sport] ?? EMPTY_IDS;
}

/** Nombre de vignettes découvertes, toutes disciplines confondues. */
export function getAlbumTotalCount(): number {
  return Object.values(album.sports).reduce((total, ids) => total + ids.length, 0);
}

/** Vide l'album (d'une discipline, ou entier si `sport` est omis). */
export function resetPaniniAlbum(sport?: SportId | string): void {
  if (!sport) {
    album = emptyAlbum();
  } else if (album.sports[sport]) {
    const sports = { ...album.sports };
    delete sports[sport];
    album = { version: 1, sports };
  } else {
    return;
  }
  persist();
  emit();
}

/** Synchronisation entre onglets : un album complété ailleurs se reflète ici. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    album = readAlbum();
    emit();
  });
}

export interface PaniniAlbumApi {
  /** Vignettes découvertes de la discipline (pour tests d'appartenance rapides). */
  discovered: Set<string>;
  /** Nombre de vignettes découvertes. */
  count: number;
  /** Effectif total de la discipline. */
  total: number;
  /** Progression 0 → 1. */
  progress: number;
  has: (playerId: string) => boolean;
  /** Marque des joueurs comme découverts (clic, placement, vote…). */
  discover: (...playerIds: Array<string | null | undefined>) => void;
  reset: () => void;
}

/**
 * Album Panini d'une discipline.
 * @param sport Discipline affichée
 * @param total Effectif complet de la discipline (500 en général)
 */
export function usePaniniAlbum(sport: SportId, total = 0): PaniniAlbumApi {
  const snapshot = useSyncExternalStore(subscribePaniniAlbum, getPaniniAlbum, getPaniniAlbum);
  const activeSport = sport;
  const ids = snapshot.sports[activeSport] ?? EMPTY_IDS;

  const discovered = useMemo(() => new Set(ids), [ids]);
  const count = ids.length;

  const discover = useCallback(
    (...playerIds: Array<string | null | undefined>) => {
      discoverVignettes(activeSport, playerIds);
    },
    [activeSport],
  );

  const reset = useCallback(() => {
    resetPaniniAlbum(activeSport);
  }, [activeSport]);

  // Une discipline dont la base a changé (régénération) ne doit pas laisser
  // une jauge > 100 % : le total affiché est au moins le nombre découvert.
  const safeTotal = Math.max(total, count);

  return {
    discovered,
    count,
    total: safeTotal,
    progress: safeTotal > 0 ? count / safeTotal : 0,
    has: (playerId: string) => discovered.has(playerId),
    discover,
    reset,
  };
}
