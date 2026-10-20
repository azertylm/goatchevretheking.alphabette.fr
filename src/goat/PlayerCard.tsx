import React, { useState } from 'react';
import { Crop, Flame, GripVertical, X } from 'lucide-react';
import { GoatPlayer } from './types';
import { PlayerAvatar } from './PlayerAvatar';
import { PhotoFrameEditor } from './PhotoFrameEditor';
import { hasCustomFrame } from './photoFrames';

/**
 * @file PlayerCard.tsx
 * Carte joueur : photo affichée en entier (ou cadrage personnalisé), nom lisible
 * et années d'activité juste en dessous.
 * Utilisée dans la pyramide (variant « slot ») et dans la réserve (variant « reserve »).
 */

interface PlayerCardProps {
  player: GoatPlayer;
  variant?: 'slot' | 'reserve';
  isSelected?: boolean;
  isHotTake?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  onToggleHotTake?: () => void;
  onRemove?: () => void;
  compactTier?: 1 | 2 | 3 | 4;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  variant = 'slot',
  isSelected = false,
  isHotTake = false,
  isDragging = false,
  onClick,
  onToggleHotTake,
  onRemove,
  compactTier = 3,
}) => {
  const isSlot = variant === 'slot';
  const [isFrameEditorOpen, setIsFrameEditorOpen] = useState(false);
  const isFramed = hasCustomFrame(player.id);

  // Photo entière par défaut. En case de pyramide, on garde des hauteurs compactes
  // (l'image reste complète, simplement plus petite) ; en réserve, un format
  // « carte sportive » 3:4 met les visages bien mieux en valeur.
  const photoClassName = isSlot
    ? compactTier === 1
      ? 'w-full h-28 sm:h-32'
      : compactTier === 2
        ? 'w-full h-24 sm:h-28'
        : 'w-full h-20 sm:h-24'
    : 'w-full aspect-[3/4]';

  const nameSize = isSlot ? (compactTier === 1 ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-[11px]') : 'text-xs';
  const yearSize = isSlot ? 'text-[9px] sm:text-[10px]' : 'text-[10px]';

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', player.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className={`goat-card group relative rounded-2xl overflow-hidden border text-left cursor-pointer select-none touch-manipulation
                  transition-all duration-200 ease-out transform-gpu hover:scale-[1.02] hover:z-10 ${
        isSelected
          ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20'
          : isHotTake
            ? 'border-orange-400/70 ring-1 ring-orange-400/40'
            : 'border-emerald-400/25 hover:border-amber-300/60 hover:shadow-lg hover:shadow-amber-500/10'
      } bg-[#101b15] ${isSlot && compactTier === 1 ? 'goat-card-glow' : ''} ${
        isDragging ? 'opacity-40' : ''
      }`}
      title={`${player.name} — ${player.career}`}
    >
      <PlayerAvatar player={player} className={photoClassName} />

      {isHotTake && (
        <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-black shadow">
          <Flame className="w-2.5 h-2.5" />
          Hot Take
        </span>
      )}

      {isSlot && (
        <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-300 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}

      <div className={`px-1.5 py-1 bg-[#0a120e]/95 backdrop-blur-sm ${isSlot ? '' : 'space-y-0.5'}`}>
        <p className={`${nameSize} font-bold text-white leading-tight line-clamp-2`}>{player.name}</p>
        <p className={`${yearSize} flex items-center gap-1 font-semibold text-amber-300/90 leading-tight`}>
          <span className="truncate">{player.career}</span>
          {player.isCurrentlyCompeting && (
            <span
              title="En compétition"
              aria-label="En compétition : carrière en cours"
              className="relative flex h-1.5 w-1.5 flex-none"
            >
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
        </p>
      </div>

      {onToggleHotTake && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHotTake();
          }}
          title={isHotTake ? 'Retirer le badge Hot Take' : 'Déclarer ce joueur « Hot Take » 🔥'}
          className={`absolute bottom-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
            isHotTake ? 'bg-orange-500 text-white' : 'bg-slate-800/90 text-slate-400 hover:text-orange-400'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title="Retirer de la case"
          className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-slate-950/85 text-slate-300 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Ajuster le cadrage de la photo (déplacer / zoomer) */}
      {player.image && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsFrameEditorOpen(true);
          }}
          title={
            isFramed
              ? 'Photo cadrée par toi — modifier le cadrage'
              : 'Décaler / zoomer la photo (cadrage personnalisé)'
          }
          className={`absolute bottom-1 left-1 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            isFramed
              ? 'bg-amber-400 text-slate-950'
              : 'bg-slate-950/85 text-slate-300 hover:text-amber-300 opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <Crop className="w-3.5 h-3.5" />
        </button>
      )}

      {isFrameEditorOpen && (
        <PhotoFrameEditor player={player} onClose={() => setIsFrameEditorOpen(false)} />
      )}
    </div>
  );
};
