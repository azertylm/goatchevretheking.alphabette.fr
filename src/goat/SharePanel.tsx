import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Share2,
  Smartphone,
  Square as SquareIcon,
  X,
} from 'lucide-react';
import { GoatPlayer } from './types';
import { ControversyResult } from './controversy';
import {
  ShareFormat,
  downloadBlob,
  renderPlayerCardImage,
  renderPosterImage,
  renderShareImage,
} from './shareImage';
import { SportId } from './sportsCatalog';
import { consensusRanking } from './gameModes';
import { buildPyramidLink, copyText } from './challenge';
import { buildRedditMarkdown, downloadMarkdown } from './redditExport';
import { useCommunitySession } from '../community/communitySession';

/**
 * @file SharePanel.tsx
 * Bouton « Partager ma Pyramide » : image haute définition (Instagram Story
 * 9:16, carré 1:1, affiche A4 imprimable, carte joueur 9:16), partage natif,
 * lien de contestation `?p=…` et export Markdown pour Reddit.
 */

export type ExportFormat = ShareFormat | 'poster' | 'player';

interface SharePanelProps {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  hotTakeId: string | null;
  controversy: ControversyResult;
  sportLabel: string;
  expertMode: boolean;
  /** Discipline active (pour le lien de contestation). */
  sport: SportId;
}

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'story', label: 'Instagram Story', hint: '9:16 · 1080×1920', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'square', label: 'Carré', hint: '1:1 · 1080×1080', icon: <SquareIcon className="w-4 h-4" /> },
  { id: 'poster', label: 'Affiche A4', hint: 'portrait · 2480×3508', icon: <FileText className="w-4 h-4" /> },
  { id: 'player', label: 'Carte du GOAT', hint: '9:16 · vignette seule', icon: <ImageIcon className="w-4 h-4" /> },
];

const PREVIEW_SIZE: Record<ExportFormat, string> = {
  story: 'w-[190px] h-[338px]',
  square: 'w-[230px] h-[230px]',
  poster: 'w-[160px] h-[226px]',
  player: 'w-[190px] h-[338px]',
};

