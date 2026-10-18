import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { ModerationPanel } from './ModerationPanel';
import { ModerationSession, fetchModerationSession, loginModeration, logoutModeration } from './moderationService';

/**
 * @file ModerationPage.tsx
 * Page /moderation : console privée de modération de la galerie communautaire.
 *
 * Protégée par MODERATION_PASSWORD. Si la variable n'est pas définie, la console
 * reste fermée : la galerie publique, elle, continue de fonctionner.
 */

export const ModerationPage: React.FC = () => {
  const [session, setSession] = useState<ModerationSession | null>(null);
  const [password, setPassword] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Modération — Goat Chèvre The King';
  }, []);

  const loadSession = useCallback(async () => {
    try {
      setSession(await fetchModerationSession());
    } catch {
      setSession({ authenticated: false, configured: true });
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsWorking(true);
    setError(null);
    try {
      await loginModeration(password);
      setPassword('');
      await loadSession();
    } catch (err: any) {
      setError(err?.message || 'Connexion impossible.');
    } finally {
      setIsWorking(false);
    }
  };

  const signOut = async () => {
    setIsWorking(true);
    try {
      await logoutModeration();
      await loadSession();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h1 className="text-sm font-black uppercase tracking-widest">Modération · Goat Chèvre The King</h1>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-[11px] font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à l'application
            </a>
            {session?.authenticated && (
              <button
                onClick={() => void signOut()}
                disabled={isWorking}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
        {session === null && (
          <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement…
          </div>
        )}

        {session && !session.configured && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              La modération n'est pas configurée. Définissez la variable d'environnement{' '}
              <code className="font-mono font-bold">MODERATION_PASSWORD</code> puis redémarrez le serveur.
            </span>
          </div>
        )}

        {session && session.configured && !session.authenticated && (
          <form
            onSubmit={submit}
            className="max-w-md mx-auto mt-10 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-widest">Accès réservé</h2>
            </div>
            <p className="text-xs text-slate-400">
              Cette console permet de masquer ou supprimer les classements publiés par la communauté, et de suspendre
              un compte.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/50 border border-red-900 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe de modération"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-none text-sm"
            />

            <button
              type="submit"
              disabled={isWorking || !password}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black transition-colors cursor-pointer disabled:opacity-50"
            >
              {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Entrer
            </button>
          </form>
        )}

        {session?.authenticated && <ModerationPanel />}
      </main>
    </div>
  );
};
