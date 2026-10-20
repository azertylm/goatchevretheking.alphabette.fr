import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Flame, Hourglass, Sparkles, Swords } from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { GoatPlayer } from './types';
import { flagEmoji } from './fallbackAvatar';
import { pastureAudio } from './pastureAudio';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';
import {
  GameModeProps,
  STANDARD_RANKING_LABEL,
  dailyPair,
  dailyVoteFor,
  dayKey,
  forecastPercent,
  formatDay,
  recordGame,
  registerDailyVote,
  shiftDay,
  standardWinner,
  useGamesState,
} from './gameModes';
import { useGameKeys } from './useGameKeys';

/**
 * @file GameDailyDuel.tsx
 * Mode « Duel du jour » : un seul face-à-face par discipline et par jour, tiré
 * de façon **déterministe** (discipline + date) — le même duel pour tous les
 * visiteurs. Le vote entretient une série de jours consécutifs.
 *
 * Sans backend, le pourcentage affiché est le **pronostic du classement
 * standard** (palmarès recensé), annoncé comme tel : il deviendra le vote réel
 * de la communauté dès que le serveur du hub agrègera les votes.
 */

/** Heures restantes avant le prochain duel (minuit local). */
function hoursUntilTomorrow(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.ceil((tomorrow.getTime() - now.getTime()) / 3_600_000));
}

export const GameDailyDuel: React.FC<GameModeProps> = ({ sport, pool }) => {
  const games = useGamesState();
  const day = dayKey();
  const yesterday = shiftDay(day, -1);
  const [hoursLeft, setHoursLeft] = useState(hoursUntilTomorrow);

  useEffect(() => {
    const timer = window.setInterval(() => setHoursLeft(hoursUntilTomorrow()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const pair = useMemo(() => dailyPair(pool, sport, day), [pool, sport, day]);
  const vote = dailyVoteFor(day, sport, games);
  const yesterdayVote = dailyVoteFor(yesterday, sport, games);
  const yesterdayPair = useMemo(
    () => (yesterdayVote ? dailyPair(pool, sport, yesterday) : null),
    [yesterdayVote, pool, sport, yesterday],
  );

  const left = pair?.[0];
  const right = pair?.[1];

  const choose = (player: GoatPlayer, opponent: GoatPlayer) => {
    if (vote || !pair) return;
    const streakBefore = games.streak.lastDay;
    const nextStreak =
      streakBefore === day
        ? games.streak.count
        : streakBefore === yesterday
          ? games.streak.count + 1
          : 1;

    registerDailyVote(day, sport, player.id);
    addCrottins(5, 'jour');
    recordGame('duel-du-jour', sport, nextStreak);
    pastureAudio.playBell(990);
    discoverVignettes(sport, [player.id, opponent.id]);
  };

  // ← / A et → / D pour voter le duel du jour.
  useGameKeys({
    enabled: Boolean(pair) && !vote,
    left: left && right ? () => choose(left, right) : undefined,
    right: left && right ? () => choose(right, left) : undefined,
  });

  if (!pair || !left || !right) {
    return <p className="text-xs text-slate-500">Il faut au moins deux joueurs dans la discipline.</p>;
  }

  const picked = vote ? [left, right].find((player) => player.id === vote.choiceId) ?? null : null;
  const other = vote ? [left, right].find((player) => player.id !== vote.choiceId) ?? null : null;
  const reference = standardWinner(left, right);
  const percentLeft = forecastPercent(left, right);
  const conformes = picked ? picked.id === reference.id : false;

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
        Duel du {formatDay(day)}
        <span className="ml-2 normal-case tracking-normal text-slate-500">
          · le même pour toute la communauté
        </span>
      </p>

      <div className="flex items-start justify-center gap-3 sm:gap-6">
        {pair.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={Boolean(vote)}
            onClick={() => choose(player, player.id === left.id ? right : left)}
            className={`w-full max-w-[320px] text-left rounded-2xl p-1.5 border transition-colors ${
              vote
                ? picked?.id === player.id
                  ? 'border-amber-400 bg-amber-400/5'
                  : 'border-slate-800 opacity-60'
                : 'border-slate-700 hover:border-amber-300 hover:bg-amber-400/5 cursor-pointer'
            }`}
          >
            <PlayerCard player={player} variant="reserve" />
          </button>
        ))}
      </div>

      {!vote && (
        <>
          <p className="text-center text-[11px] text-slate-500">
            Un vote par discipline et par jour. Le tirage dépend de la date : tous les visiteurs
            votent sur le même duel.
          </p>
          <p className="text-center text-[11px] text-amber-300/90 inline-flex items-center gap-1.5 w-full justify-center">
            <Swords className="w-3.5 h-3.5" />
            +5 Crottins d'Or et une journée de plus dans ta série.
          </p>
        </>
      )}

      {vote && picked && other && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-black text-white">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Ton vote du jour : {picked.name}
            <span className="font-semibold text-slate-400">
              {flagEmoji(picked.countryCode)} {picked.countryCode ?? '—'} · {picked.career}
            </span>
          </p>

          {/* Pronostic du classement standard (palmarès recensé) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400">
              Pronostic du {STANDARD_RANKING_LABEL} : {percentLeft} % pour {left.name}
            </p>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-800" role="img" aria-label={`Pronostic du classement standard : ${percentLeft} % pour ${left.name}`}>
              <span className="h-full bg-amber-400" style={{ width: `${percentLeft}%` }} />
              <span className="h-full bg-slate-600" style={{ width: `${100 - percentLeft}%` }} />
            </div>
            <p className="text-[10px] text-slate-500">
              Les votes de la communauté remplaceront ce pronostic dès que le serveur du hub
              agrégera les bulletins (aucun vote n'est envoyé aujourd'hui).
            </p>
          </div>

          <p
            className={`flex items-start gap-2 text-[11px] font-semibold ${
              conformes ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {conformes ? (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>
              {conformes
                ? 'Ton vote suit le classement standard.'
                : `Tu prends le contre-pied : le classement standard désigne ${reference.name} (le mieux classé du face-à-face).`}
            </span>
          </p>

          <p className="flex items-center gap-2 text-[11px] font-bold text-orange-300">
            <Flame className="w-3.5 h-3.5" />
            Série : {games.streak.count} jour{games.streak.count > 1 ? 's' : ''} d'affilée (record :{' '}
            {games.streak.best})
          </p>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Hourglass className="w-3.5 h-3.5" />
            Prochain duel dans environ {hoursLeft} h.
          </p>
        </div>
      )}

      {vote && !picked && (
        <p className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
          Ton vote du jour est enregistré, mais ce face-à-face a changé depuis (mise à jour des
          données de la discipline). Reviens demain pour le prochain duel.
        </p>
      )}

      {yesterdayVote && yesterdayPair && (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-3 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" />
            Le duel d'hier
          </p>
          <p className="text-[11px] text-slate-400">
            {yesterdayPair[0].name} <span className="text-slate-600">contre</span>{' '}
            {yesterdayPair[1].name} — le classement standard désignait{' '}
            <span className="font-bold text-slate-200">
              {standardWinner(yesterdayPair[0], yesterdayPair[1]).name}
            </span>
            . Tu avais choisi{' '}
            <span className="font-bold text-slate-200">
              {[yesterdayPair[0], yesterdayPair[1]].find((p) => p.id === yesterdayVote.choiceId)?.name ??
                'un joueur'}
            </span>
            .
          </p>
        </div>
      )}
    </div>
  );
};

