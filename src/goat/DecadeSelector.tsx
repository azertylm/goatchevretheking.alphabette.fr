import React, { useMemo } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import {
  ALL_ERAS_ID,
  DECADE_WINDOWS,
  type DecadeWindow,
  type GeoScope,
} from './decadeFilters';

/**
 * @file DecadeSelector.tsx
 * Ruban des époques (fenêtres décennales glissantes) + bascule géographique.
 *
 * Le ruban défile horizontalement : 20 fenêtres ne doivent pas écraser la
 * grille des cartes, ni sur mobile ni sur desktop. Chaque bouton reste une
 * cible tactile confortable (40 px de haut).
 */

interface DecadeSelectorProps {
  /** Fenêtre active, ou `null` pour « Toutes les époques ». */
  value: DecadeWindow | null;
  onChange: (window: DecadeWindow | null) => void;
  scope: GeoScope;
  onScopeChange: (scope: GeoScope) => void;
  /** Pays de référence affiché sur la bascule nationale (« FR » par défaut). */
  homeCountry?: string;
  /** Effectif par fenêtre, pour n'afficher que celles qui ont du monde. */
  counts?: Record<string, number>;
  /** Nombre de joueurs après application des filtres. */
  resultCount?: number;
}

const windowId = (window: DecadeWindow | null): string => window?.id ?? ALL_ERAS_ID;

export const DecadeSelector: React.FC<DecadeSelectorProps> = ({
  value,
  onChange,
  scope,
  onScopeChange,
  homeCountry = 'FR',
  counts,
  resultCount,
}) => {
  const activeId = windowId(value);

  // Les fenêtres vides (avant la naissance des premiers athlètes de la
  // discipline, par exemple) sont masquées pour garder un ruban lisible.
  const windows = useMemo(() => {
    if (!counts) return DECADE_WINDOWS;
    return DECADE_WINDOWS.filter((window) => (counts[window.id] ?? 0) > 0);
  }, [counts]);

  const total = counts?.[ALL_ERAS_ID];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Bascule géographique */}
        <div
          role="group"
          aria-label="Périmètre géographique"
          className="flex rounded-xl bg-slate-950 border border-slate-700 p-0.5"
        >
          <button
            type="button"
            aria-pressed={scope === 'monde'}
            onClick={() => onScopeChange('monde')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              scope === 'monde'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
            Mondial
          </button>
          <button
            type="button"
            aria-pressed={scope === 'national'}
            onClick={() => onScopeChange('national')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
              scope === 'national'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            National / Régional
            <span className="text-[9px] opacity-80">{homeCountry}</span>
          </button>
        </div>

        {resultCount !== undefined && (
          <span className="text-[11px] font-semibold text-slate-400">
            {resultCount} joueur{resultCount > 1 ? 's' : ''} dans cette sélection
          </span>
        )}
      </div>

      {/* Ruban des fenêtres décennales */}
      <div
        role="tablist"
        aria-label="Filtrer par époque"
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:thin]"
      >
        <button
          role="tab"
          aria-selected={activeId === ALL_ERAS_ID}
          onClick={() => onChange(null)}
          className={`flex-none snap-start px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeId === ALL_ERAS_ID
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          Toutes les époques
          {total !== undefined && <span className="ml-1 opacity-70">({total})</span>}
        </button>

        {windows.map((window) => {
          const isActive = activeId === window.id;
          const count = counts?.[window.id];
          return (
            <button
              key={window.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(window)}
              title={`Carrières qui croisent ${window.label}`}
              className={`flex-none snap-start px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-950 border border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {window.label}
              {count !== undefined && (
                <span className={`ml-1 ${isActive ? 'text-slate-900/70' : 'text-slate-500'}`}>({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
