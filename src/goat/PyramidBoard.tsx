import React from 'react';
import { Crown, Dices, Flame, MousePointerClick, RotateCcw, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { GoatPlayer } from './types';
import { PyramidApi } from './usePyramidState';
import { PYRAMID_TIERS, slotId, visibleTiers } from './pyramidModel';
import { PlayerCard } from './PlayerCard';

/**
 * @file PyramidBoard.tsx
 * Pyramide interactive : 1 → 2 → 4 → 8 places (+ étage Expert de 16).
 * Placement par glisser-déposer ou par simple clic (joueur puis case vide).
 */

interface PyramidBoardProps {
  api: PyramidApi;
  playersById: Map<string, GoatPlayer>;
  pool: GoatPlayer[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
}

export const PyramidBoard: React.FC<PyramidBoardProps> = ({
  api,
  playersById,
  pool,
  selectedPlayerId,
  onSelectPlayer,
}) => {
  const { state, place, removeFromSlot, chaosFill, toggleHotTake, setExpertMode, reset } = api;
  const tiers = visibleTiers(state.expertMode);

  const handleSlotClick = (target: string) => {
    const occupant = state.assignments[target];

    // Aucun joueur sélectionné : on sélectionne l'occupant pour le déplacer.
    if (!selectedPlayerId) {
      if (occupant) onSelectPlayer(occupant);
      return;
    }

    if (selectedPlayerId === occupant) {
      onSelectPlayer(null);
      return;
    }

    place(target, selectedPlayerId);
    onSelectPlayer(null);
  };

  return (
    <div className="rounded-2xl border border-amber-500/10 bg-[#0e1813]/80 p-4 sm:p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Crown className="w-4 h-4 text-amber-400" />
            La Pyramide GOAT
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            {api.filledVisibleCount}/{api.totalVisibleCount} places remplies
            {api.isComplete ? ' · pyramide complète ✅' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interrupteur mode expert */}
          <button
            onClick={() => setExpertMode(!state.expertMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
              state.expertMode
                ? 'bg-amber-400 text-slate-950 border-amber-400'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            title="Activer l'étage 5 (16 places)"
          >
            {state.expertMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Mode Expert (16)
          </button>

          {/* Mode chaos */}
          <button
            onClick={() => chaosFill(pool)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
            title="Remplir les cases vides au hasard"
          >
            <Dices className="w-3.5 h-3.5" />
            Mode Chaos 🎲
          </button>

          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-[11px] font-bold transition-colors cursor-pointer"
            title="Vider la pyramide"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Aide contextuelle */}
      <p
        className={`mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-xl px-3 py-2 ${
          selectedPlayerId
            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
            : 'bg-slate-950/60 text-slate-400 border border-slate-800'
        }`}
      >
        {selectedPlayerId ? (
          <>
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>
              <strong className="text-white">{playersById.get(selectedPlayerId)?.name}</strong> sélectionné — clique
              une case pour le placer
            </span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Choisis un joueur dans la réserve puis clique une case (ou glisse-dépose)</span>
          </>
        )}
      </p>

      {/* Étage 1 puis étages suivants */}
      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier.level} className="space-y-2">
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {tier.level === 1 ? (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Crown className="w-3 h-3" />
                  {tier.label} · 1 place
                </span>
              ) : (
                `${tier.label} · ${tier.places} places`
              )}
            </p>

            <div
              className="grid gap-1.5 sm:gap-2 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${tier.places}, minmax(0, 1fr))`,
                maxWidth: tier.places === 1 ? '11rem' : tier.places === 2 ? '20rem' : tier.places === 4 ? '34rem' : '100%',
              }}
            >
              {Array.from({ length: tier.places }).map((_, index) => {
                const id = slotId(tier.level, index);
                const occupantId = state.assignments[id];
                const occupant = occupantId ? playersById.get(occupantId) : undefined;

                if (occupant) {
                  return (
                    <PlayerCard
                      key={id}
                      player={occupant}
                      variant="slot"
                      compactTier={tier.level >= 5 ? 4 : (tier.level as 1 | 2 | 3 | 4)}
                      isSelected={selectedPlayerId === occupant.id}
                      isHotTake={state.hotTake === occupant.id}
                      onClick={() => handleSlotClick(id)}
                      onRemove={() => removeFromSlot(id)}
                      onToggleHotTake={() => toggleHotTake(occupant.id)}
                    />
                  );
                }

                return (
                  <button
                    key={id}
                    onClick={() => handleSlotClick(id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const playerId = event.dataTransfer.getData('text/plain');
                      if (playerId) {
                        place(id, playerId);
                        onSelectPlayer(null);
                      }
                    }}
                    className={`rounded-2xl border border-dashed flex flex-col items-center justify-center text-center transition-all duration-200 ease-out transform-gpu hover:scale-[1.02] cursor-pointer ${
                      selectedPlayerId
                        ? 'border-amber-400/70 bg-amber-400/5 hover:bg-amber-400/10'
                        : 'border-emerald-400/25 bg-[#0b1410]/70 hover:border-amber-300/60 hover:bg-amber-400/5'
                    } ${tier.level === 1 ? 'h-24 sm:h-28' : tier.level === 2 ? 'h-20 sm:h-24' : 'h-16 sm:h-20'}`}
                  >
                    <span className="text-[10px] font-bold text-slate-400">Place libre</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Socle : étagère d'affinage qui porte la légende */}
      <div className="mt-6 pasture-shelf rounded-2xl px-4 py-3">
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-semibold text-stone-300">
          <span className="inline-flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            Badge « Hot Take 🔥 » : un seul joueur à la fois
          </span>
          <span>· {PYRAMID_TIERS.length} étages disponibles avec le mode expert</span>
        </p>
      </div>
    </div>
  );
};
