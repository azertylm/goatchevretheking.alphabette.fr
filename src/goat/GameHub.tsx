import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Gamepad2,
  Hourglass,
  Search,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';
import { GameChrono } from './GameChrono';
import { GameDailyDuel } from './GameDailyDuel';
import { GameEraDuels } from './GameEraDuels';
import { GameQuiz } from './GameQuiz';
import { GameScapegoat } from './GameScapegoat';
import {
  GameModeId,
  GameModeProps,
  bestScore,
  useGamesState,
} from './gameModes';
import { useGoatProgression } from './useGoatProgression';
import { getSport } from './sportsCatalog';
import { consumePlayRequest, randomMode, subscribePlayRequest } from './playRequest';
import { DuelChallengeBanner } from './ChallengeBanners';
import { SharedDuel, clearShareParams } from './challenge';

/**
 * @file GameHub.tsx
 * « Les jeux du pâturage » : un menu de jeu unique regroupant les modes, avec
 * le record de la discipline active pour chacun. Les modes sont montés à la
 * demande (un seul jeu actif à la fois) et remis à zéro au changement de
 * discipline ou de mode.
 *
 * Gains en Crottins d'Or : +1 point par duel au chrono, +1 Crottin par duel
 * d'époques (et +2 par vote conforme), +5 par Duel du jour, +1 par point au
 * quiz, +3 par maillon faible démasqué.
 */

