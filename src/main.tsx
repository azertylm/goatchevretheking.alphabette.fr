import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@alphabette/shell';
import '@alphabette/shell/style.css';
import './index.css';
import { APP } from './alphabette.app';

/**
 * Goat Chèvre The King — application autonome.
 *
 *  - `/`            : la pyramide, les duels et le partage
 *  - `/communaute`  : la galerie des pyramides publiées par la communauté
 *  - `/moderation`  : la console de modération (protégée par mot de passe)
 *
 * Toutes les pages sont enveloppées par <AppShell>, la base commune de
 * l'écosystème alphabette.fr (barre écosystème + en-tête d'application).
 * Les pages sont chargées à la demande : chacune part dans son propre fichier JS.
 */

const GoatApp = lazy(() => import('./goat/GoatApp').then((module) => ({ default: module.GoatApp })));
const CommunityPage = lazy(() =>
  import('./community/CommunityPage').then((module) => ({ default: module.CommunityPage })),
);
const ModerationPage = lazy(() =>
  import('./community/ModerationPage').then((module) => ({ default: module.ModerationPage })),
);

const RouteLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3">
    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
    <span className="text-sm font-semibold text-slate-400">Chargement…</span>
  </div>
);

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isCommunityRoute = path === '/communaute' || path.startsWith('/communaute/');
const isModerationRoute = path === '/moderation' || path.startsWith('/moderation/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell app={APP} initialTheme="nuit">
      <Suspense fallback={<RouteLoader />}>
        {isModerationRoute ? <ModerationPage /> : isCommunityRoute ? <CommunityPage /> : <GoatApp />}
      </Suspense>
    </AppShell>
  </StrictMode>,
);
