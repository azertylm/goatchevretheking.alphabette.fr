import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, Sparkles, Trophy, UserPlus } from 'lucide-react';
import { GoatHeader } from '../goat/GoatHeader';
import { AlphabetteGateway } from '../goat/AlphabetteGateway';
import { AuthModal } from './AuthModal';
import { CommunityGallery } from './CommunityGallery';
import { logoutCommunity } from './communityApi';
import { refreshCommunitySession, setCommunityUser, useCommunitySession } from './communitySession';

/**
 * @file CommunityPage.tsx
 * Page publique /communaute : la galerie des pyramides partagées par la
 * communauté, avec création de compte, connexion et lien direct vers une
 * pyramide (?p=<id>).
 */

export const CommunityPage: React.FC = () => {
  const session = useCommunitySession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [initialOpenId, setInitialOpenId] = useState<string | null>(null);

  useEffect(() => {
    void refreshCommunitySession();
    const params = new URLSearchParams(window.location.search);
    setInitialOpenId(params.get('p'));
    document.title = 'Pyramides de la communauté — Goat Chèvre The King | alphabette.fr';
  }, []);

  const handleLogout = async () => {
    try {
      await logoutCommunity();
    } finally {
      setCommunityUser(null);
      void refreshCommunitySession(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <GoatHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Barre de navigation + compte */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-slate-800 hover:bg-slate-900 text-slate-300 text-[11px] font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Construire ma pyramide
          </a>

          <div className="ml-auto flex items-center gap-2">
            {session.isLoading ? (
              <span className="text-[11px] text-slate-500">Vérification du compte…</span>
            ) : session.user ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] font-black">
                  <Trophy className="w-3.5 h-3.5" />
                  {session.user.username}
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-slate-800 hover:bg-slate-900 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-slate-800 hover:bg-slate-900 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Créer mon compte
                </button>
              </>
            )}
          </div>
        </div>

        {/* Introduction */}
        <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-emerald-500/10 p-5 sm:p-6">
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Les pyramides de la communauté
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Compare les classements GOAT des autres joueurs, vote pour les plus audacieux et partage le tien.
            Chaque pyramide est enregistrée avec son image haute définition, son verdict « % non-conformiste » et son
            éventuel Hot Take 🔥.
          </p>
          {!session.user && !session.isLoading && (
            <p className="mt-3 text-[11px] text-amber-200/90">
              Un compte gratuit (pseudo + mot de passe, sans e-mail) suffit pour publier et gérer tes propres
              classements.
            </p>
          )}
        </div>

        <CommunityGallery initialOpenId={initialOpenId} />
      </main>

      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={() => {
            void refreshCommunitySession(true);
          }}
        />
      )}

      <AlphabetteGateway />
    </div>
  );
};
