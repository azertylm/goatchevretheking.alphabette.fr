import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Heart, Loader2, RefreshCw, ShieldOff, ShieldCheck, Trash2, Users } from 'lucide-react';
import {
  ModerationPyramid,
  ModerationUser,
  deletePyramidAdmin,
  fetchModerationPyramids,
  fetchModerationUsers,
  setPyramidHiddenAdmin,
  setUserBannedAdmin,
} from './moderationService';

/**
 * @file ModerationPanel.tsx
 * Modération de la galerie communautaire : masquer / supprimer une pyramide
 * publiée, suspendre un compte.
 */

type Tab = 'pyramids' | 'users';

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(value),
    );
  } catch {
    return '';
  }
}

export const ModerationPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pyramids');
  const [pyramids, setPyramids] = useState<ModerationPyramid[]>([]);
  const [users, setUsers] = useState<ModerationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextPyramids, nextUsers] = await Promise.all([fetchModerationPyramids(), fetchModerationUsers()]);
      setPyramids(nextPyramids);
      setUsers(nextUsers);
    } catch (err: any) {
      setError(err?.message || 'Modération indisponible.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleHidden = async (pyramid: ModerationPyramid) => {
    setBusyId(pyramid.id);
    try {
      await setPyramidHiddenAdmin(pyramid.id, !pyramid.hidden);
      setPyramids((current) =>
        current.map((item) => (item.id === pyramid.id ? { ...item, hidden: !item.hidden } : item)),
      );
    } catch (err: any) {
      setError(err?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const removePyramid = async (pyramid: ModerationPyramid) => {
    if (!window.confirm(`Supprimer définitivement « ${pyramid.title} » de ${pyramid.authorName} ?`)) return;
    setBusyId(pyramid.id);
    try {
      await deletePyramidAdmin(pyramid.id);
      setPyramids((current) => current.filter((item) => item.id !== pyramid.id));
    } catch (err: any) {
      setError(err?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBan = async (user: ModerationUser) => {
    setBusyId(user.id);
    try {
      await setUserBannedAdmin(user.id, !user.banned);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, banned: !item.banned } : item)));
    } catch (err: any) {
      setError(err?.message || 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const hiddenCount = pyramids.filter((pyramid) => pyramid.hidden).length;

  return (
    <section className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-black text-slate-100 uppercase tracking-widest">
          <Users className="w-4 h-4 text-amber-400" />
          Communauté
        </h2>

        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
          {(
            [
              { id: 'pyramids', label: `Pyramides (${pyramids.length})` },
              { id: 'users', label: `Comptes (${users.length})` },
            ] as Array<{ id: Tab; label: string }>
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                tab === option.id ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <span className="text-[11px] font-bold text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1">
            {hiddenCount} masquée{hiddenCount > 1 ? 's' : ''}
          </span>
        )}

        <button
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-950/50 border border-red-900 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && pyramids.length === 0 && users.length === 0 && (
        <div className="flex items-center gap-2 py-6 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement de la modération…
        </div>
      )}

      {tab === 'pyramids' && (
        <div className="space-y-2">
          {!isLoading && pyramids.length === 0 && (
            <p className="text-xs text-slate-400 py-4">
              Aucune pyramide publiée pour l'instant. Les classements partagés depuis la galerie apparaîtront ici.
            </p>
          )}
          {pyramids.map((pyramid) => (
            <article
              key={pyramid.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${
                pyramid.hidden ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'
              }`}
            >
              <a
                href={pyramid.imageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="w-14 h-24 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 shrink-0"
                title="Ouvrir l'image"
              >
                <img src={pyramid.imageUrl} alt={pyramid.title} className="w-full h-full object-contain" />
              </a>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-100 truncate">{pyramid.title}</h3>
                <p className="text-[11px] text-slate-400">
                  par <span className="font-semibold text-slate-300">{pyramid.authorName}</span> · {pyramid.sportLabel} ·{' '}
                  {formatDate(pyramid.createdAt)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {pyramid.controversy}% non-conformiste · {pyramid.filled}/{pyramid.total} places ·{' '}
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-500" />
                    {pyramid.likeCount}
                  </span>
                  {pyramid.hidden && <span className="ml-2 font-bold text-amber-300">masquée</span>}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void toggleHidden(pyramid)}
                  disabled={busyId === pyramid.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {pyramid.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {pyramid.hidden ? 'Réafficher' : 'Masquer'}
                </button>
                <button
                  onClick={() => void removePyramid(pyramid)}
                  disabled={busyId === pyramid.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-900 text-red-300 hover:bg-red-950/50 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          {!isLoading && users.length === 0 && <p className="text-xs text-slate-400 py-4">Aucun compte créé pour l'instant.</p>}
          {users.map((user) => (
            <article
              key={user.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${
                user.banned ? 'border-red-900 bg-red-950/40' : 'border-slate-800'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-200 font-black shrink-0">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-100 truncate">{user.username}</h3>
                <p className="text-[11px] text-slate-400">
                  inscrit le {formatDate(user.createdAt)} · {user.pyramidCount} pyramide
                  {user.pyramidCount > 1 ? 's' : ''}
                  {user.banned && <span className="ml-2 font-bold text-red-300">suspendu</span>}
                </p>
              </div>
              <button
                onClick={() => void toggleBan(user)}
                disabled={busyId === user.id}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                  user.banned
                    ? 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
                    : 'border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {user.banned ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                {user.banned ? 'Réactiver' : 'Suspendre'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
