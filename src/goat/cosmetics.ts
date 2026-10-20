import { useCallback, useSyncExternalStore } from 'react';
import { spendCrottins } from './useGoatProgression';

/**
 * @file cosmetics.ts
 * Boutique de Crottins d'Or : cadres cosmétiques appliqués aux vignettes.
 *
 * Les cadres sont purement décoratifs (aucun avantage de jeu). L'achat dépense
 * des Crottins **dépensables** ; le score cumulé — donc le rang caprin — n'est
 * jamais entamé. Persistance : `goat_cosmetics_v1`.
 */

export interface CosmeticFrame {
  id: string;
  label: string;
  description: string;
  price: number;
  emoji: string;
}

export const COSMETIC_FRAMES: CosmeticFrame[] = [
  {
    id: 'or',
    label: 'Cadre doré',
    description: 'Un liseré d’or massif autour de chaque vignette.',
    price: 30,
    emoji: '🥇',
  },
  {
    id: 'fromage',
    label: 'Croûte fleurie',
    description: 'Un cadre crème façon croûte de chèvre affinée.',
    price: 60,
    emoji: '🧀',
  },
  {
    id: 'neon',
    label: 'Néon alpin',
    description: 'Halo fuchsia : ta réserve ressemble à une boîte de nuit de montagne.',
    price: 100,
    emoji: '💜',
  },
];

interface CosmeticsState {
  owned: string[];
  active: string | null;
}

const STORAGE_KEY = 'goat_cosmetics_v1';

const isKnownFrame = (id: string): boolean => COSMETIC_FRAMES.some((frame) => frame.id === id);

function parseStored(): CosmeticsState {
  const empty: CosmeticsState = { owned: [], active: null };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Partial<CosmeticsState>;
    const owned = Array.isArray(data.owned)
      ? [...new Set(data.owned.filter((id): id is string => typeof id === 'string' && isKnownFrame(id)))]
      : [];
    const active =
      typeof data.active === 'string' && owned.includes(data.active) && isKnownFrame(data.active)
        ? data.active
        : null;
    return { owned, active };
  } catch {
    return empty;
  }
}

let state: CosmeticsState = parseStored();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/** Applique le cadre actif au document (une seule règle CSS globale). */
function applyToDocument(): void {
  if (typeof document === 'undefined') return;
  const active = state.active;
  if (active) document.body.dataset.goatFrame = active;
  else delete document.body.dataset.goatFrame;
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible : le cadre reste actif pour la session */
  }
}

export function subscribeCosmetics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCosmetics(): CosmeticsState {
  return state;
}

/** À appeler une fois au démarrage (le module le fait aussi de lui-même). */
export function applyStoredCosmetics(): void {
  applyToDocument();
}

/**
 * Achète un cadre. Retourne `{ ok }` ou la raison de l'échec.
 * Le cadre acheté devient immédiatement actif.
 */
export function buyFrame(id: string): { ok: boolean; reason?: string } {
  const frame = COSMETIC_FRAMES.find((entry) => entry.id === id);
  if (!frame) return { ok: false, reason: 'Cadre inconnu.' };
  if (state.owned.includes(id)) {
    state = { ...state, active: id };
    persist();
    applyToDocument();
    emit();
    return { ok: true };
  }
  if (!spendCrottins(frame.price)) {
    return { ok: false, reason: `Il te manque ${frame.price} Crottins d’Or.` };
  }
  state = { owned: [...state.owned, id], active: id };
  persist();
  applyToDocument();
  emit();
  return { ok: true };
}

/** Active (ou retire, avec `null`) un cadre déjà possédé. */
export function setActiveFrame(id: string | null): void {
  if (id !== null && !state.owned.includes(id)) return;
  state = { ...state, active: id };
  persist();
  applyToDocument();
  emit();
}

export interface CosmeticsApi extends CosmeticsState {
  frames: CosmeticFrame[];
  buy: (id: string) => { ok: boolean; reason?: string };
  activate: (id: string | null) => void;
  owns: (id: string) => boolean;
}

/** Réactivité React sur la boutique. */
export function useCosmetics(): CosmeticsApi {
  const snapshot = useSyncExternalStore(subscribeCosmetics, getCosmetics, getCosmetics);
  const buy = useCallback((id: string) => buyFrame(id), []);
  const activate = useCallback((id: string | null) => setActiveFrame(id), []);
  return {
    ...snapshot,
    frames: COSMETIC_FRAMES,
    buy,
    activate,
    owns: (id: string) => snapshot.owned.includes(id),
  };
}

// Le cadre mémorisé est appliqué dès le chargement du module.
if (typeof document !== 'undefined') {
  applyToDocument();
}
