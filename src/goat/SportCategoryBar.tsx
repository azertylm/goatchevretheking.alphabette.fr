import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Search, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { SPORTS, type SportId, getSport } from './sportsCatalog';
import { pyramidStoreRevision, readPyramidProgress, subscribePyramidStore } from './pyramidModel';
import { pastureAudio } from './pastureAudio';
import { readSoundEnabled, storeSoundEnabled } from './soundPreference';

/**
 * @file SportCategoryBar.tsx
 * Barre de navigation des 30 disciplines, en tête de l'application.
 *
 * - le ruban défile horizontalement (mobile d'abord) avec, pour chaque
 *   discipline : icône, nom et **badge d'état** de sa pyramide
 *   (« Pyramide 100 % complète », « 3 / 15 cases », effectif de la base) ;
 * - le champ de recherche filtre **en même temps** les disciplines du ruban et
 *   les joueurs de la discipline active (le compteur de résultats est affiché) ;
 * - l'état des pyramides est lu dans `localStorage` (une clé par discipline) et
 *   se rafraîchit à chaque placement, même fait depuis un autre composant.
 */

export interface SportCategoryBarProps {
  value: SportId;
  onChange: (sport: SportId) => void;
  /** Effectifs des bases, par discipline. */
  counts?: Partial<Record<SportId, number>>;
  /** Recherche partagée : filtre les sports et les joueurs du sport actif. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Nombre de joueurs correspondant à la recherche dans la discipline active. */
  matchCount?: number | null;
}

/** Minuscules sans accents, pour une recherche tolérante. */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const SportCategoryBar: React.FC<SportCategoryBarProps> = ({
  value,
  onChange,
  counts = {},
  query,
  onQueryChange,
  matchCount = null,
}) => {
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [soundOn, setSoundOn] = useState(() => readSoundEnabled());

  // Révision du stockage des pyramides : la barre se rafraîchit dès qu'une
  // pyramide change, où que le changement ait eu lieu.
  const revision = useSyncExternalStore(subscribePyramidStore, pyramidStoreRevision, pyramidStoreRevision);

  const progress = useMemo(() => {
    void revision; // dépendance volontaire : on relit après chaque modification
    const entries = SPORTS.map((sport) => [sport.id, readPyramidProgress(sport.id)] as const);
    return new Map(entries);
  }, [revision]);

  const normalizedQuery = normalize(query.trim());

  // Le ruban ne garde que les disciplines qui correspondent à la recherche ;
  // si aucune ne correspond, on garde tout (la recherche vise alors les joueurs).
  const visibleSports = useMemo(() => {
    if (!normalizedQuery) return SPORTS;
    const matching = SPORTS.filter(
      (sport) =>
        normalize(sport.label).includes(normalizedQuery) ||
        normalize(sport.shortLabel).includes(normalizedQuery),
    );
    return matching.length > 0 ? matching : SPORTS;
  }, [normalizedQuery]);

  const matchesASport = visibleSports.length !== SPORTS.length;

  // La discipline active reste centrée dans le ruban (sans toucher au
  // défilement de la page).
  useEffect(() => {
    const rail = railRef.current;
    const button = activeRef.current;
    if (!rail || !button) return;
    const target = button.offsetLeft - rail.clientWidth / 2 + button.clientWidth / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [value, visibleSports.length]);

  const scrollRail = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  /** Flèches clavier : on parcourt les disciplines sans quitter le ruban. */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = SPORTS.findIndex((sport) => sport.id === value);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = SPORTS[(index + step + SPORTS.length) % SPORTS.length];
    onChange(next.id);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    pastureAudio.setEnabled(next);
    storeSoundEnabled(next);
    if (next) pastureAudio.playBell(880);
  };

  const activeSport = getSport(value);

  return (
    <section
      aria-label="Choix de la discipline"
      className="rounded-3xl border border-slate-700/70 bg-slate-900/80 backdrop-blur shadow-xl shadow-black/20"
    >
      {/* Recherche rapide : disciplines + joueurs du sport actif */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 pb-2">
        <label className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher un sport ou un joueur…"
            aria-label="Rechercher un sport ou un joueur"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white
                       outline-none focus:border-amber-400 placeholder:text-slate-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Effacer la recherche"
              title="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {query.trim()
              ? `${
                  matchesASport ? `${visibleSports.length} discipline${visibleSports.length > 1 ? 's' : ''} · ` : ''
                }${matchCount ?? '…'} joueur${matchCount !== null && matchCount > 1 ? 's' : ''} « ${query.trim()} » dans ${
                  activeSport.shortLabel
                }`
              : `${SPORTS.length} disciplines`}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? 'Couper les sons du jeu' : 'Activer les sons du jeu'}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition-colors cursor-pointer ${
              soundOn
                ? 'border-amber-400/30 bg-amber-400/15 text-amber-200'
                : 'border-slate-700 bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundOn ? 'Sons' : 'Muet'}</span>
          </button>
        </div>
      </div>

      {/* Ruban des disciplines */}
      <div className="flex items-center gap-1 px-1.5 pb-2.5">
        <button
          type="button"
          onClick={() => scrollRail(-1)}
          aria-label="Disciplines précédentes"
          className="hidden sm:inline-flex flex-none p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={railRef}
          role="tablist"
          aria-label="Disciplines disponibles"
          onKeyDown={handleKeyDown}
          className="flex gap-1.5 overflow-x-auto scroll-smooth pb-1 snap-x snap-mandatory flex-1 min-w-0
                     [scrollbar-width:thin]"
        >
          {visibleSports.map((sport) => {
            const isActive = sport.id === value;
            const state = progress.get(sport.id);
            const count = counts[sport.id];

            return (
              <button
                key={sport.id}
                ref={isActive ? activeRef : undefined}
                role="tab"
                aria-selected={isActive}
                title={`${sport.label} — ${sport.tagline}`}
                onClick={() => onChange(sport.id)}
                className={`flex-none snap-start flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {sport.emoji}
                </span>
                <span className="flex flex-col items-start">
                  <span className="text-xs font-black tracking-tight leading-tight">{sport.shortLabel}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold leading-tight ${
                      isActive ? 'text-slate-900/75' : state?.complete ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {state?.complete ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Pyramide 100 % complète
                      </>
                    ) : state && state.filled > 0 ? (
                      <>
                        <Trophy className="w-2.5 h-2.5" />
                        {state.filled} / {state.total} cases
                      </>
                    ) : count !== undefined ? (
                      <>{count} joueurs</>
                    ) : (
                      <>À découvrir</>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollRail(1)}
          aria-label="Disciplines suivantes"
          className="hidden sm:inline-flex flex-none p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
