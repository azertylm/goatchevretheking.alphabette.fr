import React, { useEffect, useState } from 'react';
import { SPORTS, type SportDefinition, type SportId, getSport, isSportId } from './sportsCatalog';
import { loadSportsSummary } from './sportsDataProvider';

/**
 * @file sports.tsx
 * Univers disponibles dans Goat Chèvre The King.
 *
 * Le catalogue (30 disciplines) vit dans `sportsCatalog.ts`, partagé avec le
 * générateur de données. Ce fichier ne garde que ce qui touche à l'interface :
 * le sélecteur d'univers et la mémorisation du choix.
 */

export type { SportDefinition, SportId };
export { SPORTS, getSport };

const STORAGE_KEY = 'goat_sport_v1';

export function readStoredSport(): SportId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isSportId(saved)) return saved;
  } catch {
    /* stockage indisponible : on utilise la valeur par défaut */
  }
  return 'football';
}

export function storeSport(sport: SportId): void {
  try {
    localStorage.setItem(STORAGE_KEY, sport);
  } catch {
    /* ignoré */
  }
}

interface SportSwitcherProps {
  value: SportId;
  onChange: (sport: SportId) => void;
  counts?: Partial<Record<SportId, number>>;
}

/**
 * Sélecteur d'univers au sommet de la page.
 *
 * 30 disciplines : le ruban défile horizontalement (mobile d'abord) au lieu de
 * s'étaler sur plusieurs lignes, et chaque pastille garde sa cible tactile.
 */
export const SportSwitcher: React.FC<SportSwitcherProps> = ({ value, onChange, counts = {} }) => {
  // Effectifs issus du sommaire des bases (30 disciplines) : la pastille
  // affiche « 500 joueurs » même pour une discipline jamais encore ouverte.
  const [indexed, setIndexed] = useState<Partial<Record<SportId, number>>>({});

  useEffect(() => {
    let alive = true;
    loadSportsSummary()
      .then((entries) => {
        if (!alive) return;
        const next: Partial<Record<SportId, number>> = {};
        for (const entry of entries) {
          if (entry.count > 0 && isSportId(entry.sport)) next[entry.sport] = entry.count;
        }
        setIndexed(next);
      })
      .catch(() => {
        /* sommaire absent : on garde simplement les effectifs fournis */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Les effectifs du sommaire servent de base ; ceux remontés par la scène
  // (base réellement chargée) ne prennent la main que s'ils sont renseignés.
  const merged: Partial<Record<SportId, number>> = { ...indexed };
  for (const [id, count] of Object.entries(counts) as Array<[SportId, number | undefined]>) {
    if (typeof count === 'number' && count > 0) merged[id] = count;
  }

  return (
    <div
      role="tablist"
      aria-label="Choix de l'univers sportif"
      className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory
                 rounded-2xl bg-slate-900/80 border border-slate-700/70 backdrop-blur p-1.5
                 [scrollbar-width:thin]"
    >
      {SPORTS.map((sport) => {
        const isActive = sport.id === value;
        return (
          <button
            key={sport.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(sport.id)}
            title={sport.label}
            className={`flex-none snap-start flex items-center gap-2 px-3 py-2.5 rounded-xl text-center transition-all cursor-pointer whitespace-nowrap ${
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
              {merged[sport.id] !== undefined && (
                <span className={`text-[10px] font-semibold ${isActive ? 'text-slate-900/70' : 'text-slate-500'}`}>
                  {merged[sport.id]} joueurs
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
