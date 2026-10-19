import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Play, RotateCcw, SkipForward, Timer, Trophy, Zap } from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { GoatPlayer } from './types';
import { pastureAudio } from './pastureAudio';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';
import { GameModeProps, recordGame, shuffleWith } from './gameModes';

/**
 * @file GameChrono.tsx
 * Mode « Défi Chrono 60 s » : rafale de face-à-face A/B sur la discipline
 * active. +1 point par duel ; l'enchaînement (série) multiplie les points
 * (×2 dès 3 duels d'affilée, jusqu'à ×5). Passer un duel remet la série à zéro.
 *
 * Le record local porte sur le nombre de duels votés en 60 secondes, et chaque
 * face-à-face fait entrer ses deux adversaires dans l'album Panini.
 */

const DURATION_S = 60;
const MAX_DUELS = 100;

export const GameChrono: React.FC<GameModeProps> = ({ sport, pool }) => {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [queue, setQueue] = useState<GoatPlayer[]>([]);
  const [cursor, setCursor] = useState(0);
  const [left, setLeft] = useState(DURATION_S);
  const [score, setScore] = useState(0);
  const [duels, setDuels] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // Les valeurs souscrites à la fin du chrono passent par des refs : le compte
  // à rebours ne redémarre pas à chaque point marqué.
  const deadlineRef = useRef(0);
  const scoreRef = useRef(0);
  const duelsRef = useRef(0);
  const streakRef = useRef(0);

  const playable = pool.length >= 2;

  const finish = useCallback(() => {
    setPhase('done');
    setLeft(0);
    pastureAudio.playWhistle();
    pastureAudio.playRoyalChime();
    addCrottins(scoreRef.current, 'chrono');
    recordGame('chrono', sport, duelsRef.current);
  }, [sport]);

  const start = useCallback(() => {
    const shuffled = shuffleWith(pool, Math.random);
    const usable = shuffled.length - (shuffled.length % 2);
    setQueue(shuffled.slice(0, Math.min(usable, MAX_DUELS * 2)));
    setCursor(0);
    setScore(0);
    setDuels(0);
    setStreak(0);
    setBestStreak(0);
    scoreRef.current = 0;
    duelsRef.current = 0;
    streakRef.current = 0;
    deadlineRef.current = Date.now() + DURATION_S * 1000;
    setLeft(DURATION_S);
    setPhase('running');
    pastureAudio.playBell(880);
  }, [pool]);

  useEffect(() => {
    if (phase !== 'running') return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) finish();
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, finish]);

  const duel = useMemo(() => {
    if (cursor + 1 >= queue.length) return null;
    return [queue[cursor], queue[cursor + 1]] as const;
  }, [queue, cursor]);

  // Vivier épuisé avant la fin des 60 s : on clôture proprement.
  useEffect(() => {
    if (phase === 'running' && !duel) finish();
  }, [phase, duel, finish]);

  const vote = (winner: GoatPlayer, loser: GoatPlayer) => {
    const nextStreak = streakRef.current + 1;
    const multiplier = 1 + Math.min(4, Math.floor(nextStreak / 3));
    const nextScore = scoreRef.current + multiplier;
    const nextDuels = duelsRef.current + 1;

    streakRef.current = nextStreak;
    scoreRef.current = nextScore;
    duelsRef.current = nextDuels;

    setStreak(nextStreak);
    setBestStreak((value) => Math.max(value, nextStreak));
    setScore(nextScore);
    setDuels(nextDuels);
    setCursor((value) => value + 2);

    pastureAudio.playBounce();
    if (nextStreak % 5 === 0) pastureAudio.playRoyalChime();
    discoverVignettes(sport, [winner.id, loser.id]);
  };

  const skip = () => {
    streakRef.current = 0;
    setStreak(0);
    setCursor((value) => value + 2);
    pastureAudio.playBleat('chevreau');
  };

  const multiplier = 1 + Math.min(4, Math.floor(streak / 3));

  if (!playable) {
    return <p className="text-xs text-slate-500">Il faut au moins deux joueurs dans la discipline.</p>;
  }

  if (phase === 'idle' || phase === 'done') {
    return (
      <div className="space-y-4">
        {phase === 'done' ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-black text-amber-300">
              <Trophy className="w-4 h-4" />
              {duels} duels votés — {score} point{score > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-slate-400">
              Meilleur enchaînement : {bestStreak} duel{bestStreak > 1 ? 's' : ''} d'affilée. +
              {score} Crottin{score > 1 ? 's' : ''} d'Or reversé{score > 1 ? 's' : ''} à ton
              pécule.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            60 secondes, un maximum de face-à-face. Chaque duel voté rapporte 1 point, et
            l'enchaînement multiplie les points (×2 dès 3 duels d'affilée, jusqu'à ×5). Passer un
            duel remet la série à zéro.
          </p>
        )}

        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer"
        >
          {phase === 'done' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {phase === 'done' ? 'Rejouer le défi' : 'Lancer le défi chrono'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-amber-200 text-xs font-black tabular-nums"
          role="timer"
          aria-label="Temps restant"
        >
          <Timer className="w-3.5 h-3.5" />
          {left} s
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-white text-xs font-black tabular-nums">
          {score} pt{score > 1 ? 's' : ''}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-black tabular-nums ${
            streak >= 3
              ? 'border-orange-400/50 bg-orange-500/10 text-orange-300'
              : 'border-slate-700 bg-slate-950/70 text-slate-300'
          }`}
          title="Série en cours"
        >
          <Flame className="w-3.5 h-3.5" />
          {streak}
          {multiplier > 1 && <span className="text-[10px]">(×{multiplier})</span>}
        </span>
        <button
          type="button"
          onClick={finish}
          className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Terminer
        </button>
      </div>

      <div
        className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={DURATION_S}
        aria-valuenow={DURATION_S - left}
        aria-label="Chrono"
      >
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-[width] duration-200 ease-linear"
          style={{ width: `${((DURATION_S - left) / DURATION_S) * 100}%` }}
        />
      </div>

      {duel && (
        <>
          <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
            Duel {duels + 1} — qui est le GOAT ?
          </p>

          <div className="flex items-start justify-center gap-3 sm:gap-6">
            {duel.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => vote(player, player.id === duel[0].id ? duel[1] : duel[0])}
                className="w-full max-w-[320px] text-left rounded-2xl p-1.5 border border-slate-700 hover:border-amber-300 hover:bg-amber-400/5 transition-colors cursor-pointer"
              >
                <PlayerCard player={player} variant="reserve" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={skip}
            className="mx-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Passer (remet la série à zéro)
          </button>
        </>
      )}

      <p className="text-center text-[11px] text-slate-500 inline-flex items-center gap-1.5 w-full justify-center">
        <Zap className="w-3.5 h-3.5 text-amber-300" />
        Chaque duel fait entrer ses deux joueurs dans ton album Panini.
      </p>
    </div>
  );
};

