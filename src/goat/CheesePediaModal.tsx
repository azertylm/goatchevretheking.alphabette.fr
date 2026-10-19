import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Sparkles, Wine, X } from 'lucide-react';
import cheeses from '../data/cheeses.json';

/**
 * @file CheesePediaModal.tsx
 * « Le Fromagidex » : collection interactive de fromages de chèvre AOP.
 * Grille filtrable (Sec / Crémeux / Cendré) + fiche détaillée avec
 * accord mets-vins et anecdote. Mascotte SVG dessinée par forme de fromage.
 */

type CheeseShape = 'buche' | 'palet' | 'pyramide';
type CheeseCategory = 'sec' | 'cremeux' | 'cendre';

interface GoatCheese {
  id: string;
  name: string;
  region: string;
  aopYear: number;
  texture: string;
  categories: CheeseCategory[];
  flavorProfile: string[];
  winePairing: string;
  funFact: string;
  shape: CheeseShape;
  rind: string;
  flesh: string;
}

const FILTERS: Array<{ id: 'tous' | CheeseCategory; label: string; hint: string }> = [
  { id: 'tous', label: 'Tous', hint: 'La cave entière' },
  { id: 'sec', label: 'Sec', hint: 'Affiné, dense, cassant' },
  { id: 'cremeux', label: 'Crémeux', hint: 'Jeune, fondant, doux' },
  { id: 'cendre', label: 'Cendré', hint: 'Croûte grise du charbon végétal' },
];

const CATEGORY_LABEL: Record<CheeseCategory, string> = {
  sec: 'Sec',
  cremeux: 'Crémeux',
  cendre: 'Cendré',
};

/** Mascotte SVG « fromage », dessinée selon la forme du crottin. */
const CheeseIcon: React.FC<{ shape: CheeseShape; rind: string; flesh: string; className?: string }> = ({
  shape,
  rind,
  flesh,
  className = '',
}) => {
  const dark = 'rgba(0,0,0,0.22)';
  if (shape === 'buche') {
    return (
      <svg viewBox="0 0 64 44" className={className} aria-hidden="true">
        <rect x="9" y="13" width="46" height="18" rx="9" fill={rind} />
        <rect x="12" y="16" width="40" height="12" rx="6" fill={flesh} />
        <ellipse cx="24" cy="20" rx="7" ry="2.6" fill={dark} opacity="0.35" />
        <line x1="3" y1="22" x2="61" y2="22" stroke="#8a6b3f" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (shape === 'pyramide') {
    return (
      <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
        <path d="M27 15 L37 15 L55 40 H9 Z" fill={rind} />
        <path d="M30 19 L34 19 L47 36 H17 Z" fill={flesh} />
        <path d="M27 15 L37 15 L39.5 18.6 H24.5 Z" fill={dark} opacity="0.4" />
        <circle cx="22" cy="27" r="1.4" fill={dark} opacity="0.5" />
        <circle cx="44" cy="30" r="1.2" fill={dark} opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden="true">
      <ellipse cx="32" cy="32" rx="22" ry="8" fill={rind} opacity="0.85" />
      <rect x="10" y="17" width="44" height="15" rx="7" fill={rind} />
      <ellipse cx="32" cy="18" rx="22" ry="7.5" fill={flesh} />
      <ellipse cx="25" cy="19" rx="7" ry="2.4" fill={dark} opacity="0.35" />
    </svg>
  );
};

export const CheesePediaModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [filter, setFilter] = useState<'tous' | CheeseCategory>('tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fermeture au clavier + blocage du scroll de fond tant que la modal est ouverte.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const filtered = useMemo(
    () =>
      (cheeses as GoatCheese[]).filter(
        (cheese) => filter === 'tous' || cheese.categories.includes(filter),
      ),
    [filter],
  );

  const selected = useMemo(
    () => (cheeses as GoatCheese[]).find((cheese) => cheese.id === selectedId) ?? null,
    [selectedId],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Le Fromagidex : fromages de chèvre AOP"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-amber-500/20 bg-[#0e1813]/95 shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-amber-500/10 bg-[#0c1410]/90">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300/90">
              <Sparkles className="w-3.5 h-3.5" />
              Volet terroir de l'alpage
            </p>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              🧀 Le Fromagidex
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Fermer le Fromagidex"
            aria-label="Fermer le Fromagidex"
            className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selected ? (
          /* Fiche détaillée */
          <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/10 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Retour à la collection
            </button>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <CheeseIcon
                shape={selected.shape}
                rind={selected.rind}
                flesh={selected.flesh}
                className="w-24 h-16 shrink-0 drop-shadow-lg"
              />
              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">{selected.name}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-300">{selected.region}</p>
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                  AOP {selected.aopYear}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/90 mb-1.5">
                  Texture & pâte
                </p>
                <p className="text-xs text-slate-200">{selected.texture}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/90 mb-1.5">
                  Arômes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.flavorProfile.map((note) => (
                    <span
                      key={note}
                      className="px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-200 text-[11px] font-semibold"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-400/[0.07] p-4">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 mb-1.5">
                  <Wine className="w-3.5 h-3.5" />
                  Accord mets &amp; vin
                </p>
                <p className="text-xs text-amber-100/95">{selected.winePairing}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Anecdote de terroir
                </p>
                <p className="text-xs text-slate-200 leading-relaxed">{selected.funFact}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Grille filtrable */
          <div className="overflow-y-auto px-4 sm:px-6 py-4">
            {/* Filtres */}
            <div
              role="tablist"
              aria-label="Filtrer les fromages par texture"
              className="flex flex-wrap items-center gap-2 mb-5"
            >
              {FILTERS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={filter === tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  title={tab.hint}
                  className={`px-3.5 py-2 rounded-full border text-[11px] font-bold transition-all cursor-pointer ${
                    filter === tab.id
                      ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((cheese) => (
                <button
                  key={cheese.id}
                  type="button"
                  onClick={() => setSelectedId(cheese.id)}
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.04] p-4
                             transition-all duration-200 ease-out transform-gpu
                             hover:scale-[1.02] hover:border-amber-300/50 hover:bg-white/[0.07]
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <CheeseIcon
                      shape={cheese.shape}
                      rind={cheese.rind}
                      flesh={cheese.flesh}
                      className="w-16 h-11 shrink-0 drop-shadow-md transition-transform duration-200 group-hover:scale-110"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white leading-tight">{cheese.name}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400 truncate">{cheese.region}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400/12 border border-amber-400/30 text-amber-300 text-[9px] font-black uppercase tracking-wider">
                          AOP {cheese.aopYear}
                        </span>
                        {cheese.categories.map((category) => (
                          <span
                            key={category}
                            className="px-1.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-200 text-[9px] font-black uppercase tracking-wider"
                          >
                            {CATEGORY_LABEL[category]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">
                Aucun fromage dans cette cave… un chèvre s'est faufilé ailleurs.
              </p>
            )}

            <p className="mt-5 text-[10px] text-slate-500 text-center">
              {(cheeses as GoatCheese[]).length} fromages de chèvre AOP référencés — clique une carte pour la
              fiche complète.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
