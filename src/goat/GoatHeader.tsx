import React, { useState } from 'react';
import { Crown, Trophy, Users } from 'lucide-react';
import { CrownGoatMascot } from './CrownGoatMascot';
import { CheesePediaModal } from './CheesePediaModal';
import { useCommunitySession } from '../community/communitySession';
import { useGoatProgression } from './useGoatProgression';

/**
 * @file GoatHeader.tsx
 * En-tête de marque de Goat Chèvre The King :
 * identité (chèvre couronnée), promesse de jeu et accès à la communauté.
 *
 * Le bandeau « propulsé par alphabette.fr » qui figurait ici a été retiré :
 * il est désormais fourni correctement par la base commune
 * (@alphabette/shell), en haut de page (barre écosystème).
 */

export const GoatHeader: React.FC = () => {
  const { user } = useCommunitySession();
  const [fromagidexOpen, setFromagidexOpen] = useState(false);
  const progression = useGoatProgression();

  return (
    <header className="relative border-b border-amber-500/20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Identité de marque */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-3xl bg-amber-400/20 blur-xl" aria-hidden="true" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950 border border-amber-400/40 flex items-center justify-center">
            <CrownGoatMascot className="w-14 h-14 sm:w-16 sm:h-16" />
          </div>
        </div>

        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-2">
            <Crown className="w-3 h-3" />
            Le classement ultime
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-none">
            Goat Chèvre The King
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
            Football, basket, tennis, natation, rugby… <strong className="text-slate-300">30 disciplines</strong> et
            des milliers de légendes : construis ta pyramide des plus grands athlètes de tous les temps, du GOAT
            ultime jusqu'à l'étage des 8.
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-[11px] font-semibold text-amber-300/90">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Gratuit, sans compte pour jouer
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Users className="w-3.5 h-3.5" />
              {user ? `compte : ${user.username}` : 'un compte pour publier ta pyramide'}
            </span>
          </p>
        </div>

        <div className="sm:ml-auto shrink-0 flex items-center gap-2 flex-wrap justify-center">
          {/* Gamification : rang caprin + solde de Crottins d'Or (pulse au gain) */}
          <div
            key={progression.lastGain?.at ?? 'calme'}
            title={
              progression.next
                ? `Progression vers « ${progression.next.title} » : ${progression.progressPct}%`
                : 'Rang maximum atteint'
            }
            className="crottin-pop inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                       border border-amber-400/30 bg-amber-400/10 text-amber-200
                       text-[11px] font-black whitespace-nowrap"
          >
            <span aria-hidden="true">{progression.rank.blason}</span>
            <span className="hidden md:inline">{progression.title}</span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-100"
              title={`${progression.coins} Crottins d'Or`}
            >
              <span aria-hidden="true">🪙</span>
              {progression.coins}
            </span>
          </div>

          {/* Volet terroir : Le Fromagidex (fromages de chèvre AOP) */}
          <button
            type="button"
            onClick={() => setFromagidexOpen(true)}
            title="Ouvrir le Fromagidex : fromages de chèvre AOP"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-200 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span aria-hidden="true">🧀</span>
            <span className="hidden sm:inline">Fromagidex</span>
          </button>
          <a
            href="/communaute"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-200 text-xs font-bold transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Communauté</span>
          </a>
        </div>
      </div>

      {/* Le Fromagidex : collection terroir (ouvre en modal) */}
      <CheesePediaModal open={fromagidexOpen} onClose={() => setFromagidexOpen(false)} />
    </header>
  );
};
