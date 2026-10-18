import React, { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Users } from 'lucide-react';
import { GoatHeader } from './GoatHeader';
import { AlphabetteGateway } from './AlphabetteGateway';
import { PyramidStage } from './PyramidStage';
import { SportId, SportSwitcher, getSport, readStoredSport, storeSport } from './sports';
import { refreshCommunitySession } from '../community/communitySession';

/**
 * @file GoatApp.tsx
 * Application « Goat Chèvre The King » servie sur goatchevretheking.alphabette.fr.
 *
 * Mise en page responsive (mobile tactile & desktop) :
 *  1. En-tête dynamique avec identité de marque et bandeau alphabette.fr
 *  2. Sélecteur d'univers (Football International / Basketball NBA)
 *  3. Espace central : pyramide interactive + réserve des joueurs
 *  4. Partage de l'image HD et publication dans la communauté
 */

export const GoatApp: React.FC = () => {
  const [sport, setSport] = useState<SportId>(readStoredSport);
  const [counts, setCounts] = useState<Partial<Record<SportId, number>>>({});

  useEffect(() => {
    storeSport(sport);
    document.title = `Goat Chèvre The King — Classement ${getSport(sport).label} | alphabette.fr`;
  }, [sport]);

  // Vérifie une éventuelle session communauté (pour la publication et l'en-tête).
  useEffect(() => {
    void refreshCommunitySession();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <GoatHeader />

      <main className="flex-1">
        {/* Sélecteur d'univers au sommet */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <SportSwitcher value={sport} onChange={setSport} counts={counts} />
        </div>

        {/* Espace central : pyramide + réserve */}
        <div className="pt-6">
          <PyramidStage sport={sport} onCountsReady={setCounts} />
        </div>

        {/* Note de sécurité / rappel écosystème */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          <p className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              Ton classement est enregistré dans ton navigateur (localStorage). Crée un compte gratuit pour le
              publier dans la communauté et le retrouver partout.
            </span>
            <a
              href="/communaute"
              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Voir la communauté</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </main>

      {/* Passerelle vers l'écosystème alphabette.fr */}
      <AlphabetteGateway />
    </div>
  );
};
