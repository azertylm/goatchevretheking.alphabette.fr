import React from 'react';
import { ArrowRight, Compass, Layers, Sparkles } from 'lucide-react';

/**
 * @file AlphabetteGateway.tsx
 * Passerelle en bas de page vers l'écosystème alphabette.fr :
 * invitation à découvrir les autres outils et projets de la suite.
 */

export const AlphabetteGateway: React.FC = () => {
  return (
    <section
      aria-label="Passerelle vers l'écosystème alphabette.fr"
      className="border-t border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 sm:p-8">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden="true" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black text-2xl shrink-0">
                α
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  Écosystème alphabette.fr
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  Découvrez les autres outils et projets créés par alphabette.fr
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl">
                  Goat Chèvre The King est un service gratuit parmi d'autres : applications citoyennes, outils B2B
                  solaires, suite Service France en Zero-Knowledge… Tous conçus à La Grande-Motte et propulsés par une
                  IA souveraine.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 shrink-0">
              <a
                href="https://alphabette.fr"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black transition-colors"
              >
                <Compass className="w-4 h-4" />
                <span>Explorer l'écosystème</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://alphabette.fr#nos-applications"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-700 hover:bg-slate-800/70 text-slate-200 text-sm font-bold transition-colors"
              >
                <Layers className="w-4 h-4" />
                <span>Voir toutes les applications</span>
              </a>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} ALPHABETTE SASU — Goat Chèvre The King, un service gratuit propulsé par
          alphabette.fr
        </p>
      </div>
    </section>
  );
};
