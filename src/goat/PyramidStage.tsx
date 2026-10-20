import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { SportId } from './sports';
import { GoatPlayer, PlayersPayload } from './types';
import { fetchPlayers } from './playersClient';
import { usePyramidState } from './usePyramidState';
import { PyramidBoard } from './PyramidBoard';
import { ReserveDrawer } from './ReserveDrawer';
import { DuelExpress } from './DuelExpress';
import { GameHub } from './GameHub';
import { addCrottins } from './useGoatProgression';
import { ControversyGauge } from './ControversyGauge';
import { SharePanel } from './SharePanel';
import { CommunityPublish } from '../community/CommunityPublish';
import { visibleSlotIds } from './pyramidModel';
import { computeControversy } from './controversy';
import { getSport } from './sports';
import { SharedDuel, SharedPyramid, clearShareParams } from './challenge';
import { PyramidChallengeBanner } from './ChallengeBanners';
import { ViralPanel } from './ViralPanel';

/**
 * @file PyramidStage.tsx
 * Espace central de Goat Chèvre The King :
 *  - chargement de la base des joueurs de l'univers sélectionné
 *  - pyramide interactive (étages 1-2-4-8 + mode Expert 16)
 *  - réserve des joueurs (recherche + filtre par époque)
 */

interface PyramidStageProps {
  sport: SportId;
  /** Remonte les effectifs par univers pour l'affichage du sélecteur. */
  onCountsReady?: (counts: Partial<Record<SportId, number>>) => void;
  /** Recherche pilotée par la barre de disciplines (sports + joueurs). */
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Remonte le nombre de joueurs correspondant à la recherche. */
  onSearchMatchCount?: (count: number) => void;
  /** Défi reçu par lien `?p=…` (pyramide à consulter / riposter). */
  sharedPyramid?: SharedPyramid | null;
  /** Duel reçu par lien `?d=…`. */
  sharedDuel?: SharedDuel | null;
  onDismissShare?: () => void;
  onRequestSport?: (sport: SportId) => void;
}

