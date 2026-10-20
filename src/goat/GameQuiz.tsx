import React, { useCallback, useState } from 'react';
import { CheckCircle2, Lightbulb, Play, RotateCcw, Search, Trophy, XCircle } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { GoatPlayer } from './types';
import { flagEmoji } from './fallbackAvatar';
import { pastureAudio } from './pastureAudio';
import { addCrottins } from './useGoatProgression';
import { discoverVignettes } from './usePaniniAlbum';
import { GameModeProps, decadeOf, recordGame, shuffleWith } from './gameModes';
import { useGameKeys } from './useGameKeys';

/**
 * @file GameQuiz.tsx
 * Mode « Trouve le GOAT » : 10 joueurs mystère, trois indices révélés un à un
 * (décennie, pays, palmarès) et six vignettes pour répondre. Le plus tôt tu
 * trouves, le plus tu marques (3 points au premier indice, 1 au dernier).
 *
 * Les vignettes de réponse n'affichent **pas** les années de carrière : sinon
 * l'indice « décennie » serait lisible sur chaque carte.
 */

const QUESTIONS = 10;
const OPTIONS = 6;
/** Score maximal d'une partie (3 points par question). */
const MAX_SCORE = QUESTIONS * 3;

interface QuizQuestion {
  mystery: GoatPlayer;
  options: GoatPlayer[];
}

interface QuizFeedback {
  chosenId: string;
  correct: boolean;
  points: number;
}

