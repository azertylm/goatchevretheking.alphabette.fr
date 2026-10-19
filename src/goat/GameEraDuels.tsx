import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  Hourglass,
  Play,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import { PlayerCard } from './PlayerCard';
import { GoatPlayer } from './types';
import { flagEmoji } from './fallbackAvatar';
import { pastureAudio } from './pastureAudio';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';
import {
  GameModeProps,
  consensusRanks,
  eraDistance,
  eraPairs,
  nextFreeTopSlot,
  recordGame,
  standardWinner,
} from './gameModes';

/**
 * @file GameEraDuels.tsx
 * Mode « Duels d'époques » : 8 face-à-face entre les débuts de carrière les
 * plus éloignés de la discipline. Après le vote : palmarès des deux joueurs,
 * écart d'années et verdict du classement standard (palmarès recensé).
 *
 * Le vainqueur choisi peut être intronisé au sommet de la pyramide.
 */

const DUELS = 8;

interface VoteRecord {
  winnerId: string;
  /** Le choix suit-il le classement standard ? */
  conforme: boolean;
}

export const GameEraDuels: React.FC<GameModeProps> = ({ sport, pool, api }) => {
  const [pairs, setPairs] = useState<Array<[GoatPlayer, GoatPlayer]>>([]);
  const [index, setIndex] = useState(0);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [started, setStarted] = useState(false);

  const ranks = useMemo(() => consensusRanks(pool), [pool]);
  const duel = pairs[index] ?? null;

  const conformes = votes.filter((vote) => vote.conforme).length;

  const start = useCallback(() => {
    setPairs(eraPairs(pool, DUELS, Math.random));
    setIndex(0);
    setVotes([]);
    setRevealed(false);
    setStarted(true);
    pastureAudio.playWhistle();
  }, [pool]);

  const vote = (picked: GoatPlayer, other: GoatPlayer) => {
    const reference = standardWinner(picked, other);
    const conforme = reference.id === picked.id;
    setVotes((current) => [...current, { winnerId: picked.id, conforme }]);
    setRevealed(true);
    pastureAudio.playBell(conforme ? 880 : 620);
    discoverVignettes(sport, [picked.id, other.id]);
  };

  const next = () => {
    if (index + 1 >= pairs.length) {
      const total = votes.filter((entry) => entry.conforme).length;
      addCrottins(votes.length + total * 2, 'epoques');
      recordGame('epoques', sport, total);
      setIndex(index + 1);
      pastureAudio.playRoyalChime();
      return;
    }
    setIndex(index + 1);
    setRevealed(false);
  };

  const place = (player: GoatPlayer) => {
    const slot = nextFreeTopSlot(api.state.assignments, api.state.expertMode);
    if (!slot) return;
    api.place(slot, player.id);
  };

  if (!started || pairs.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          8 duels entre les carrières les plus éloignées de la discipline. Après chaque vote : les
          palmarès, l'écart d'années et le verdict du classement standard. Astuce : les duels ne
          sont pas tirés au hasard, ils opposent les extrémités de l'histoire du sport.
        </p>
        <button
          type="button"
          onClick={start}
          disabled={pool.length < 4}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4" />
          Lancer les duels d'époques
        </button>
      </div>
    );
  }

  if (!duel) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-2">
          <p className="inline-flex items-center gap-2 text-sm font-black text-amber-300">
            <Trophy className="w-4 h-4" />
            {votes.length} duels joués — {conformes} vote{conformes > 1 ? 's' : ''} du côté du
            classement standard
          </p>
          <p className="text-[11px] text-slate-400">
            +{votes.length + conformes * 2} Crottins d'Or reversés à ton pécule. Tu peux relancer un
            tirage : les appariements sont tirés à chaque partie.
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-black transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Nouveau tirage
        </button>
      </div>
    );
  }

  const [left, right] = duel;
  const chosen = revealed ? votes[votes.length - 1] : null;
  const chosenPlayer = chosen ? [left, right].find((p) => p.id === chosen.winnerId) ?? null : null;
  const gap = eraDistance(left, right);
  const slot = nextFreeTopSlot(api.state.assignments, api.state.expertMode);

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
        Duel {index + 1}/{pairs.length}
        {gap !== null && (
          <span className="ml-2 inline-flex items-center gap-1 text-amber-300/90 normal-case tracking-normal">
            <Hourglass className="w-3 h-3" />
            {gap} ans d'écart
          </span>
        )}
      </p>

      <div className="flex items-start justify-center gap-3 sm:gap-6">
        {duel.map((player) => (
          <button
            key={player.id}
            type="button"
            disabled={revealed}
            onClick={() => vote(player, player.id === left.id ? right : left)}
            className={`w-full max-w-[320px] text-left rounded-2xl p-1.5 border transition-colors ${
              revealed
                ? chosen?.winnerId === player.id
                  ? 'border-amber-400 bg-amber-400/5'
                  : 'border-slate-800 opacity-60'
                : 'border-slate-700 hover:border-amber-300 hover:bg-amber-400/5 cursor-pointer'
            }`}
          >
            <PlayerCard player={player} variant="reserve" />
          </button>
        ))}
      </div>

      {revealed && chosen && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4 space-y-3">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {duel.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white truncate">
                    {player.name}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {flagEmoji(player.countryCode)} {player.countryCode ?? '—'} · {player.career}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] font-black text-amber-300">
                    {player.trophiesCount ?? 0} trophée{(player.trophiesCount ?? 0) > 1 ? 's' : ''}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    n°{ranks.get(player.id) ?? '—'} au standard
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p
            className={`inline-flex items-start gap-2 text-[11px] font-semibold ${
              chosen.conforme ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {chosen.conforme ? (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>
              {chosen.conforme
                ? 'Choix consensuel : le classement standard te suit.'
                : `Choix audacieux : le classement standard préfère ${standardWinner(left, right).name}. Ta pyramide s'écarte du consensus.`}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              {index + 1 >= pairs.length ? 'Voir le bilan' : 'Duel suivant'}
            </button>

            {chosenPlayer && (
              <button
                type="button"
                onClick={() => place(chosenPlayer)}
                disabled={!slot}
                title={slot ? 'Introniser au sommet de la pyramide' : 'Le sommet de la pyramide est complet'}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-50 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                Placer {chosenPlayer.name} au sommet
              </button>
            )}
          </div>
        </div>
      )}

      {!revealed && (
        <p className="text-center text-[11px] text-slate-500">
          {conformes} vote{conformes > 1 ? 's' : ''} conforme{conformes > 1 ? 's' : ''} au
          classement standard jusqu'ici.
        </p>
      )}
    </div>
  );
};

