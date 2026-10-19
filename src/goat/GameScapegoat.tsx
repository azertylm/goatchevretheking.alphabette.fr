import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Play, RotateCcw, Target, Trophy, XCircle } from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { GoatPlayer } from './types';
import { pastureAudio } from './pastureAudio';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';
import { GameModeProps, consensusRanks, recordGame, shuffleWith } from './gameModes';

/**
 * @file GameScapegoat.tsx
 * Mode « Bouc Émissaire » : 8 manches de 5 vignettes tirées au sort. Il faut
 * désigner celle qui n'a rien à faire au panthéon — c'est-à-dire la plus mal
 * classée au **classement standard** (moins de trophées recensés, et à égalité
 * la carrière la plus courte). +2 points par bonne réponse, et le rang de
 * chacun est révélé après le vote.
 */

const ROUNDS = 8;
const TILES = 5;
interface RoundResult {
  chosenId: string;
  correct: boolean;
}

export const GameScapegoat: React.FC<GameModeProps> = ({ sport, pool }) => {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [tiles, setTiles] = useState<GoatPlayer[]>([]);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [corrects, setCorrects] = useState(0);
  const [usedIds, setUsedIds] = useState<string[]>([]);

  const ranks = useMemo(() => consensusRanks(pool), [pool]);

  /** Le maillon faible : le rang standard le plus élevé (prestige le plus faible). */
  const weakest = useMemo(() => {
    let candidate: GoatPlayer | null = null;
    let worstRank = -1;
    for (const tile of tiles) {
      const rank = ranks.get(tile.id) ?? 0;
      if (rank > worstRank) {
        worstRank = rank;
        candidate = tile;
      }
    }
    return candidate;
  }, [tiles, ranks]);

  const draw = useCallback(
    (used: string[]) => {
      const usedSet = new Set(used);
      const fresh = pool.filter((player) => !usedSet.has(player.id));
      const source = fresh.length >= TILES ? fresh : pool;
      const drawn = shuffleWith(source, Math.random).slice(0, TILES);
      setTiles(drawn);
      setUsedIds((ids) => [...ids, ...drawn.map((player) => player.id)]);
      setResult(null);
    },
    [pool],
  );

  const start = useCallback(() => {
    setPhase('playing');
    setRound(1);
    setCorrects(0);
    setUsedIds([]);
    draw([]);
    pastureAudio.playWhistle();
  }, [draw]);

  const pick = (player: GoatPlayer) => {
    if (result || !weakest) return;
    const correct = player.id === weakest.id;
    setResult({ chosenId: player.id, correct });
    if (correct) {
      setCorrects((value) => value + 1);
      pastureAudio.playBell(1100);
    } else {
      pastureAudio.playBleat('chevreau');
    }
    discoverVignettes(sport, tiles.map((tile) => tile.id));
  };

  const next = () => {
    if (round >= ROUNDS) {
      addCrottins(corrects * 3, 'bouc');
      recordGame('bouc', sport, corrects);
      setPhase('done');
      pastureAudio.playRoyalChime();
      return;
    }
    setRound((value) => value + 1);
    draw(usedIds);
  };

  if (pool.length < TILES) {
    return <p className="text-xs text-slate-500">Il faut au moins cinq joueurs dans la discipline.</p>;
  }

  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Huit manches de cinq vignettes. Dans chaque lot, une seule n'a rien à faire au panthéon :
          désigne le maillon faible — celui que le classement standard place le plus loin (le moins
          titré, et à égalité la carrière la plus courte). +2 points par bonne réponse, et le rang de
          chacun est révélé après ton vote.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4" />
          Lancer les manches
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-300">
            <Trophy className="w-4 h-4" />
            {corrects} maillon{corrects > 1 ? 's' : ''} faible{corrects > 1 ? 's' : ''} démasqué
            {corrects > 1 ? 's' : ''} sur {ROUNDS}
          </p>
          <p className="text-[11px] text-slate-400">
            +{corrects * 3} Crottins d'Or reversés à ton pécule.
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-black transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Rejouer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-white text-xs font-black tabular-nums">
          Manche {round}/{ROUNDS}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-amber-200 text-xs font-black tabular-nums">
          {corrects * 2} pt{corrects * 2 > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={next}
          className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Arrêter
        </button>
      </div>

      <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400 inline-flex items-center justify-center gap-2 w-full">
        <Target className="w-3.5 h-3.5 text-rose-400" />
        Désigne le maillon faible
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {tiles.map((tile) => {
          const isWeakest = weakest?.id === tile.id;
          const isChosen = result?.chosenId === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              disabled={Boolean(result)}
              onClick={() => pick(tile)}
              className={`relative text-left rounded-2xl p-1.5 border transition-colors ${
                result
                  ? isWeakest
                    ? 'border-emerald-400 ring-2 ring-emerald-400/40'
                    : isChosen
                      ? 'border-rose-500/70'
                      : 'border-slate-800 opacity-60'
                  : 'border-slate-700 hover:border-rose-400 hover:bg-rose-500/5 cursor-pointer'
              }`}
            >
              <PlayerCard player={tile} variant="reserve" />
              {result && (
                <span className="mt-1 block text-center text-[10px] font-bold text-slate-400">
                  n°{ranks.get(tile.id) ?? '—'} au standard
                </span>
              )}
              {result && isChosen && (
                <span className="absolute top-1 left-1 text-sm" title="Ton choix">
                  {isWeakest ? '🎯' : '🙈'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {result && weakest && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <p
            className={`inline-flex items-center gap-2 text-xs font-black ${
              result.correct ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            {result.correct ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {result.correct
              ? 'Bien vu ! +2 points'
              : `Raté — le vrai Bouc Émissaire était ${weakest.name}`}
          </p>
          <p className="text-[11px] text-slate-400">
            {weakest.name} est classé n°{ranks.get(weakest.id) ?? '—'} sur {pool.length} au
            classement standard, contre n°
            {Math.min(...tiles.map((tile) => ranks.get(tile.id) ?? 0))} pour le mieux classé du lot.
          </p>
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors cursor-pointer"
          >
            {round >= ROUNDS ? 'Voir le bilan' : 'Manche suivante'}
          </button>
        </div>
      )}
    </div>
  );
};
