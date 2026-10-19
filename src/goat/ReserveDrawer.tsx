import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Search, Sparkles, Users } from 'lucide-react';
import { GoatPlayer } from './types';
import { PlayerCard } from './PlayerCard';
import { DecadeSelector } from './DecadeSelector';
import { getSport, type SportId } from './sports';
import { usePaniniAlbum } from './usePaniniAlbum';
import {
  ALL_ERAS_ID,
  DECADE_WINDOWS,
  filterAthletes,
  isPlayerInWindow,
  type DecadeWindow,
  type GeoScope,
} from './decadeFilters';

/**
 * @file ReserveDrawer.tsx
 * Réserve des joueurs de l'univers sélectionné : recherche par nom, époque
 * (fenêtres décennales glissantes par pas de 5 ans) et périmètre géographique.
 *
 * Les vignettes arrivent **par blocs de 40** (défilement infini) : le DOM ne
 * contient jamais les 500 cartes à la fois, le défilement et le glisser-déposer
 * restent fluides même sur un téléphone modeste.
 *
 * Les filtres ne touchent **que la liste affichée** : l'état de la pyramide
 * active (placements, Hot Take, mode expert) reste strictement intact.
 */

interface ReserveDrawerProps {
  sport: SportId;
  players: GoatPlayer[];
  selectedPlayerId: string | null;
  hotTakeId: string | null;
  placedIds: string[];
  /** Recherche pilotée depuis la barre de disciplines (prioritaire si fournie). */
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Remonte le nombre de joueurs correspondant aux filtres actifs. */
  onFilteredCount?: (count: number) => void;
  onSelectPlayer: (playerId: string) => void;
  onToggleHotTake: (playerId: string) => void;
}