/** Vignette de réponse : photo + nom, sans les années (indice conservé). */
const MysteryCard: React.FC<{
  player: GoatPlayer;
  tone?: 'idle' | 'good' | 'bad' | 'answer';
  disabled?: boolean;
  onClick?: () => void;
}> = ({ player, tone = 'idle', disabled = false, onClick }) => {
  const border =
    tone === 'good' || tone === 'answer'
      ? 'border-emerald-400 ring-2 ring-emerald-400/50'
      : tone === 'bad'
        ? 'border-rose-500/70'
        : 'border-slate-700';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full max-w-[220px] text-left rounded-2xl border p-1.5 bg-[#101b15] transition-colors ${border} ${
        disabled ? '' : 'hover:border-amber-300 hover:bg-amber-400/5 cursor-pointer'
      }`}
    >
      <PlayerAvatar player={player} className="w-full aspect-[3/4] rounded-xl" />
      <div className="px-1 pt-1 pb-1 min-h-[34px]">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">
          {player.name}
        </p>
        {(tone === 'good' || tone === 'answer') && (
          <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">
            C'était lui
          </p>
        )}
        {tone === 'bad' && (
          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">
            Raté
          </p>
        )}
      </div>
    </button>
  );
};

/** Construit une question : un joueur mystère + 5 leurres de la même époque. */
function buildQuestion(
  pool: readonly GoatPlayer[],
  usedIds: Set<string>,
  random: () => number,
): QuizQuestion | null {
  const candidates = pool.filter((player) => player.name && !usedIds.has(player.id));
  if (candidates.length < OPTIONS) return null;

  const shuffled = shuffleWith(candidates, random);
  const mystery = shuffled[0];
  const decade = decadeOf(mystery);

  const sameEra = candidates.filter(
    (player) =>
      player.id !== mystery.id &&
      decade !== null &&
      Math.abs((decadeOf(player) ?? -9999) - decade) <= 20,
  );

  const decoys = shuffleWith(sameEra, random).slice(0, OPTIONS - 1);
  const decoyIds = new Set(decoys.map((player) => player.id));
  const filler = shuffleWith(
    candidates.filter((player) => player.id !== mystery.id && !decoyIds.has(player.id)),
    random,
  );
  while (decoys.length < OPTIONS - 1 && filler.length > 0) {
    decoys.push(filler.pop() as GoatPlayer);
  }

  return { mystery, options: shuffleWith([mystery, ...decoys], random) };
}

export const GameQuiz: React.FC<GameModeProps> = ({ sport, pool }) => {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [usedIds, setUsedIds] = useState<string[]>([]);

  const start = useCallback(() => {
    const first = buildQuestion(pool, new Set(), Math.random);
    setPhase('playing');
    setRound(1);
    setScore(0);
    setFeedback(null);
    setQuestion(first);
    setRevealed(1);
    setUsedIds(first ? [first.mystery.id] : []);
    pastureAudio.playBell(880);
  }, [pool]);

  const next = () => {
    if (round >= QUESTIONS || !question) {
      addCrottins(score, 'quiz');
      recordGame('quiz', sport, score);
      setPhase('done');
      setQuestion(null);
      setFeedback(null);
      pastureAudio.playRoyalChime();
      return;
    }

    const following = buildQuestion(pool, new Set(usedIds), Math.random);
    if (!following) {
      addCrottins(score, 'quiz');
      recordGame('quiz', sport, score);
      setPhase('done');
      setQuestion(null);
      return;
    }

    setRound((value) => value + 1);
    setQuestion(following);
    setRevealed(1);
    setFeedback(null);
    setUsedIds((ids) => [...ids, following.mystery.id]);
  };

  const answer = (optionId: string) => {
    if (feedback || !question) return;
    const correct = optionId === question.mystery.id;
    const points = correct ? Math.max(1, 4 - revealed) : 0;
    setFeedback({ chosenId: optionId, correct, points });
    if (correct && points > 0) {
      setScore((value) => value + points);
      pastureAudio.playBell(1100);
    } else {
      pastureAudio.playBleat('chevreau');
    }
    discoverVignettes(sport, [question.mystery.id, optionId]);
  };

  // 1…6 pour répondre, Entrée pour passer à la question suivante.
  useGameKeys({
    enabled: phase === 'playing' && Boolean(question),
    digits: question && !feedback ? question.options.map((option) => () => answer(option.id)) : undefined,
    next: feedback ? next : undefined,
  });

  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          10 joueurs mystère. Trois indices révélés un à un — la décennie, le pays, puis le
          palmarès — et six vignettes pour désigner le bon athlète. Un joueur trouvé au premier
          indice rapporte 3 points, 2 points ensuite, 1 point au dernier. Chaque joueur rencontré
          rejoint ton album Panini.
        </p>
        <button
          type="button"
          onClick={start}
          disabled={pool.length < OPTIONS}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4" />
          Lancer le quiz
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
            {score} point{score > 1 ? 's' : ''} sur {MAX_SCORE}
          </p>
          <p className="text-[11px] text-slate-400">
            +{score} Crottin{score > 1 ? 's' : ''} d'Or reversé{score > 1 ? 's' : ''} à ton pécule.
            Ton meilleur score est enregistré pour la discipline.
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

  if (!question) {
    return <p className="text-xs text-slate-500">Base de joueurs trop petite pour un quiz.</p>;
  }

  const mystery = question.mystery;
  const decade = decadeOf(mystery);
  const revealedIndices = [
    <span key="decennie">
      Sa carrière commence {decade !== null ? `dans les années ${decade}` : 'il y a longtemps'}
      {mystery.career ? ` (${mystery.career})` : ''}.
    </span>,
    <span key="pays">
      Il représente {flagEmoji(mystery.countryCode)} {mystery.countryCode ?? 'un pays inconnu'}.
    </span>,
    <span key="palmares">
      Palmarès recensé : {mystery.trophiesCount ?? 0} trophée
      {(mystery.trophiesCount ?? 0) > 1 ? 's' : ''}
      {mystery.isLegend ? ', marque « légende »' : ''}
      {mystery.isCurrentlyCompeting ? ', encore en compétition' : ''}.
    </span>,
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-white text-xs font-black tabular-nums">
          Question {round}/{QUESTIONS}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-700 text-amber-200 text-xs font-black tabular-nums">
          {score} pt{score > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={next}
          className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Arrêter
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-300">
          <Search className="w-3.5 h-3.5" />
          Qui est le GOAT mystère ?
        </p>
        <ul className="space-y-1.5">
          {revealedIndices.slice(0, revealed).map((indice, position) => (
            <li key={position} className="flex items-start gap-2 text-xs text-slate-300">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300" />
              <span>{indice}</span>
            </li>
          ))}
        </ul>
        {!feedback && revealed < 3 && (
          <button
            type="button"
            onClick={() => {
              setRevealed((value) => Math.min(3, value + 1));
              pastureAudio.playBounce();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Indice suivant (il te restera {3 - revealed} point{3 - revealed > 1 ? 's' : ''})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 justify-items-center">
        {question.options.map((option) => {
          const tone = feedback
            ? option.id === mystery.id
              ? 'answer'
              : option.id === feedback.chosenId
                ? 'bad'
                : 'idle'
            : 'idle';
          return (
            <MysteryCard
              key={option.id}
              player={option}
              tone={feedback ? tone : 'idle'}
              disabled={Boolean(feedback) || option.id === feedback?.chosenId}
              onClick={() => answer(option.id)}
            />
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <p
            className={`inline-flex items-center gap-2 text-xs font-black ${
              feedback.correct ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            {feedback.correct ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {feedback.correct
              ? `Trouvé ! +${feedback.points} point${feedback.points > 1 ? 's' : ''}`
              : `Raté — c'était ${mystery.name}`}
          </p>
          <p className="text-[11px] text-slate-400">
            {mystery.name} · {flagEmoji(mystery.countryCode)} {mystery.countryCode ?? '—'} ·{' '}
            {mystery.career} · {mystery.trophiesCount ?? 0} trophée
            {(mystery.trophiesCount ?? 0) > 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-colors cursor-pointer"
          >
            {round >= QUESTIONS ? 'Voir le bilan' : 'Question suivante'}
          </button>
        </div>
      )}
    </div>
  );
};
