import { SportId, isSportId } from './sportsCatalog';

/**
 * @file challenge.ts
 * Liens de défi sans serveur : tout l'état utile voyage dans l'URL.
 *
 *  - `?p=…` — une **pyramide** complète (cases + Hot Take + mode expert) que
 *    l'on peut consulter puis « riposter » en l'adoptant comme point de départ.
 *  - `?d=…` — un **duel** entre deux joueurs, avec le choix de l'auteur, pour
 *    provoquer un ami sur le même face-à-face.
 *
 * L'encodage est du JSON compact en base64 URL (« base64url »), sans
 * dépendance : les liens sont courts, lisibles par tous les navigateurs et
 * n'exposent aucune donnée personnelle (des identifiants publics de joueurs).
 */

export interface SharedPyramid {
  sport: SportId;
  author: string;
  hotTake: string | null;
  expertMode: boolean;
  /** Couples `[case, identifiantJoueur]`. */
  picks: Array<[string, string]>;
}

export interface SharedDuel {
  sport: SportId;
  author: string;
  leftId: string;
  rightId: string;
  /** Choix de l'auteur (facultatif : un défi peut être « à l'aveugle »). */
  pickId: string | null;
}

const MAX_AUTHOR = 40;
const MAX_PICKS = 64;

/** Chaîne UTF-8 → base64 URL (sans `=`). */
function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64 URL → chaîne UTF-8 (null si le contenu est invalide). */
function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

const cleanAuthor = (author: string | null | undefined): string =>
  (author ?? '').trim().slice(0, MAX_AUTHOR);

const cleanId = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, 120) : '';

/** Origine publique du site (utilisable en aperçu local). */
export function shareOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://goatchevretheking.alphabette.fr';
}

/** Encode une pyramide pour un lien de contestation. */
export function buildPyramidLink(
  sport: SportId,
  assignments: Record<string, string>,
  options: { hotTake?: string | null; expertMode?: boolean; author?: string | null } = {},
): string {
  const payload: Record<string, unknown> = {
    v: 1,
    s: sport,
    n: cleanAuthor(options.author).slice(0, MAX_AUTHOR),
    t: options.hotTake ?? null,
    x: options.expertMode === true,
    p: Object.entries(assignments)
      .filter(([, playerId]) => Boolean(playerId))
      .slice(0, MAX_PICKS),
  };
  return `${shareOrigin()}/?p=${toBase64Url(JSON.stringify(payload))}`;
}

/** Décode un lien de pyramide (null si absent ou illisible). */
export function decodePyramidLink(raw: string | null | undefined): SharedPyramid | null {
  if (!raw) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as {
      v?: number;
      s?: unknown;
      n?: unknown;
      t?: unknown;
      x?: unknown;
      p?: unknown;
    };
    if (data.v !== 1 || !isSportId(data.s) || !Array.isArray(data.p)) return null;

    const picks: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const entry of data.p.slice(0, MAX_PICKS)) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const slot = cleanId(entry[0]);
      const playerId = cleanId(entry[1]);
      if (!/^L[1-5]-\d{1,2}$/.test(slot) || !playerId || seen.has(slot)) continue;
      seen.add(slot);
      picks.push([slot, playerId]);
    }
    if (picks.length === 0) return null;

    return {
      sport: data.s,
      author: cleanAuthor(typeof data.n === 'string' ? data.n : ''),
      hotTake: typeof data.t === 'string' ? cleanId(data.t) : null,
      expertMode: data.x === true,
      picks,
    };
  } catch {
    return null;
  }
}

/** Encode un duel pour un lien de provocation. */
export function buildDuelLink(duel: SharedDuel): string {
  const payload = {
    v: 1,
    s: duel.sport,
    n: cleanAuthor(duel.author),
    l: cleanId(duel.leftId),
    r: cleanId(duel.rightId),
    c: duel.pickId ? cleanId(duel.pickId) : null,
  };
  return `${shareOrigin()}/?d=${toBase64Url(JSON.stringify(payload))}`;
}

/** Décode un lien de duel (null si absent ou illisible). */
export function decodeDuelLink(raw: string | null | undefined): SharedDuel | null {
  if (!raw) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as {
      v?: number;
      s?: unknown;
      n?: unknown;
      l?: unknown;
      r?: unknown;
      c?: unknown;
    };
    if (data.v !== 1 || !isSportId(data.s)) return null;
    const leftId = cleanId(data.l);
    const rightId = cleanId(data.r);
    if (!leftId || !rightId || leftId === rightId) return null;
    return {
      sport: data.s,
      author: cleanAuthor(typeof data.n === 'string' ? data.n : ''),
      leftId,
      rightId,
      pickId: typeof data.c === 'string' ? cleanId(data.c) : null,
    };
  } catch {
    return null;
  }
}

/** Paramètres de partage présents dans l'URL courante. */
export function readShareParams(): { pyramid: SharedPyramid | null; duel: SharedDuel | null } {
  if (typeof window === 'undefined') return { pyramid: null, duel: null };
  const params = new URLSearchParams(window.location.search);
  return {
    pyramid: decodePyramidLink(params.get('p')),
    duel: decodeDuelLink(params.get('d')),
  };
}

/** Retire les paramètres de partage de l'URL, sans recharger la page. */
export function clearShareParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('p') && !url.searchParams.has('d')) return;
  url.searchParams.delete('p');
  url.searchParams.delete('d');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Copie un texte dans le presse-papiers (repli `execCommand`). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
