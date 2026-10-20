import React, { useCallback, useState } from 'react';
import { Gamepad2, Sparkles, Volume2, X } from 'lucide-react';
import { CrownGoatMascot } from './CrownGoatMascot';
import { pastureAudio } from './pastureAudio';
import { requestPlay } from './playRequest';

/**
 * @file MascotBuddy.tsx
 * La mascotte caprine interactive : un bouton flottant qui commente le
 * pâturage, bêle, lance un jeu au hasard et mène à la vitrine des succès.
 *
 * Elle ne s'ouvre jamais toute seule (aucune interruption de partie) : c'est
 * l'utilisateur qui lui parle, elle répond.
 */

const LINES = [
  'Bêêê… un classement sans Pelé, c’est un alpage sans herbe.',
  'La chèvre couronnée te regarde. Elle juge. Affectueusement.',
  'Un petit duel ? Ça te fera les cornes.',
  'Les Crottins d’Or ne se mangent pas. Enfin… pas tous.',
  'Le mode Expert, c’est 16 places et zéro excuse.',
  'Tu as déjà riposté à un ami aujourd’hui ?',
  'Moi, mon GOAT, c’est la chèvre qui a inventé le fromage.',
  'Une story 9:16 et le troupeau accourt.',
];

export const MascotBuddy: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LINES.length));

  const speak = useCallback(() => {
    setIndex((current) => (current + 1) % LINES.length);
    pastureAudio.playBleat(Math.random() < 0.35 ? 'chevreau' : 'royale');
  }, []);

  const openGames = () => {
    requestPlay('surprise');
    document.getElementById('jeux-du-paturage')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    setOpen(false);
  };

  const openVitrine = () => {
    document.getElementById('ma-vitrine')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {open && (
        <div className="mb-2 w-[min(86vw,300px)] rounded-2xl border border-amber-400/40 bg-slate-900/95 backdrop-blur p-3 shadow-2xl shadow-black/60 goat-fade-in">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
              La chèvre couronnée
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-slate-500 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-200 leading-snug">{LINES[index]}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={openGames}
              className="inline-flex flex-col items-center gap-1 rounded-xl border border-slate-700 px-1 py-2 text-[10px] font-bold text-slate-200 hover:border-amber-300/60 transition-colors cursor-pointer"
              title="Lancer un mode de jeu au hasard"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-300" />
              Surprise
            </button>
            <button
              type="button"
              onClick={openVitrine}
              className="inline-flex flex-col items-center gap-1 rounded-xl border border-slate-700 px-1 py-2 text-[10px] font-bold text-slate-200 hover:border-amber-300/60 transition-colors cursor-pointer"
              title="Voir la vitrine : succès, décennies, records, boutique"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Vitrine
            </button>
            <button
              type="button"
              onClick={speak}
              className="inline-flex flex-col items-center gap-1 rounded-xl border border-slate-700 px-1 py-2 text-[10px] font-bold text-slate-200 hover:border-amber-300/60 transition-colors cursor-pointer"
              title="Faire bêler la mascotte"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              Bêler
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) pastureAudio.playBell(880);
        }}
        aria-expanded={open}
        aria-label="Parler à la mascotte Goat Chèvre The King"
        title="La mascotte caprine — clique pour lui parler"
        className="relative w-14 h-14 rounded-full border border-amber-400/50 bg-gradient-to-br from-slate-800 to-slate-950 shadow-xl shadow-black/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
      >
        <span className="absolute inset-0 rounded-full bg-amber-400/20 blur-md" aria-hidden="true" />
        <CrownGoatMascot className="relative w-9 h-9" />
        <span className="absolute -top-0.5 -right-0.5 text-[11px]" aria-hidden="true">
          🐐
        </span>
      </button>
    </div>
  );
};
