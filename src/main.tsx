import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2 } from 'lucide-react';
import './index.css';

/**
 * Goat Chèvre The King — application autonome.
 *
 *  - `/`            : la pyramide, les duels et le partage
 *  - `/communaute`  : la galerie des pyramides publiées par la communauté
 *
 * Les deux pages sont chargées à la demande : chacune part dans son propre
 * fichier JS, la page d'accueil reste légère.
 */

const GoatApp = lazy(() => import('./goat/GoatApp').then((module) => ({ default: module.GoatApp })));
const CommunityPage = lazy(() =>
  import('./community/CommunityPage').then((module) => ({ default: module.CommunityPage })),
);

const RouteLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3">
    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
    <span className="text-sm font-semibold text-slate-400">Chargement…</span>
  </div>
);

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isCommunityRoute = path === '/communaute' || path.startsWith('/communaute/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<RouteLoader />}>{isCommunityRoute ? <CommunityPage /> : <GoatApp />}</Suspense>
  </StrictMode>,
);
