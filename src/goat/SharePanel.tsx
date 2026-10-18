import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2, Smartphone, Square as SquareIcon, X } from 'lucide-react';
import { GoatPlayer } from './types';
import { ControversyResult } from './controversy';
import { ShareFormat, downloadBlob, renderShareImage } from './shareImage';

/**
 * @file SharePanel.tsx
 * Bouton « Partager ma Pyramide » : génère une image haute définition
 * (Instagram Story 9:16 ou carré 1:1) avec la pyramide, le badge Hot Take,
 * le % de controverse et un QR code vers goatchevretheking.alphabette.fr.
 */

interface SharePanelProps {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  hotTakeId: string | null;
  controversy: ControversyResult;
  sportLabel: string;
  expertMode: boolean;
}

const FORMATS: Array<{ id: ShareFormat; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'story', label: 'Instagram Story', hint: '9:16 · 1080×1920', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'square', label: 'Carré', hint: '1:1 · 1080×1080', icon: <SquareIcon className="w-4 h-4" /> },
];

export const SharePanel: React.FC<SharePanelProps> = ({
  assignments,
  players,
  hotTakeId,
  controversy,
  sportLabel,
  expertMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>('story');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  /** Génère l'image et déclenche le téléchargement. */
  const generate = useCallback(
    async (targetFormat: ShareFormat, autoDownload: boolean) => {
      setIsGenerating(true);
      setError(null);
      try {
        const blob = await renderShareImage({
          assignments,
          players,
          hotTakeId,
          controversy,
          sportLabel,
          expertMode,
          format: targetFormat,
        });

        releasePreview();
        const url = URL.createObjectURL(blob);
        previewRef.current = url;
        setPreviewUrl(url);

        if (autoDownload) {
          downloadBlob(blob, `goat-chevre-the-king-${targetFormat}-${Date.now()}.png`);
        }
      } catch (err: any) {
        setError(err?.message || "Génération de l'image impossible.");
      } finally {
        setIsGenerating(false);
      }
    },
    [assignments, players, hotTakeId, controversy, sportLabel, expertMode, releasePreview],
  );

  const openPanel = () => {
    setIsOpen(true);
    void generate(format, false);
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
            Génère une image prête à publier avec ta pyramide, ton % de controverse et un QR code vers
            goatchevretheking.alphabette.fr.
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

            {error && (
              <p className="text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-[11px] text-slate-400 leading-relaxed">
              L'image contient : ta pyramide (photos, noms, années), le badge « Hot Take 🔥 », ton % de controverse, un
              QR code vers goatchevretheking.alphabette.fr et la mention d'invitation.
            </p>
          </div>

          {/* Aperçu */}
          <div className="flex items-start justify-center">
            <div
              className={`rounded-2xl border border-slate-700 bg-slate-950/70 overflow-hidden flex items-center justify-center ${
                format === 'story' ? 'w-[190px] h-[338px]' : 'w-[260px] h-[260px]'
              }`}
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