export const SharePanel: React.FC<SharePanelProps> = ({
  assignments,
  players,
  hotTakeId,
  controversy,
  sportLabel,
  expertMode,
  sport,
}) => {
  const { user } = useCommunitySession();
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('story');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const contestLink = useMemo(
    () =>
      buildPyramidLink(sport, assignments, {
        hotTake: hotTakeId,
        expertMode,
        author: user?.username ?? '',
      }),
    [sport, assignments, hotTakeId, expertMode, user?.username],
  );

  /** Nombre de places réellement remplies (un lien vide n'a rien à contester). */
  const filledCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  const topPlayer = useMemo(() => {
    const id = assignments['L1-0'];
    return id ? players.find((player) => player.id === id) ?? null : null;
  }, [assignments, players]);

  const releasePreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    blobRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const render = useCallback(
    async (target: ExportFormat): Promise<Blob> => {
      if (target === 'poster') {
        return renderPosterImage({
          assignments,
          players,
          hotTakeId,
          controversy,
          sportLabel,
          expertMode,
        });
      }
      if (target === 'player') {
        if (!topPlayer) throw new Error('Place d’abord un joueur sur la case du GOAT ultime.');
        const ranking = consensusRanking(players);
        const rank = ranking.findIndex((player) => player.id === topPlayer.id) + 1;
        return renderPlayerCardImage({
          player: topPlayer,
          rank: rank > 0 ? rank : 1,
          total: players.length,
          sportLabel,
        });
      }
      return renderShareImage({
        assignments,
        players,
        hotTakeId,
        controversy,
        sportLabel,
        expertMode,
        format: target,
      });
    },
    [assignments, players, hotTakeId, controversy, sportLabel, expertMode, topPlayer],
  );

  /** Génère l'image et déclenche (ou non) le téléchargement. */
  const generate = useCallback(
    async (target: ExportFormat, autoDownload: boolean) => {
      setIsGenerating(true);
      setError(null);
      setFeedback(null);
      try {
        const blob = await render(target);

        releasePreview();
        const url = URL.createObjectURL(blob);
        previewRef.current = url;
        blobRef.current = blob;
        setPreviewUrl(url);

        if (autoDownload) {
          downloadBlob(blob, `goat-chevre-the-king-${target}-${Date.now()}.png`);
          setFeedback('Image téléchargée.');
        }
      } catch (err: any) {
        setError(err?.message || "Génération de l'image impossible.");
      } finally {
        setIsGenerating(false);
      }
    },
    [releasePreview, render],
  );

  const openPanel = () => {
    setIsOpen(true);
    void generate(format, false);
  };

  /** Partage natif (fichier image + lien), avec repli sur la copie du lien. */
  const shareNative = async () => {
    setError(null);
    const blob = blobRef.current ?? (await render(format).catch(() => null));
    if (!blob) {
      setError("Prépare d'abord l'image.");
      return;
    }
    const file = new File([blob], `goat-${format}.png`, { type: 'image/png' });
    const text = `Mon classement GOAT — ${sportLabel}. Fais le tien et riposte !`;

    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Goat Chèvre The King', text, url: contestLink });
        setFeedback('Partage ouvert.');
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'Goat Chèvre The King', text, url: contestLink });
        setFeedback('Partage ouvert.');
        return;
      }
      const ok = await copyText(contestLink);
      setFeedback(ok ? 'Lien de contestation copié (partage natif indisponible).' : 'Copie impossible.');
    } catch {
      // L'utilisateur a annulé le partage : on ne signale rien.
    }
  };

  const copyLink = async () => {
    const ok = await copyText(contestLink);
    setFeedback(ok ? 'Lien de contestation copié — envoie-le à un ami.' : 'Copie impossible.');
  };

  const copyReddit = async () => {
    const markdown = buildRedditMarkdown({
      assignments,
      players,
      hotTakeId,
      controversy,
      sportLabel,
      expertMode,
      link: contestLink,
    });
    const ok = await copyText(markdown);
    setFeedback(ok ? 'Texte Markdown copié — colle-le sur Reddit ou Discord.' : 'Copie impossible.');
  };

  const downloadReddit = () => {
    const markdown = buildRedditMarkdown({
      assignments,
      players,
      hotTakeId,
      controversy,
      sportLabel,
      expertMode,
      link: contestLink,
    });
    downloadMarkdown(markdown, `goat-classement-${sport}.md`);
    setFeedback('Fichier Markdown téléchargé.');
  };

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-amber-500/10 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest">
            <Share2 className="w-4 h-4 text-emerald-400" />
            Partage ta pyramide
          </h2>
          <p className="text-[11px] text-slate-300 mt-1 max-w-xl">
            Story 9:16, carré, affiche A4, carte du GOAT, lien de contestation et texte Reddit : tout est
            généré dans ton navigateur, sans serveur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openPanel}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Share2 className="w-4 h-4" />
            Partager ma Pyramide
          </button>
          {isOpen && (
            <button
              onClick={() => {
                setIsOpen(false);
                releasePreview();
              }}
              className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          <div className="space-y-3">
            <div role="group" aria-label="Format de l'image" className="flex flex-wrap gap-2">
              {FORMATS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setFormat(option.id);
                    void generate(option.id, false);
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                    format === option.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-950/70 border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                  <span className={format === option.id ? 'text-slate-900/70' : 'text-slate-500'}>{option.hint}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => void generate(format, true)}
              disabled={isGenerating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-white disabled:opacity-60 text-slate-950 text-sm font-black transition-colors cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isGenerating ? 'Génération en cours…' : "Télécharger l'image HD"}</span>
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => void shareNative()}
                title="Partager l'image et le lien via le menu du système"
                className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 text-[11px] font-bold hover:bg-emerald-400/20 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager…
              </button>
              <button
                onClick={() => void copyLink()}
                disabled={filledCount === 0}
                title={
                  filledCount === 0
                    ? "Place au moins un joueur pour créer un lien de contestation"
                    : 'Copier le lien de contestation (?p=…)'
                }
                className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-600 bg-slate-950/70 text-slate-200 text-[11px] font-bold hover:border-amber-300/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Link2 className="w-3.5 h-3.5" />
                Lien défi
              </button>
              <button
                onClick={() => void copyReddit()}
                title="Copier le classement en Markdown (Reddit, Discord, forum)"
                className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-600 bg-slate-950/70 text-slate-200 text-[11px] font-bold hover:border-amber-300/60 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Texte Reddit
              </button>
              <button
                onClick={downloadReddit}
                title="Télécharger le classement en fichier .md"
                className="inline-flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-600 bg-slate-950/70 text-slate-200 text-[11px] font-bold hover:border-amber-300/60 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                .md
              </button>
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {feedback && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                <Check className="w-3.5 h-3.5" />
                {feedback}
              </p>
            )}

            <p className="text-[11px] text-slate-400 leading-relaxed">
              L’image contient ta pyramide (photos, noms, années), le badge « Hot Take 🔥 », ton % de
              controverse, un QR code vers goatchevretheking.alphabette.fr et la mention d’invitation.
              Le lien de contestation contient ton classement : celui qui l’ouvre peut le consulter et
              <strong className="text-slate-200"> riposter</strong>.
            </p>
          </div>

          {/* Aperçu */}
          <div className="flex items-start justify-center">
            <div
              className={`rounded-2xl border border-slate-700 bg-slate-950/70 overflow-hidden flex items-center justify-center ${PREVIEW_SIZE[format]}`}
            >
              {isGenerating && !previewUrl && <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />}
              {previewUrl && (
                <img src={previewUrl} alt="Aperçu de l'image à partager" className="w-full h-full object-contain" />
              )}
              {!isGenerating && !previewUrl && <ImageIcon className="w-6 h-6 text-slate-600" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
