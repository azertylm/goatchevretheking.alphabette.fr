import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Sparkles, X } from 'lucide-react';
import {
  ACHIEVEMENTS,
  dismissAchievementToast,
  getAchievementToasts,
  subscribeAchievementToasts,
  syncAchievements,
} from './achievements';
import { useGamesState } from './gameModes';
import { useGoatProgression } from './useGoatProgression';
import { getAlbumTotalCount, getPaniniAlbum, subscribePaniniAlbum } from './usePaniniAlbum';
import { completedPyramids } from './collector';
import { pyramidStoreRevision, subscribePyramidStore } from './pyramidModel';

/**
 * @file AchievementToasts.tsx
 * Veilleur de succès + notifications : à chaque changement de Crottins, de
 * partie, d'album ou de pyramide, les objectifs atteints sont débloqués et
 * annoncés dans un coin de l'écran (jamais deux fois).
 */

export const AchievementWatcher: React.FC = () => {
  const progression = useGoatProgression();
  const games = useGamesState();
  const album = useSyncExternalStore(subscribePaniniAlbum, getPaniniAlbum, getPaniniAlbum);
  const revision = useSyncExternalStore(subscribePyramidStore, pyramidStoreRevision, pyramidStoreRevision);

  const albumCount = useMemo(() => {
    void album;
    return getAlbumTotalCount();
  }, [album]);

  const completed = useMemo(() => {
    void revision;
    return completedPyramids();
  }, [revision]);

  useEffect(() => {
    syncAchievements({
      coins: progression.coins,
      score: progression.score,
      games,
      albumCount,
      completedPyramids: completed,
    });
  }, [progression.coins, progression.score, games, albumCount, completed]);

  return null;
};

export const AchievementToasts: React.FC = () => {
  const toasts = useSyncExternalStore(
    subscribeAchievementToasts,
    getAchievementToasts,
    getAchievementToasts,
  );

  return (
    <div
      aria-live="polite"
      aria-label="Succès débloqués"
      className="fixed bottom-24 sm:bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none"
    >
      {toasts.map((id, index) => {
        const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
        if (!achievement) return null;
        return (
          <div
            key={id}
            className={`goat-fade-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-slate-900/95 backdrop-blur px-3.5 py-3 shadow-2xl shadow-black/50 ${
              index > 0 ? 'hidden sm:flex' : ''
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {achievement.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Sparkles className="w-3 h-3" />
                Succès débloqué
              </p>
              <p className="text-sm font-black text-white leading-tight">{achievement.label}</p>
              <p className="text-[11px] text-slate-400 leading-tight">{achievement.description}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissAchievementToast(id)}
              className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