interface GameTab {
  id: GameModeId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Règle du mode (rappellée en infobulle de l'onglet). */
  rules: string;
  /** Mise en forme du record (« 12 duels en 60 s », « série de 3 jours »…). */
  formatRecord: (value: number) => string;
}

const GAME_TABS: GameTab[] = [
  {
    id: 'chrono',
    label: 'Défi Chrono',
    icon: Timer,
    rules:
      "60 secondes, un maximum de face-à-face A/B sur la discipline active. Chaque duel voté rapporte 1 point, et l'enchaînement multiplie les points (×2 dès 3 duels d'affilée, jusqu'à ×5).",
    formatRecord: (value) => `${value} duel${value > 1 ? 's' : ''} en 60 s`,
  },
  {
    id: 'epoques',
    label: "Duels d'époques",
    icon: Hourglass,
    rules:
      "8 face-à-face entre les carrières les plus éloignées de la discipline. Après chaque vote : palmarès des deux joueurs, écart d'années et verdict du classement standard. Le vainqueur peut être intronisé au sommet de ta pyramide.",
    formatRecord: (value) => `${value} vote${value > 1 ? 's' : ''} conforme${value > 1 ? 's' : ''} / 8`,
  },
  {
    id: 'duel-du-jour',
    label: 'Duel du jour',
    icon: CalendarDays,
    rules:
      'Un seul duel par discipline et par jour, tiré de la date : tout le monde vote sur le même face-à-face. Entretiens ta série de jours consécutifs. Le pourcentage affiché est le pronostic du classement standard, en attendant l’agrégation des votes côté serveur.',
    formatRecord: (value) => `série de ${value} jour${value > 1 ? 's' : ''}`,
  },
  {
    id: 'quiz',
    label: 'Trouve le GOAT',
    icon: Search,
    rules:
      '10 joueurs mystère, trois indices révélés un à un (décennie, pays, palmarès) et six vignettes pour répondre. 3 points au premier indice, 2 au deuxième, 1 au dernier.',
    formatRecord: (value) => `${value} point${value > 1 ? 's' : ''} / 30`,
  },
  {
    id: 'bouc',
    label: 'Bouc Émissaire',
    icon: Target,
    rules:
      "8 manches de 5 vignettes : désigne celle qui n'a rien à faire au panthéon (la moins titrée du lot, à égalité la carrière la plus courte). +2 points par bonne réponse, rangs révélés après le vote.",
    formatRecord: (value) => `${value} maillon${value > 1 ? 's' : ''} faible${value > 1 ? 's' : ''} / 8`,
  },
];

const PANELS: Record<GameModeId, React.FC<GameModeProps>> = {
  chrono: GameChrono,
  epoques: GameEraDuels,
  'duel-du-jour': GameDailyDuel,
  quiz: GameQuiz,
  bouc: GameScapegoat,
};

interface GameHubProps extends GameModeProps {
  /** Duel reçu par lien `?d=…` (même discipline uniquement). */
  sharedDuel?: SharedDuel | null;
  onDismissDuel?: () => void;
}

export const GameHub: React.FC<GameHubProps> = ({
  sport,
  pool,
  api,
  sharedDuel = null,
  onDismissDuel,
}) => {
  const [mode, setMode] = useState<GameModeId>('chrono');
  const games = useGamesState();
  const progression = useGoatProgression();
  const sportLabel = getSport(sport).shortLabel;

  // Duel reçu : on amène le joueur directement au menu de jeu.
  useEffect(() => {
    if (!sharedDuel) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById('jeux-du-paturage')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [sharedDuel]);

  // Bouton « Surprise » de la barre de disciplines (ou renvoi depuis l'historique).
  useEffect(() => {
    const apply = () => {
      const request = consumePlayRequest();
      if (!request) return;
      const nextMode = request === 'surprise' ? randomMode(GAME_TABS.map((tab) => tab.id)) : request;
      setMode(nextMode);
      window.setTimeout(() => {
        document.getElementById('jeux-du-paturage')?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 80);
    };
    apply();
    return subscribePlayRequest(apply);
  }, []);

  const tab = GAME_TABS.find((entry) => entry.id === mode) ?? GAME_TABS[0];
  const ActiveGame = PANELS[tab.id];
  const record = bestScore(tab.id, sport, games);
  const plays = games.plays[tab.id] ?? 0;

  return (
    <section
      id="jeux-du-paturage"
      aria-label="Les jeux du pâturage"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 scroll-mt-24"
    >
      {sharedDuel && sharedDuel.sport === sport && (
        <div className="mb-4">
          <DuelChallengeBanner
            duel={sharedDuel}
            players={pool}
            onDismiss={() => {
              clearShareParams();
              onDismissDuel?.();
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Gamepad2 className="w-4 h-4 text-amber-300" />
            Les jeux du pâturage
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Cinq façons de trancher la question qui fâche — chaque partie rapporte des Crottins
            d'Or et remplit ton album Panini.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200 text-[11px] font-black whitespace-nowrap"
          title={`${progression.coins} Crottins d'Or — rang : ${progression.title}`}
        >
          <span aria-hidden="true">🪙</span>
          {progression.coins}
          <span className="hidden sm:inline text-amber-300/80">· {progression.title}</span>
        </span>
      </div>

      {/* Menu de jeu */}
      <div
        role="tablist"
        aria-label="Modes de jeu"
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {GAME_TABS.map((entry) => {
          const isActive = entry.id === tab.id;
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={entry.rules}
              onClick={() => setMode(entry.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                  : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={tab.label} className="mt-4 space-y-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/70 text-[10px] font-black text-slate-300">
          <Trophy className="w-3 h-3 text-amber-300" />
          {plays === 0
            ? `Pas encore joué — ${sportLabel}`
            : `Record ${sportLabel} : ${tab.formatRecord(record)} · ${plays} partie${plays > 1 ? 's' : ''}`}
        </span>

        <ActiveGame key={`${tab.id}:${sport}`} sport={sport} pool={pool} api={api} />

        <p className="text-[10px] text-slate-500 text-center">
          Raccourcis : <kbd className="font-black text-slate-300">←</kbd> /{' '}
          <kbd className="font-black text-slate-300">→</kbd> ou{' '}
          <kbd className="font-black text-slate-300">A</kbd> /{' '}
          <kbd className="font-black text-slate-300">D</kbd> pour voter ·{' '}
          <kbd className="font-black text-slate-300">1–6</kbd> pour les vignettes ·{' '}
          <kbd className="font-black text-slate-300">S</kbd> pour passer (chrono) ·{' '}
          <kbd className="font-black text-slate-300">Entrée</kbd> pour enchaîner.
        </p>
      </div>
    </section>
  );
};