/** Taille d'un bloc de vignettes (le DOM en contient au plus deux d'avance). */
const PAGE_SIZE = 40;

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const ReserveDrawer: React.FC<ReserveDrawerProps> = ({
  sport,
  players,
  selectedPlayerId,
  hotTakeId,
  placedIds,
  searchQuery,
  onSearchQueryChange,
  onFilteredCount,
  onSelectPlayer,
  onToggleHotTake,
}) => {
  const [localQuery, setLocalQuery] = useState('');
  const [window, setWindow] = useState<DecadeWindow | null>(null);
  const [scope, setScope] = useState<GeoScope>('monde');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // La recherche peut venir de la barre de disciplines (prioritaire) ou du
  // champ local du tiroir : dans les deux cas, c'est la même valeur filtrante.
  const query = searchQuery ?? localQuery;
  const panini = usePaniniAlbum(sport, players.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      onSearchQueryChange?.(value);
      setLimit(PAGE_SIZE);
    },
    [onSearchQueryChange],
  );

  const placedSet = useMemo(() => new Set(placedIds), [placedIds]);
  const normalizedQuery = normalize(query.trim());

  // Effectifs par fenêtre, calculés une fois par jeu de joueurs.
  const windowCounts = useMemo(() => {
    const counts: Record<string, number> = { [ALL_ERAS_ID]: players.length };
    for (const win of DECADE_WINDOWS) {
      let count = 0;
      for (const player of players) {
        if (isPlayerInWindow(player, win.start, win.end)) count += 1;
      }
      counts[win.id] = count;
    }
    return counts;
  }, [players]);

  const filtered = useMemo(() => {
    const byFilters = filterAthletes(players, { window, scope });
    if (!normalizedQuery) return byFilters;
    return byFilters.filter((player) => normalize(player.name).includes(normalizedQuery));
  }, [players, window, scope, normalizedQuery]);

  const visible = filtered.slice(0, limit);

  // Wikidata ne date pas la carrière des sportifs individuels : elle est alors
  // déduite de l'année de naissance. On le dit clairement sous la grille.
  const estimatedCount = useMemo(
    () => filtered.filter((player) => player.careerEstimated).length,
    [filtered],
  );

  // La barre de disciplines affiche le nombre de joueurs correspondant à la
  // recherche pour la discipline active.
  useEffect(() => {
    onFilteredCount?.(filtered.length);
  }, [filtered.length, onFilteredCount]);

  // ── Album Panini : placements et Hot Take alimentent la collection ────────
  useEffect(() => {
    if (placedIds.length > 0) panini.discover(...placedIds);
  }, [placedIds, panini.discover]);

  useEffect(() => {
    if (hotTakeId) panini.discover(hotTakeId);
  }, [hotTakeId, panini.discover]);

  /** Clic sur une vignette : elle rejoint l'album, puis devient sélectionnée. */
  const handleCardClick = useCallback(
    (playerId: string) => {
      panini.discover(playerId);
      onSelectPlayer(playerId);
    },
    [onSelectPlayer, panini.discover],
  );

  const handleHotTake = useCallback(
    (playerId: string) => {
      panini.discover(playerId);
      onToggleHotTake(playerId);
    },
    [onToggleHotTake, panini.discover],
  );

  // ── Défilement infini : chaque bloc supplémentaire fait 40 vignettes ──────
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLimit((current) => (current >= filtered.length ? current : current + PAGE_SIZE));
      },
      { rootMargin: '500px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [window, scope, normalizedQuery]);

  const resetFilters = () => {
    setWindow(null);
    setScope('monde');
    handleQueryChange('');
    setLimit(PAGE_SIZE);
  };

  const filtersActive = window !== null || scope !== 'monde' || normalizedQuery.length > 0;
  const paniniPercent = Math.round(panini.progress * 100);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
          <Users className="w-4 h-4 text-emerald-400" />
          Réserve des {players.length} joueurs
        </h2>
        <span className="text-[11px] font-semibold text-slate-400">
          {filtered.length} joueur{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Album Panini : jauge de collection de la discipline */}
      <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-200">
            <Sparkles className="w-3.5 h-3.5" />
            Album Panini
          </p>
          <span className="text-[11px] font-bold text-amber-100/90">
            Collection {getSport(sport).shortLabel} : {panini.count} / {panini.total} vignettes
            découvertes
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Collection ${getSport(sport).shortLabel}`}
          aria-valuemin={0}
          aria-valuemax={panini.total}
          aria-valuenow={panini.count}
          className="mt-2 h-2 w-full overflow-hidden rounded-full border border-amber-400/15 bg-slate-950"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400 transition-[width] duration-500"
            style={{ width: `${paniniPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-amber-100/50">
          Chaque vignette cliquée, placée sur la pyramide ou votée rejoint ton album —{' '}
          {paniniPercent} % de la discipline.
        </p>
      </div>

      {/* Recherche */}
      <label className="relative block mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Rechercher un joueur par nom…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
        />
      </label>

      {/* Époques + périmètre géographique */}
      <div className="mb-4">
        <DecadeSelector
          value={window}
          onChange={(next) => {
            setWindow(next);
            setLimit(PAGE_SIZE);
          }}
          scope={scope}
          onScopeChange={(next) => {
            setScope(next);
            setLimit(PAGE_SIZE);
          }}
          counts={windowCounts}
        />
      </div>

      {/* Grille de la réserve */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {visible.map((player) => (
            <div key={player.id} className="relative">
              <PlayerCard
                player={player}
                variant="reserve"
                isSelected={selectedPlayerId === player.id}
                isHotTake={hotTakeId === player.id}
                onClick={() => handleCardClick(player.id)}
                onToggleHotTake={() => handleHotTake(player.id)}
              />

              {placedSet.has(player.id) ? (
                <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Placé
                </span>
              ) : panini.has(player.id) ? (
                <span
                  title="Vignette dans ton album Panini"
                  className="absolute top-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black"
                >
                  ✓
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">Aucun joueur ne correspond à cette sélection.</p>
          {filtersActive && (
            <button
              onClick={resetFilters}
              className="mt-3 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Sentinelle du défilement infini : charge le bloc suivant à l'approche */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {estimatedCount > 0 && (
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          ≈ {estimatedCount} carrière{estimatedCount > 1 ? 's' : ''} estimée
          {estimatedCount > 1 ? 's' : ''} à partir de l’année de naissance : Wikidata ne
          date pas ces parcours. Le reste des carrières provient des données réelles.
        </p>
      )}

      {filtered.length > visible.length && (
        <button
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="mt-4 w-full py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
        >
          Afficher {Math.min(PAGE_SIZE, filtered.length - visible.length)} joueurs de plus
        </button>
      )}
    </div>
  );
};
