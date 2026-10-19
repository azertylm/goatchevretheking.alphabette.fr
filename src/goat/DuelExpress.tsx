import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Swords, Trophy, X } from 'lucide-react';
import { GoatPlayer } from './types';
import { PyramidApi } from './usePyramidState';
import { PlayerCard } from './PlayerCard';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';

/**
 * @file DuelExpress.tsx
 * Mini-jeu « Duels Express » : 10 face-à-face tirés au sort.
 * Les vainqueurs sont automatiquement pré-placés au sommet de la pyramide.
 */

const DUEL_COUNT = 10;

interface DuelExpressProps {
  api: PyramidApi;
  pool: GoatPlayer[];
}

interface DuelPair {
  left: GoatPlayer;
  right: GoatPlayer;
}

interface DuelResult {
  winner: GoatPlayer;
  loser: GoatPlayer;
}

/** Tirage de 10 duels à partir de 20 joueurs distincts (aléatoire). */
function buildDuels(pool: GoatPlayer[]): DuelPair[] {
  if (pool.length < 2) return [];

  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[random]] = [shuffled[random], shuffled[index]];
  }

  const needed = Math.min(DUEL_COUNT * 2, shuffled.length - (shuffled.length % 2));
  const duels: DuelPair[] = [];
  for (let index = 0; index < needed; index += 2) {
    duels.push({ left: shuffled[index], right: shuffled[index + 1] });
  }
  return duels;
}

export const DuelExpress: React.FC<DuelExpressProps> = ({ api, pool }) => {
  const [duels, setDuels] = useState<DuelPair[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<DuelResult[]>([]);
  const [placed, setPlaced] = useState(false);

  const isRunning = duels !== null && current < duels.length && !placed;

  /** Place les vainqueurs au sommet : étage 1, puis étage 2, 3, 4… */
  const placeWinners = useCallback(
    (winners: GoatPlayer[]) => {
      const slots = [
        ...Array.from({ length: 1 }, (_, index) => `L1-${index}`),
        ...Array.from({ length: 2 }, (_, index) => `L2-${index}`),
        ...Array.from({ length: 4 }, (_, index) => `L3-${index}`),
        ...Array.from({ length: 8 }, (_, index) => `L4-${index}`),
        ...(api.state.expertMode ? Array.from({ length: 16 }, (_, index) => `L5-${index}`) : []),
      ];

      const uniqueWinners = winners.filter(
        (winner, index, array) => array.findIndex((item) => item.id === winner.id) === index,
      );

      uniqueWinners.forEach((winner, index) => {
        if (slots[index]) api.place(slots[index], winner.id);
      });

      setPlaced(true);
    },
    [api],
  );

  const handlePick = (winner: GoatPlayer, loser: GoatPlayer) => {
    if (!duels) return;

    const nextResults = [...results, { winner, loser }];
    setResults(nextResults);

    // Album Panini : les deux adversaires du duel sont « rencontrés ».
    discoverVignettes(winner.sport, [winner.id, loser.id]);

    // Récompense : +5 Crottins d'Or par duel voté.
    addCrottins(5, 'duel');

    if (current + 1 >= duels.length) {
      placeWinners(nextResults.map((result) => result.winner));
    } else {
      setCurrent((index) => index + 1);
    }
  };

  const start = () => {
    const generated = buildDuels(pool);
    setDuels(generated);
    setCurrent(0);
    setResults([]);
    setPlaced(false);
  };

  const reset = () => {
    setDuels(null);
    setCurrent(0);
    setResults([]);
    setPlaced(false);
  };

  const duel = duels && current < duels.length ? duels[current] : null;

  const tally = useMemo(() => {
    const counts = new Map<string, { player: GoatPlayer; wins: number }>();
    results.forEach((result) => {
      const entry = counts.get(result.winner.id) ?? { player: result.winner, wins: 0 };
      entry.wins += 1;
      counts.set(result.winner.id, entry);
    });
    return [...counts.values()].sort((a, b) => b.wins - a.wins);
  }, [results]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Swords className="w-4 h-4 text-rose-400" />
            Duels Express
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            10 face-à-face rapides — les vainqueurs remontent automatiquement au sommet de la pyramide.
          </p>
        </div>

        {!isRunning && (
          <button
            onClick={start}
            disabled={pool.length < 2}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black transition-colors cursor-pointer"
          >
            <Swords className="w-4 h-4" />
            Faire 10 duels rapides
          </button>
        )}
      </div>

      {/* Duel en cours */}
      {isRunning && duel && (
        <div className="space-y-4">
          <p className="text-center text-xs font-bold text-slate-400">
            Duel {current + 1}/{duels?.length} — qui est le meilleur ?
          </p>

          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {[duel.left, duel.right].map((player) => (
              <button
                key={player.id}
                onClick={() => handlePick(player, player.id === duel.left.id ? duel.right : duel.left)}
                className="text-left rounded-2xl p-2 border border-slate-700 hover:border-rose-400 hover:bg-rose-500/5 transition-colors cursor-pointer"
              >
                <PlayerCard player={player} variant="reserve" />
                <span className="mt-2 block text-center text-[11px] font-black text-rose-300">Je choisis ce joueur</span>
              </button>
            ))}
          </div>

          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(current / (duels?.length ?? DUEL_COUNT)) * 100}%` }}
            />
          </div>

          <button
            onClick={reset}
            className="mx-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Abandonner les duels
          </button>
        </div>
      )}

      {/* Bilan des duels */}
      {placed && !isRunning && (
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            {results.length} duels joués — vainqueurs pré-placés au sommet de la pyramide
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tally.map((entry) => (
              <li
                key={entry.player.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <span className="text-xs font-bold text-white truncate">{entry.player.name}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 shrink-0">
                  <Trophy className="w-3 h-3" />
                  {entry.wins} victoire{entry.wins > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Fermer le bilan
          </button>
        </div>
      )}

      {!isRunning && !placed && (
        <p className="text-xs text-slate-500">
          Astuce : les duels sont tirés au sort parmi les {pool.length} joueurs de l'univers sélectionné.
        </p>
      )}
    </div>
  );
};
