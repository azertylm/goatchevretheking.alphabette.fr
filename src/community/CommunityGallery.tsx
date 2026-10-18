import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Crown,
  Download,
  Flame,
  Heart,
  ImageOff,
  Loader2,
  Link2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  CommunityPyramid,
  deleteCommunityPyramid,
  fetchCommunityPyramids,
  pyramidLink,
  toggleCommunityLike,
} from './communityApi';
import { useCommunitySession } from './communitySession';

/**
 * @file CommunityGallery.tsx
 * Galerie publique des pyramides partagées : filtres par univers, tri par
 * popularité ou fraîcheur, votes et fiche détaillée avec l'image haute définition.
 */

type SportFilter = 'tous' | 'football' | 'nba';
type SortOption = 'recent' | 'popular';

interface CommunityGalleryProps {
  /** Identifiant d'une pyramide à ouvrir directement (lien partagé). */
  initialOpenId?: string | null;
}

const SPORT_BADGES: Record<string, { emoji: string; label: string }> = {
  football: { emoji: '⚽', label: 'Football' },
  nba: { emoji: '🏀', label: 'NBA' },
};

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

export const CommunityGallery: React.FC<CommunityGalleryProps> = ({ initialOpenId = null }) => {
  const session = useCommunitySession();
  const [sport, setSport] = useState<SportFilter>('tous');
  const [sort, setSort] = useState<SortOption>('recent');
  const [onlyMine, setOnlyMine] = useState(false);
  const [pyramids, setPyramids] = useState<CommunityPyramid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPyramid, setOpenPyramid] = useState<CommunityPyramid | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchCommunityPyramids({
        sport: sport === 'tous' ? null : sport,
        sort,
        limit: 48,
        author: onlyMine && session.user ? 'me' : undefined,
      });
      setPyramids(items);
    } catch (err: any) {
      setError(err?.message || 'Galerie momentanément indisponible.');
    } finally {
      setIsLoading(false);
    }
  }, [sport, sort, onlyMine, session.user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lien direct : /communaute?p=<id>
  useEffect(() => {
    if (!initialOpenId) return;
    const found = pyramids.find((pyramid) => pyramid.id === initialOpenId);
    if (found) setOpenPyramid(found);
  }, [initialOpenId, pyramids]);

  const handleLike = async (pyramid: CommunityPyramid) => {
    setBusyId(pyramid.id);
    try {
      const result = await toggleCommunityLike(pyramid.id);
      setPyramids((current) =>
        current.map((item) =>
          item.id === pyramid.id ? { ...item, liked: result.liked, likeCount: result.likeCount } : item,
        ),
      );
      setOpenPyramid((current) =>
        current && current.id === pyramid.id
          ? { ...current, liked: result.liked, likeCount: result.likeCount }
          : current,
      );
    } catch (err: any) {
      setError(err?.message || 'Vote impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (pyramid: CommunityPyramid) => {
    if (!window.confirm(`Supprimer définitivement « ${pyramid.title} » de la galerie ?`)) return;
    setBusyId(pyramid.id);
    try {
      await deleteCommunityPyramid(pyramid.id);
      setPyramids((current) => current.filter((item) => item.id !== pyramid.id));
      setOpenPyramid((current) => (current?.id === pyramid.id ? null : current));
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const totalLikes = useMemo(() => pyramids.reduce((sum, item) => sum + item.likeCount, 0), [pyramids]);

  return (
    <section className="space-y-5">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
          {(
            [
              { id: 'tous', label: 'Tous', emoji: '🏆' },
              { id: 'football', label: 'Football', emoji: '⚽' },
              { id: 'nba', label: 'NBA', emoji: '🏀' },
            ] as Array<{ id: SportFilter; label: string; emoji: string }>
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSport(option.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors cursor-pointer ${
                sport === option.id ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span aria-hidden="true">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
          {(
            [
              { id: 'recent', label: 'Nouvelles' },
              { id: 'popular', label: 'Populaires' },
            ] as Array<{ id: SortOption; label: string }>
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSort(option.id)}
              className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors cursor-pointer ${
                sort === option.id ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {session.user && (
          <button
            type="button"
            onClick={() => setOnlyMine((current) => !current)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border text-[11px] font-black transition-colors cursor-pointer ${
              onlyMine
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'border-slate-800 text-slate-300 hover:bg-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Mes pyramides
          </button>
        )}

        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-slate-800 hover:bg-slate-900 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        {isLoading
          ? 'Chargement des pyramides de la communauté…'
          : `${pyramids.length} pyramide${pyramids.length > 1 ? 's' : ''} affichée${pyramids.length > 1 ? 's' : ''} · ${totalLikes} ❤️`}
      </p>

      {error && (
        <p className="flex items-start gap-2 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {isLoading && pyramids.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          Chargement…
        </div>
      )}

      {!isLoading && pyramids.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center space-y-2">
          <Crown className="w-7 h-7 text-amber-400 mx-auto" />
          <p className="text-sm font-bold text-white">Aucune pyramide ici pour l'instant</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {onlyMine
              ? "Tu n'as pas encore publié de classement. Construis ta pyramide puis clique sur « Publier ma pyramide »."
              : 'Sois le premier à partager ton classement GOAT : construis ta pyramide puis publie-la en un clic.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors"
          >
            Construire ma pyramide
          </a>
        </div>
      )}

      {/* Grille */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {pyramids.map((pyramid) => {
          const badge = SPORT_BADGES[pyramid.sport] ?? { emoji: '🏆', label: pyramid.sportLabel };
          const isOwner = session.user?.id === pyramid.userId;
          return (
            <article
              key={pyramid.id}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col hover:border-amber-400/50 transition-colors"
            >
              <button
                type="button"
                onClick={() => setOpenPyramid(pyramid)}
                className="relative block w-full bg-slate-950 cursor-pointer"
                title="Agrandir"
              >
                {brokenImages[pyramid.id] ? (
                  <span className="flex flex-col items-center justify-center gap-2 aspect-[9/16] text-slate-600 text-[11px]">
                    <ImageOff className="w-6 h-6" />
                    Aperçu indisponible
                  </span>
                ) : (
                  <img
                    src={pyramid.imageUrl}
                    alt={pyramid.title}
                    loading="lazy"
                    onError={() => setBrokenImages((current) => ({ ...current, [pyramid.id]: true }))}
                    className="w-full aspect-[9/16] object-contain"
                  />
                )}
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg bg-slate-950/85 px-2 py-1 text-[10px] font-black text-white">
                  <span aria-hidden="true">{badge.emoji}</span>
                  {badge.label}
                </span>
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-950/85 px-2 py-1 text-[10px] font-black text-amber-300">
                  {pyramid.controversy}%
                </span>
                {pyramid.hidden && (
                  <span className="absolute bottom-2 left-2 rounded-lg bg-red-500/90 px-2 py-1 text-[10px] font-black text-white">
                    Masquée
                  </span>
                )}
              </button>

              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <h3 className="text-xs font-black text-white leading-snug line-clamp-2">{pyramid.title}</h3>
                <p className="text-[10px] text-slate-400">
                  par <span className="font-bold text-slate-300">{pyramid.authorName}</span> · {formatDate(pyramid.createdAt)}
                </p>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {pyramid.hotTakeName ? (
                    <span className="inline-flex items-center gap-1 text-orange-300 font-bold">
                      <Flame className="w-3 h-3" /> Hot Take : {pyramid.hotTakeName}
                    </span>
                  ) : (
                    `${pyramid.filled}/${pyramid.total} places`
                  )}
                </p>

                <div className="mt-auto flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleLike(pyramid)}
                    disabled={busyId === pyramid.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                      pyramid.liked
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-950/70 border border-slate-700 text-slate-300 hover:text-rose-300'
                    }`}
                    title={pyramid.liked ? 'Retirer mon ❤️' : 'J’aime cette pyramide'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${pyramid.liked ? 'fill-current' : ''}`} />
                    {pyramid.likeCount}
                  </button>

                  <a
                    href={pyramid.imageUrl}
                    download={`goat-${pyramid.id}.jpg`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold transition-colors"
                    title="Télécharger l'image"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(pyramid)}
                      disabled={busyId === pyramid.id}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700 text-slate-400 hover:text-red-400 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Supprimer ma pyramide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Fiche détaillée */}
      {openPyramid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={openPyramid.title}
          onClick={() => setOpenPyramid(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white truncate">{openPyramid.title}</h3>
                <p className="text-[11px] text-slate-400">
                  par <span className="font-bold text-slate-300">{openPyramid.authorName}</span> ·{' '}
                  {openPyramid.sportLabel} · {formatDate(openPyramid.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPyramid(null)}
                className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
                <img src={openPyramid.imageUrl} alt={openPyramid.title} className="w-full h-auto" />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Verdict</p>
                  <p className="text-2xl font-black text-amber-300">{openPyramid.controversy}%</p>
                  <p className="text-[11px] font-semibold text-slate-300">{openPyramid.controversyLabel}</p>
                  {openPyramid.hotTakeName && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-300 pt-1">
                      <Flame className="w-3.5 h-3.5" /> Hot Take : {openPyramid.hotTakeName}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Pyramide ({openPyramid.filled}/{openPyramid.total})
                  </p>
                  <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {[...openPyramid.players]
                      .sort((a, b) => a.slot.localeCompare(b.slot))
                      .map((entry) => (
                        <li key={entry.slot} className="flex items-center gap-2 text-[11px]">
                          <span className="w-9 shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-center text-[9px] font-black text-slate-300">
                            {entry.slot.replace('L', 'É')}
                          </span>
                          <span className="font-bold text-slate-200 truncate">{entry.name}</span>
                          <span className="ml-auto text-slate-500 whitespace-nowrap">{entry.career}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLike(openPyramid)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-colors cursor-pointer ${
                      openPyramid.liked
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-950/70 border border-slate-700 text-slate-300 hover:text-rose-300'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${openPyramid.liked ? 'fill-current' : ''}`} />
                    {openPyramid.likeCount}
                  </button>
                  <a
                    href={openPyramid.imageUrl}
                    download={`goat-${openPyramid.id}.jpg`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-white text-slate-950 text-[11px] font-black transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Télécharger
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(pyramidLink(openPyramid.id))
                        .catch(() => undefined);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Copier le lien
                  </button>
                  {session.user?.id === openPyramid.userId && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(openPyramid)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
