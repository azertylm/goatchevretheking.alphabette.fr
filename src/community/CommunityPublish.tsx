import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Check, Copy, ExternalLink, Heart, Loader2, Sparkles, Upload, UserPlus } from 'lucide-react';
import { GoatPlayer } from '../goat/types';
import { ControversyResult } from '../goat/controversy';
import { visibleSlotIds } from '../goat/pyramidModel';
import { renderShareImage } from '../goat/shareImage';
import { AuthModal } from './AuthModal';
import { CommunityPyramid, publishCommunityPyramid, pyramidLink } from './communityApi';
import { refreshCommunitySession, useCommunitySession } from './communitySession';

/**
 * @file CommunityPublish.tsx
 * Publication de la pyramide dans la galerie de la communauté.
 * Le classement (joueurs par étage) et l'image haute définition sont envoyés
 * au serveur : la pyramide est alors visible par tout le monde, votable et
 * retrouvable depuis n'importe quel appareil.
 */

interface CommunityPublishProps {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  hotTakeId: string | null;
  controversy: ControversyResult;
  sportLabel: string;
  expertMode: boolean;
}

/** Ré-encode l'image en JPEG raisonnable pour le web (1080 px de large). */
async function toPublishableImage(blob: Blob, maxWidth = 1080): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Lecture de l'image générée impossible."));
      element.src = objectUrl;
    });

    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponible dans ce navigateur.');
    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const CommunityPublish: React.FC<CommunityPublishProps> = ({
  assignments,
  players,
  hotTakeId,
  controversy,
  sportLabel,
  expertMode,
}) => {
  const session = useCommunitySession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<CommunityPyramid | null>(null);
  const [copied, setCopied] = useState(false);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const visibleSlots = useMemo(() => visibleSlotIds(expertMode), [expertMode]);
  const filled = Object.keys(assignments).length;
  const topPlayer = assignments['L1-0'] ? playersById.get(assignments['L1-0']) : undefined;

  const defaultTitle = topPlayer ? `Mon GOAT : ${topPlayer.name}` : `Mon classement GOAT — ${sportLabel}`;
  const effectiveTitle = title.trim() || defaultTitle;

  const buildEntries = useCallback(
    () =>
      visibleSlots
        .filter((slot) => assignments[slot])
        .map((slot) => {
          const player = playersById.get(assignments[slot]);
          return {
            slot,
            id: assignments[slot],
            name: player?.name ?? assignments[slot],
            career: player?.career ?? '',
            image: player?.image ?? undefined,
          };
        }),
    [assignments, playersById, visibleSlots],
  );

  const handlePublish = async () => {
    setError(null);
    if (!session.user) {
      setIsAuthOpen(true);
      return;
    }
    if (filled === 0) {
      setError('Place au moins un joueur dans ta pyramide avant de la publier.');
      return;
    }

    setIsPublishing(true);
    try {
      const blob = await renderShareImage({
        assignments,
        players,
        hotTakeId,
        controversy,
        sportLabel,
        expertMode,
        format: 'story',
      });
      const image = await toPublishableImage(blob);
      const hotTakeName = hotTakeId ? playersById.get(hotTakeId)?.name ?? null : null;

      const pyramid = await publishCommunityPyramid({
        title: effectiveTitle.slice(0, 90),
        sport: topPlayer?.sport ?? players[0]?.sport ?? 'football',
        sportLabel,
        controversy: controversy.percent,
        controversyLabel: controversy.label,
        hotTakeName,
        filled,
        total: visibleSlots.length,
        expertMode,
        format: 'story',
        players: buildEntries(),
        image,
      });

      setPublished(pyramid);
    } catch (err: any) {
      setError(err?.message || 'Publication impossible pour le moment.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(pyramidLink(published.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Copie automatique impossible : sélectionne le lien manuellement.');
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-slate-950/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-[11px] font-black text-white uppercase tracking-widest">
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          Publier dans la communauté
        </h3>
        {session.isLoading ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> vérification…
          </span>
        ) : session.user ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
            <Check className="w-3 h-3" /> connecté : {session.user.username}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
            <UserPlus className="w-3 h-3" /> compte gratuit requis
          </span>
        )}
      </div>

      {published ? (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
          <a
            href={published.imageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block w-[120px] rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
            title="Ouvrir l'image publiée"
          >
            <img src={published.imageUrl} alt="Pyramide publiée" className="w-full h-auto" />
          </a>
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <Check className="w-4 h-4" /> Ta pyramide est en ligne !
            </p>
            <p className="text-[11px] text-slate-300">
              «&nbsp;{published.title}&nbsp;» — visible par toute la communauté, prête à être likée et commentée.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/communaute?p=${published.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black transition-colors"
              >
                <Heart className="w-3.5 h-3.5" />
                Voir dans la galerie
              </a>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Lien copié !' : 'Copier le lien'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPublished(null);
                  setTitle('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 text-[11px] font-bold transition-colors cursor-pointer"
              >
                Publier une autre version
              </button>
            </div>
            <p className="text-[10px] text-slate-500 break-all">{pyramidLink(published.id)}</p>
          </div>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Titre de ta pyramide</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={defaultTitle}
              maxLength={90}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/60"
            />
          </label>

          {!session.user && (
            <p className="flex items-start gap-2 text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Crée un compte gratuit (pseudo + mot de passe, sans e-mail) pour publier ton classement et le
                retrouver sur tous tes appareils.
              </span>
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 text-[11px] font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 text-xs font-black transition-colors cursor-pointer"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{isPublishing ? 'Publication…' : session.user ? 'Publier ma pyramide' : 'Créer mon compte et publier'}</span>
            </button>
            <a
              href="/communaute"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] font-bold transition-colors"
            >
              Explorer la galerie
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-[10px] text-slate-500">
            {filled}/{visibleSlots.length} places remplies — l'image publiée contient ta pyramide, ton % de controverse
            et le QR code vers goatchevretheking.alphabette.fr.
          </p>
        </>
      )}

      {isAuthOpen && (
        <AuthModal
          initialMode="register"
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={() => {
            void refreshCommunitySession(true);
          }}
        />
      )}
    </div>
  );
};
