import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { SportId } from './sports';
import { GoatPlayer, PlayersPayload } from './types';
import { fetchPlayers } from './playersClient';
import { usePyramidState } from './usePyramidState';
import { PyramidBoard } from './PyramidBoard';
import { ReserveDrawer } from './ReserveDrawer';
import { DuelExpress } from './DuelExpress';
import { ControversyGauge } from './ControversyGauge';
import { SharePanel } from './SharePanel';
import { CommunityPublish } from '../community/CommunityPublish';
import { visibleSlotIds } from './pyramidModel';
import { computeControversy } from './controversy';
import { getSport } from './sports';

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
}

export const PyramidStage: React.FC<PyramidStageProps> = ({ sport, onCountsReady }) => {
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

  /** Clic dans la réserve : sélectionne (ou désélectionne) le joueur à placer. */
  const handleReserveSelect = (playerId: string) => {
    setSelectedPlayerId((current) => (current === playerId ? null : playerId));
  };

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-sm">Chargement des légendes {sport === 'football' ? 'du football' : 'de la NBA'}…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="rounded-3xl border border-red-500/40 bg-red-500/5 p-6 text-center space-y-3">
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
      <PyramidBoard
        api={api}
        pool={pool}
        playersById={playersById}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
      />

      <ReserveDrawer
        players={pool}
        selectedPlayerId={selectedPlayerId}
        hotTakeId={api.state.hotTake}
        placedIds={api.placedIds}
        onSelectPlayer={handleReserveSelect}
        onToggleHotTake={toggleHotTake}
      />

      {/* Mini-jeu : 10 duels rapides, vainqueurs pré-placés au sommet */}
      <DuelExpress api={api} pool={pool} />

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
