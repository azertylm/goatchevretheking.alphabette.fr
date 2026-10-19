import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Users } from 'lucide-react';
import { GoatHeader } from './GoatHeader';
import { PastureControls } from './PastureControls';
import { AlphabetteGateway } from './AlphabetteGateway';
import { PyramidStage } from './PyramidStage';
import { SportId, getSport, readStoredSport, storeSport } from './sports';
import { SportCategoryBar } from './SportCategoryBar';
import { pastureAudio } from './pastureAudio';
import { applyStoredSoundPreference } from './soundPreference';
import { refreshCommunitySession } from '../community/communitySession';

/**
 * @file GoatApp.tsx
 * Application « Goat Chèvre The King » servie sur goatchevretheking.alphabette.fr.
 *
 * Mise en page responsive (mobile tactile & desktop) :
 *  1. En-tête dynamique avec identité de marque et bandeau alphabette.fr
 *  2. Barre des 30 disciplines (recherche sports + joueurs, état des pyramides)
 *  3. Espace central : pyramide interactive + réserve des joueurs
 *  4. Partage de l'image HD et publication dans la communauté
 */

export const GoatApp: React.FC = () => {
  const [sport, setSport] = useState<SportId>(readStoredSport);
  const [counts, setCounts] = useState<Partial<Record<SportId, number>>>({});
  /** Recherche unique : elle filtre les disciplines et les joueurs du sport actif. */
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    storeSport(sport);
    document.title = `Goat Chèvre The King — Classement ${getSport(sport).label} | alphabette.fr`;
  }, [sport]);

  // Préférence sonore mémorisée (sons actifs par défaut).
  useEffect(() => {
    applyStoredSoundPreference();
  }, []);

  // Vérifie une éventuelle session communauté (pour la publication et l'en-tête).
  useEffect(() => {
    void refreshCommunitySession();
  }, []);

  /**
   * Changement de discipline : chaque univers a sa propre pyramide (chargée
   * automatiquement par `usePyramidState`), et le sifflet d'arbitre marque le
   * coup d'envoi. La recherche est conservée d'une discipline à l'autre.
   */
  const handleSportChange = useCallback(
    (next: SportId) => {
      if (next === sport) return;
      pastureAudio.playWhistle();
      setMatchCount(null);
      setSport(next);
    },
    [sport],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <GoatHeader />

      {/* Commandes sonores du pâturage : ambiance alpine, bêlements, dialecte */}
      <PastureControls className="pt-4" />

      <main className="flex-1">
        {/* Barre des disciplines : ruban, recherche et état des 30 pyramides */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <SportCategoryBar
            value={sport}
            onChange={handleSportChange}
            counts={counts}
            query={query}
            onQueryChange={setQuery}
            matchCount={matchCount}
          />
        </div>

        {/* Espace central : pyramide + réserve */}
        <div className="pt-6">
          <PyramidStage
            sport={sport}
            onCountsReady={setCounts}
            searchQuery={query}
            onSearchQueryChange={setQuery}
            onSearchMatchCount={setMatchCount}
          />
        </div>

        {/* Note de sécurité / rappel écosystème */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          <p className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              Ton classement est enregistré dans ton navigateur (une pyramide par discipline). Crée un compte
              gratuit pour le publier dans la communauté et le retrouver partout.
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
