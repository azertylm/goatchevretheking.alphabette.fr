import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  Download,
  Flame,
  History,
  ShoppingBag,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { GoatPlayer } from './types';
import { SportId } from './sportsCatalog';
import {
  ACHIEVEMENTS,
  achievementCount,
  useAchievements,
} from './achievements';
import { useGamesState, GameModeId } from './gameModes';
import { useGoatProgression } from './useGoatProgression';
import { getAlbumTotalCount, getPaniniAlbum, subscribePaniniAlbum } from './usePaniniAlbum';
import { completedPyramids, decadeBadges, exploredDecades, honorBoard, MODE_LABELS, careerStats, formatShortDate } from './collector';
import { getSport } from './sportsCatalog';
import { useCosmetics } from './cosmetics';
import { requestPlay } from './playRequest';
import { pyramidStoreRevision, subscribePyramidStore } from './pyramidModel';

/**
 * @file ViralPanel.tsx
 * « Ta vitrine » : succès, badges de décennies, tableau d'honneur, bilan,
 * boutique de cadres, historique des parties et installation de l'application.
 *
 * Tout est local et dérivé : aucune requête, aucun compte. C'est la page que
 * l'on montre à un ami pour prouver qu'on a labouré le pâturage.
 */

interface ViralPanelProps {
  sport: SportId;
  players: GoatPlayer[];
  assignments: Record<string, string>;
  /** Change de discipline (rejouer une partie d'une autre discipline). */
  onRequestSport?: (sport: SportId) => void;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const MODE_ORDER: GameModeId[] = ['chrono', 'epoques', 'quiz', 'bouc', 'duel-du-jour'];

const cardClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4';

export const ViralPanel: React.FC<ViralPanelProps> = ({
  sport,
  players,
  assignments,
  onRequestSport,
}) => {
  const games = useGamesState();
  const progression = useGoatProgression();
  const achievements = useAchievements();
  const cosmetics = useCosmetics();
  const album = useSyncExternalStore(subscribePaniniAlbum, getPaniniAlbum, getPaniniAlbum);
  const revision = useSyncExternalStore(subscribePyramidStore, pyramidStoreRevision, pyramidStoreRevision);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  const albumCount = useMemo(() => {
    void album;
    return getAlbumTotalCount();
  }, [album]);

  const badges = useMemo(() => decadeBadges(assignments, players), [assignments, players]);
  const explored = exploredDecades(badges);
  const stats = useMemo(() => {
    void revision;
    return careerStats(games);
  }, [games, revision]);
  const unlockedCount = achievementCount(achievements);
  const completed = useMemo(() => {
    void revision;
    return completedPyramids();
  }, [revision]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    setStandalone(window.matchMedia?.('(display-mode: standalone)').matches ?? false);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setInstallPrompt(null);
  };

  const replay = (entry: { mode: GameModeId; sport: SportId }) => {
    if (entry.sport !== sport) onRequestSport?.(entry.sport);
    requestPlay(entry.mode);
    document.getElementById('jeux-du-paturage')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return (
    <section
      id="ma-vitrine"
      aria-label="Ma vitrine"
      className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-amber-500/5 p-4 sm:p-6 scroll-mt-24 space-y-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Award className="w-4 h-4 text-amber-300" />
            Ta vitrine
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Succès, décennies, records et boutique — tout ce que tu as accompli sur {getSport(sport).shortLabel},
            sans compte ni serveur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-amber-200">
            <Sparkles className="w-3 h-3" />
            {unlockedCount} / {ACHIEVEMENTS.length} succès
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-slate-300">
            <Flame className="w-3 h-3 text-orange-300" />
            série {games.streak.count} j
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-slate-300">
            <Crown className="w-3 h-3 text-amber-300" />
            {progression.title}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Succès */}
        <div className={`${cardClass} lg:col-span-2`}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Succès du pâturage
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((achievement) => {
              const unlockedAt = achievements.unlocked[achievement.id];
              const value = Math.min(achievement.goal, achievement.progress({
                coins: progression.coins,
                score: progression.score,
                games,
                albumCount,
                completedPyramids: completed,
              }));
              const pct = Math.round((value / achievement.goal) * 100);
              return (
                <li
                  key={achievement.id}
                  className={`rounded-xl border px-2.5 py-2 ${
                    unlockedAt ? 'border-amber-400/40 bg-amber-400/10' : 'border-slate-700/70 bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none" aria-hidden="true">
                      {achievement.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-white leading-tight truncate">
                        {achievement.label}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight truncate" title={achievement.description}>
                        {achievement.description}
                      </p>
                    </div>
                    {unlockedAt ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                        {value}/{achievement.goal}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${unlockedAt ? 'bg-emerald-400' : 'bg-amber-400/70'}`}
                      style={{ width: `${unlockedAt ? 100 : pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Décennies */}
        <div className={cardClass}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            Badges de décennies
          </h3>
          <p className="text-[10px] text-slate-500 mb-3">
            {explored} / 10 décennies explorées dans ta pyramide {getSport(sport).shortLabel}.
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {badges.map((badge) => (
              <div
                key={badge.decade}
                title={`${badge.label} — ${badge.count} joueur${badge.count > 1 ? 's' : ''} (or à partir de 3)`}
                className={`rounded-lg border px-1 py-2 text-center ${
                  badge.tier === 'or'
                    ? 'border-amber-300/70 bg-gradient-to-b from-amber-300/30 to-amber-500/10 text-amber-100'
                    : badge.tier === 'bronze'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      : 'border-slate-700/70 bg-slate-950/40 text-slate-500'
                }`}
              >
                <span className="block text-[10px] font-black tabular-nums">{badge.label}</span>
                <span className="block text-[9px] font-bold opacity-80">
                  {badge.tier === 'or' ? '🥇' : badge.tier === 'bronze' ? '🥉' : '·'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${(explored / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Tableau d'honneur */}
        <div className={`${cardClass} lg:col-span-2`}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3">
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            Tableau d’honneur
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODE_ORDER.map((mode) => {
              const rows = honorBoard(games, mode);
              return (
                <div key={mode} className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-2.5 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    {MODE_LABELS[mode]}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-[10px] text-slate-600">Pas encore de record.</p>
                  ) : (
                    <ol className="space-y-0.5">
                      {rows.map((row, index) => (
                        <li key={`${mode}-${row.sport}`} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-3 text-slate-500 font-black tabular-nums">{index + 1}</span>
                          <span aria-hidden="true">{row.emoji}</span>
                          <span className="text-slate-300 truncate flex-1">{row.sportLabel}</span>
                          <span className="font-black text-amber-200 tabular-nums">{row.score}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bilan */}
        <div className={cardClass}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            Bilan
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['Parties', stats.plays],
              ['Disciplines', stats.sportsPlayed],
              ['Pyramides finies', stats.completed],
              ['Places posées', stats.placed],
              ['Vignettes', albumCount],
              ['Meilleure série', `${stats.bestDayStreak} j`],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-2 py-1.5">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="text-sm font-black text-white tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[10px] text-slate-500">
            {stats.lastPlayedAt ? `Dernière partie : ${formatShortDate(stats.lastPlayedAt)}.` : 'Aucune partie jouée pour l’instant.'}
          </p>
        </div>

        {/* Boutique */}
        <div className={`${cardClass} lg:col-span-2`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
              Boutique de cadres
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-200">
              <span aria-hidden="true">🪙</span>
              {progression.coins} Crottins
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {cosmetics.frames.map((frame) => {
              const owned = cosmetics.owns(frame.id);
              const active = cosmetics.active === frame.id;
              const affordable = progression.coins >= frame.price;
              return (
                <div
                  key={frame.id}
                  className={`rounded-xl border px-2.5 py-2 ${
                    active ? 'border-amber-400/60 bg-amber-400/10' : 'border-slate-700/70 bg-slate-950/40'
                  }`}
                >
                  <p className="text-[11px] font-black text-white flex items-center gap-1.5">
                    <span aria-hidden="true">{frame.emoji}</span>
                    {frame.label}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight min-h-[26px]">{frame.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (owned) {
                        cosmetics.activate(active ? null : frame.id);
                        setShopMessage(active ? `${frame.label} retiré.` : `${frame.label} activé.`);
                        return;
                      }
                      const result = cosmetics.buy(frame.id);
                      setShopMessage(result.ok ? `${frame.label} acheté et activé.` : result.reason ?? 'Achat impossible.');
                    }}
                    className={`mt-1.5 w-full inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : owned
                          ? 'border border-amber-400/40 text-amber-200 hover:bg-amber-400/10'
                          : affordable
                            ? 'bg-slate-100 text-slate-950 hover:bg-white'
                            : 'border border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                    disabled={!owned && !affordable}
                  >
                    {active ? 'Actif — retirer' : owned ? 'Activer' : `Acheter · ${frame.price} 🪙`}
                  </button>
                </div>
              );
            })}
          </div>
          {shopMessage && (
            <p className="mt-2 text-[10px] font-semibold text-emerald-200">{shopMessage}</p>
          )}
        </div>

        {/* Historique */}
        <div className={cardClass}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-2">
            <History className="w-3.5 h-3.5 text-amber-300" />
            Dernières parties
          </h3>
          {games.history.length === 0 ? (
            <p className="text-[10px] text-slate-600">Aucune partie enregistrée.</p>
          ) : (
            <ul className="space-y-1">
              {games.history.slice(0, 6).map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-center gap-1.5 text-[10px]">
                  <span aria-hidden="true">{getSport(entry.sport).emoji}</span>
                  <span className="text-slate-300 truncate flex-1">
                    {MODE_LABELS[entry.mode]} · {getSport(entry.sport).shortLabel}
                  </span>
                  <span className="font-black text-amber-200 tabular-nums">{entry.score}</span>
                  <button
                    type="button"
                    onClick={() => replay(entry)}
                    className="rounded border border-slate-700 px-1.5 py-0.5 font-bold text-slate-300 hover:border-amber-300/60 hover:text-amber-200 transition-colors cursor-pointer"
                    title={`Rejouer ${MODE_LABELS[entry.mode]} en ${getSport(entry.sport).shortLabel}`}
                  >
                    Rejouer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Installation PWA */}
        <div className={cardClass}>
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-300 mb-2">
            <Download className="w-3.5 h-3.5 text-amber-300" />
            Installer l’application
          </h3>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Le pâturage fonctionne hors-ligne après la première visite : ajoute-le à ton écran d’accueil et
            joue sans barre d’adresse.
          </p>
          {standalone ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Application déjà installée.
            </p>
          ) : installPrompt ? (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-2 py-2 text-[10px] font-black text-slate-950 hover:bg-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Installer maintenant
            </button>
          ) : (
            <p className="mt-2 text-[10px] text-slate-500">
              Menu du navigateur → « Installer l’application » ou « Ajouter à l’écran d’accueil ».
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
