import { useEffect } from 'react';

/**
 * @file useGameKeys.ts
 * Raccourcis clavier communs aux jeux du pâturage :
 *  - ← / A : joueur de gauche ;
 *  - → / D : joueur de droite ;
 *  - S : passer (chrono) ;
 *  - Entrée : action principale (duel suivant, question suivante…) ;
 *  - 1…9 : vignette correspondante (quiz, Bouc Émissaire).
 *
 * Les champs de saisie et les combinaisons avec Ctrl/Alt/Meta sont ignorés.
 */

export interface GameKeysOptions {
  /** Active les raccourcis (partie en cours, pas de révélation en attente). */
  enabled?: boolean;
  left?: () => void;
  right?: () => void;
  skip?: () => void;
  next?: () => void;
  /** Actions des touches 1…9, dans l'ordre. */
  digits?: Array<() => void>;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
};

export function useGameKeys({
  enabled = true,
  left,
  right,
  skip,
  next,
  digits,
}: GameKeysOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key;
      const lower = key.toLowerCase();

      if (key === 'ArrowLeft' || lower === 'a') {
        if (!left) return;
        event.preventDefault();
        left();
        return;
      }
      if (key === 'ArrowRight' || lower === 'd') {
        if (!right) return;
        event.preventDefault();
        right();
        return;
      }
      if (lower === 's') {
        if (!skip) return;
        event.preventDefault();
        skip();
        return;
      }
      if (key === 'Enter') {
        if (!next) return;
        event.preventDefault();
        next();
        return;
      }
      if (digits && /^[1-9]$/.test(key)) {
        const action = digits[Number(key) - 1];
        if (!action) return;
        event.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, left, right, skip, next, digits]);
}