export const PyramidStage: React.FC<PyramidStageProps> = ({
  sport,
  onCountsReady,
  searchQuery,
  onSearchQueryChange,
  onSearchMatchCount,
  sharedPyramid = null,
  sharedDuel = null,
  onDismissShare,
  onRequestSport,
}) => {
  const [payload, setPayload] = useState<PlayersPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const api = usePyramidState(sport);
  const { toggleHotTake } = api;

  const load = useCallback(
    async (force = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchPlayers(sport, force);
        setPayload(data);
      } catch (err: any) {
        setError(err?.message || 'Base de joueurs indisponible.');
      } finally {
        setIsLoading(false);
      }
    },
    [sport],
  );

  useEffect(() => {
    setSelectedPlayerId(null);
    load();
  }, [load]);

  const pool: GoatPlayer[] = useMemo(() => payload?.players ?? [], [payload]);

  const playersById = useMemo(() => new Map(pool.map((player) => [player.id, player])), [pool]);

  /** Places réellement visibles (l'étage Expert masqué n'entre pas dans le score). */
  const visibleAssignments = useMemo(() => {
    const allowed = new Set(visibleSlotIds(api.state.expertMode));
    const result: Record<string, string> = {};
    for (const [slot, playerId] of Object.entries(api.state.assignments)) {
      if (allowed.has(slot)) result[slot] = playerId;
    }
    return result;
  }, [api.state.assignments, api.state.expertMode]);

  /** Jauge de controverse (utilisée pour l'affichage et pour l'image de partage). */
  const controversy = useMemo(
    () => computeControversy(visibleAssignments, pool),
    [visibleAssignments, pool],
  );

  // Effectifs par univers pour l'en-tête (football et NBA).
  useEffect(() => {
    if (!payload?.counts) return;
    onCountsReady?.({
      football: payload.counts.football ?? 0,
      nba: payload.counts.nba ?? 0,
    });
  }, [payload, onCountsReady]);

  /** Récompense : +20 Crottins d'Or quand la pyramide passe de incomplète à complète. */
  const wasCompleteRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasCompleteRef.current === null) {
      // Premier rendu : la pyramide restaurée du localStorage ne rapporte rien.
      wasCompleteRef.current = api.isComplete;
      return;
    }
    if (api.isComplete && !wasCompleteRef.current) {
      addCrottins(20, 'pyramide');
    }
    wasCompleteRef.current = api.isComplete;
  }, [api.isComplete]);

  /** Clic dans la réserve : sélectionne (ou désélectionne) le joueur à placer. */
  const handleReserveSelect = (playerId: string) => {
    setSelectedPlayerId((current) => (current === playerId ? null : playerId));
  };

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="rounded-2xl border border-emerald-500/15 bg-[#0e1813]/80 backdrop-blur-md p-10 flex flex-col items-center gap-3 text-slate-300 shadow-xl shadow-black/30">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-sm">Chargement des légendes — {getSport(sport).label}…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="rounded-2xl border border-red-500/40 bg-[#1a0e11]/80 backdrop-blur-md p-6 text-center space-y-3 shadow-xl shadow-black/30">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-red-300">Base de joueurs indisponible</p>
          <p className="text-xs text-red-200/80 max-w-xl mx-auto">{error}</p>
          <button
            onClick={() => load(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Espace central : pyramide et réserve" className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
      {sharedPyramid && (
        <PyramidChallengeBanner
          shared={sharedPyramid}
          players={pool}
          currentSport={sport}
          onAdopt={(input) => {
            api.adopt(input);
            clearShareParams();
            onDismissShare?.();
          }}
          onSwitchSport={(next) => onRequestSport?.(next)}
          onDismiss={() => {
            clearShareParams();
            onDismissShare?.();
          }}
        />
      )}

      <PyramidBoard
        api={api}
        pool={pool}
        playersById={playersById}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
      />

      <ReserveDrawer
        sport={sport}
        players={pool}
        selectedPlayerId={selectedPlayerId}
        hotTakeId={api.state.hotTake}
        placedIds={api.placedIds}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onFilteredCount={onSearchMatchCount}
        onSelectPlayer={handleReserveSelect}
        onToggleHotTake={toggleHotTake}
      />

      {/* Mini-jeu : 10 duels rapides, vainqueurs pré-placés au sommet */}
      <DuelExpress api={api} pool={pool} />

      {/* Menu de jeu : Défi Chrono, Duels d'époques, Duel du jour, quiz, Bouc Émissaire */}
      <GameHub
        sport={sport}
        pool={pool}
        api={api}
        sharedDuel={sharedDuel}
        onDismissDuel={() => onDismissShare?.()}
      />

      {/* Jauge de controverse : verdict quand la pyramide est complète */}
      <ControversyGauge
        assignments={visibleAssignments}
        players={pool}
        isComplete={api.isComplete}
        isHotTakeSet={Boolean(api.state.hotTake)}
      />

      {/* Partage viral : image HD + QR code vers goatchevretheking.alphabette.fr */}
      <SharePanel
        assignments={visibleAssignments}
        players={pool}
        hotTakeId={api.state.hotTake}
        controversy={controversy}
        sportLabel={getSport(sport).label}
        expertMode={api.state.expertMode}
        sport={sport}
      />

      {/* Vitrine : succès, décennies, tableau d'honneur, boutique, historique */}
      <ViralPanel
        sport={sport}
        players={pool}
        assignments={visibleAssignments}
        onRequestSport={onRequestSport}
      />

      {/* Communauté : publier sa pyramide et explorer celles des autres */}
      <CommunityPublish
        assignments={visibleAssignments}
        players={pool}
        hotTakeId={api.state.hotTake}
        controversy={controversy}
        sportLabel={getSport(sport).label}
        expertMode={api.state.expertMode}
      />
    </section>
  );
};
