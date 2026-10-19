import React, { useState } from 'react';
import { Languages, Megaphone } from 'lucide-react';
import { pastureAudio, type BleatPitch } from './pastureAudio';

/**
 * @file PastureControls.tsx
 * Barre d'actions sonores du pâturage (effet glassmorphism) :
 *  - « Bêler » : bêlement aléatoire (royale ou chevreau) + haptique mobile,
 *  - « Dialecte chèvre » : bascule propagée au parent via onDialecteChange.
 */

export interface PastureControlsProps {
  /** Propage l'état du « Dialecte chèvre » au composant parent. */
  onDialecteChange?: (dialecteChevre: boolean) => void;
  className?: string;
}

const baseButton =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 sm:px-4 py-2 text-xs font-bold ' +
  'transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60';

export const PastureControls: React.FC<PastureControlsProps> = ({
  onDialecteChange,
  className = '',
}) => {
  const [dialecteChevre, setDialecteChevre] = useState(false);

  const playBleat = () => {
    const pitch: BleatPitch = Math.random() < 0.35 ? 'chevreau' : 'royale';
    pastureAudio.playBleat(pitch);
  };

  const toggleDialecte = () => {
    const next = !dialecteChevre;
    setDialecteChevre(next);
    onDialecteChange?.(next);
  };

  return (
    <div
      className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}
      aria-label="Commandes sonores du pâturage"
    >
      <div
        className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 sm:gap-3
                   rounded-2xl sm:rounded-full border border-white/10 bg-white/[0.06] px-3 py-2
                   shadow-lg shadow-black/20 backdrop-blur-md"
      >
        {/* Bêlement aléatoire */}
        <button
          type="button"
          onClick={playBleat}
          title="Faire bêler une chèvre"
          className={`${baseButton} border-amber-400/30 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25`}
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Bêler</span>
          <span className="sm:hidden">Bêê</span>
        </button>

        {/* Dialecte chèvre (propagé au parent) */}
        <button
          type="button"
          onClick={toggleDialecte}
          aria-pressed={dialecteChevre}
          title={dialecteChevre ? 'Revenir au langage GOAT' : 'Traduire en dialecte chèvre'}
          className={`${baseButton} ${
            dialecteChevre
              ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
              : 'border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-slate-100'
          }`}
        >
          <Languages className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Dialecte chèvre</span>
          <span
            className={`ml-0.5 h-2 w-2 shrink-0 rounded-full ${
              dialecteChevre ? 'bg-emerald-400' : 'bg-slate-500'
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
};
