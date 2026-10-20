import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Share2, Swords, X } from 'lucide-react';
import { SharedDuel, SharedPyramid, buildDuelLink, clearShareParams, copyText } from './challenge';
import { GoatPlayer } from './types';
import { PlayerCard } from './PlayerCard';
import { getSport } from './sportsCatalog';
import { addCrottins } from './useGoatProgression';

/**
 * @file ChallengeBanners.tsx
 * Bandeaux de défi reçus par lien :
 *  - `?p=…` : une pyramide à consulter puis à « riposter » (adoption) ;
 *  - `?d=…` : un duel déjà tranché par l'auteur, à départager à son tour.
 *
 * Aucun compte, aucun serveur : tout vient de l'URL.
 */

interface PyramidChallengeProps {
  shared: SharedPyramid;
  players: GoatPlayer[];
  currentSport: string;
  onAdopt: (input: {
    assignments: Record<string, string>;
    hotTake?: string | null;
    expertMode?: boolean;
  }) => void;
  onSwitchSport: (sport: SharedPyramid['sport']) => void;
  onDismiss: () => void;
}

export const PyramidChallengeBanner: React.FC<PyramidChallengeProps> = ({
  shared,
  players,
  currentSport,
  onAdopt,
  onSwitchSport,
  onDismiss,
}) => {
  const sport = getSport(shared.sport);
  const sameSport = shared.sport === currentSport;

  const { assignments, kept, topName } = useMemo(() => {
    const available = new Set(players.map((player) => player.id));
    const result: Record<string, string> = {};
    for (const [slot, playerId] of shared.picks) {
      if (available.has(playerId)) result[slot] = playerId;
    }
    const top = shared.picks.find(([slot]) => slot === 'L1-0')?.[1];
    const name = top ? players.find((player) => player.id === top)?.name : undefined;
    return { assignments: result, kept: Object.keys(result).length, topName: name };
  }, [players, shared.picks]);

  const author = shared.author || 'un ami';

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 via-slate-900/70 to-amber-400/10 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="inline-flex items-center gap-2 text-amber-200 text-xs font-black uppercase tracking-widest whitespace-nowrap">
        <Swords className="w-4 h-4" />
        Défi reçu
      </span>
      <p className="text-[11px] text-slate-200 flex-1 min-w-0">
        <strong className="text-white">{author}</strong> te défie sur{' '}
        <strong className="text-amber-200">
          {sport.emoji} {sport.label}
        </strong>{' '}
        — {shared.picks.length} place{shared.picks.length > 1 ? 's' : ''} remplie
        {shared.picks.length > 1 ? 's' : ''}
        {sameSport && topName ? (
          <>
            , GOAT ultime : <strong className="text-white">{topName}</strong>
          </>
        ) : null}
        .
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {!sameSport && (
          <button
            type="button"
            onClick={() => onSwitchSport(shared.sport)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-600 text-slate-200 text-[11px] font-bold hover:border-amber-300/60 transition-colors cursor-pointer"
          >
            Voir la discipline
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {sameSport && (
          <button
            type="button"
            onClick={() => {
              if (
                Object.keys(assignments).length === 0 ||
                window.confirm(
                  `Riposter le classement de ${author} ?\n\nTa pyramide ${sport.shortLabel} actuelle sera remplacée (${kept} place${kept > 1 ? 's' : ''} reprise${kept > 1 ? 's' : ''}).`,
                )
              ) {
                onAdopt({
                  assignments,
                  hotTake: shared.hotTake,
                  expertMode: shared.expertMode,
                });
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black transition-colors cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" />
            Riposter
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          title="Ignorer ce défi"
          className="w-8 h-8 inline-flex items-center justify-center rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface DuelChallengeProps {
  duel: SharedDuel;
  players: GoatPlayer[];
  onDismiss: () => void;
}

export const DuelChallengeBanner: React.FC<DuelChallengeProps> = ({ duel, players, onDismiss }) => {
  const [choice, setChoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const left = players.find((player) => player.id === duel.leftId);
  const right = players.find((player) => player.id === duel.rightId);
  const author = duel.author || 'un ami';
  const sport = getSport(duel.sport);

  if (!left || !right) return null;

  const agree = choice !== null && duel.pickId !== null && choice === duel.pickId;
  const rejected = choice !== null && duel.pickId !== null && choice !== duel.pickId;

  const share = async () => {
    const ok = await copyText(
      buildDuelLink({
        sport: duel.sport,
        author: '',
        leftId: duel.leftId,
        rightId: duel.rightId,
        pickId: duel.pickId,
      }),
    );
    if (ok) setCopied(true);
  };

  return (
    <div className="rounded-2xl border border-fuchsia-400/35 bg-gradient-to-r from-fuchsia-500/10 via-slate-900/70 to-fuchsia-500/5 p-3.5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-2 text-fuchsia-200 text-xs font-black uppercase tracking-widest">
          <Swords className="w-4 h-4" />
          Duel de {author}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">
          {sport.emoji} {sport.shortLabel} — qui est le GOAT ?
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
          title="Ignorer ce duel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start justify-center gap-3">
        {[left, right].map((player) => {
          const selected = choice === player.id;
          return (
            <button
              key={player.id}
              type="button"
              disabled={choice !== null}
              onClick={() => {
                setChoice(player.id);
                addCrottins(2, 'duel');
              }}
              className={`w-full max-w-[190px] text-left rounded-2xl p-1.5 border transition-colors ${
                selected
                  ? 'border-fuchsia-400 bg-fuchsia-400/10'
                  : 'border-slate-700 hover:border-fuchsia-300/70 disabled:opacity-60 cursor-pointer'
              }`}
            >
              <PlayerCard player={player} variant="reserve" />
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
          <p className="text-[11px] font-semibold text-slate-200 flex-1">
            {duel.pickId === null
              ? `Vote enregistré : ${choice === left.id ? left.name : right.name}.`
              : agree
                ? `Même choix que ${author} — le troupeau est d’accord. 🍻`
                : rejected
                  ? `Pas d’accord avec ${author} : la chèvre couronnée apprécie la contestation. 😤`
                  : 'Vote enregistré.'}
          </p>
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-[10px] font-bold hover:border-fuchsia-300/60 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Lien copié' : 'Transmettre ce duel'}
          </button>
          <button
            type="button"
            onClick={() => {
              clearShareParams();
              onDismiss();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-950 text-[10px] font-black hover:bg-white transition-colors cursor-pointer"
          >
            <Share2 className="w-3 h-3" />
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};
