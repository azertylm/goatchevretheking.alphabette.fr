import React from 'react';
import { Crown, ExternalLink, Home, ShieldCheck, Trophy, Users } from 'lucide-react';
import { CrownGoatMascot } from './CrownGoatMascot';
import { useCommunitySession } from '../community/communitySession';

/**
 * @file GoatHeader.tsx
 * En-tête dynamique de Goat Chèvre The King :
 * identité de marque (chèvre couronnée) + bandeau « propulsé par alphabette.fr »
 * avec liens vers le hub principal et la galerie de la communauté.
 */

export const GoatHeader: React.FC = () => {
  const { user } = useCommunitySession();

  return (
    <header className="relative border-b border-amber-500/20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Bandeau propulsé par alphabette.fr */}
      <div className="bg-gradient-to-r from-emerald-600/20 via-emerald-500/10 to-amber-500/20 border-b border-emerald-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-center">
          <p className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              Un service gratuit propulsé par{' '}
              <a href="/" className="underline decoration-emerald-400/60 underline-offset-2 hover:text-white transition-colors">
                alphabette.fr
              </a>
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="/communaute"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-[11px] font-bold text-amber-200 transition-colors"
            >
              <Users className="w-3 h-3" />
              <span>Communauté</span>
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold text-white transition-colors"
            >
              <Home className="w-3 h-3" />
              <span>Retour au hub alphabette.fr</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

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
            Football international &amp; Basketball NBA : construis ta pyramide des plus grands joueurs de tous les
            temps, du GOAT ultime jusqu'à l'étage des 8.
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
      </div>
    </header>
  );
};
