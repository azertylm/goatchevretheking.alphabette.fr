import QRCode from 'qrcode';
import { GoatPlayer } from './types';
import { buildFallbackAvatar } from './fallbackAvatar';
import { ControversyResult } from './controversy';
import { PYRAMID_TIERS, visibleSlotIds } from './pyramidModel';
import { computePhotoDrawRect, getPhotoFrame } from './photoFrames';
import { playerPhotoUrl } from './images';

/**
 * @file shareImage.ts
 * Génération, via l'API Canvas, d'une image haute définition prête à partager :
 *  - « story » : 1080 × 1920 (Instagram / TikTok / Snapchat, format 9:16)
 *  - « square » : 1080 × 1080 (Twitter / X, WhatsApp, LinkedIn, format 1:1)
 *
 * Contenu : titre, pyramide (photos + noms + années), badge Hot Take, % de controverse,
 * QR code vers goatchevretheking.alphabette.fr et mention d'invitation.
 */

export type ShareFormat = 'story' | 'square';

export const SHARE_URL = 'https://goatchevretheking.alphabette.fr';
export const SHARE_MENTION = 'Fais ton classement gratuitement sur goatchevretheking.alphabette.fr';

const SIZES: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export interface ShareImageOptions {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  hotTakeId: string | null;
  controversy: ControversyResult;
  sportLabel: string;
  expertMode: boolean;
  format: ShareFormat;
}

const FONT_STACK = "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif";

/** Charge une image en mode CORS ; retourne null si indisponible (photo cassée ou bloquée). */
async function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const source = playerPhotoUrl(url);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/**
 * Rend l'image de partage et retourne un PNG (Blob).
 */
export async function renderShareImage(options: ShareImageOptions): Promise<Blob> {
  const { assignments, players, hotTakeId, controversy, sportLabel, expertMode, format } = options;
  const { width, height } = SIZES[format];

  // Les polices de la page doivent être prêtes avant le rendu canvas.
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const playersById = new Map(players.map((player) => [player.id, player]));
  const slotIds = visibleSlotIds(expertMode).filter((slot) => assignments[slot]);

  // Chargement des photos (repli sur l'avatar SVG en cas d'échec CORS ou d'image cassée).
  const photos = new Map<string, HTMLImageElement>();
  await Promise.all(
    slotIds.map(async (slot) => {
      const player = playersById.get(assignments[slot]);
      if (!player) return;
      const loaded = await loadPhoto(player.image);
      if (loaded) {
        photos.set(player.id, loaded);
      } else {
        const fallback = await loadPhoto(buildFallbackAvatar(player.name));
        if (fallback) photos.set(player.id, fallback);
      }
    }),
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Rendu canvas indisponible dans ce navigateur.');

  const isStory = format === 'story';
  const padding = isStory ? 56 : 40;

  // --- Fond ---
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#020617');
  background.addColorStop(0.55, '#0f172a');
  background.addColorStop(1, '#020617');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, isStory ? 380 : 250, 40, width / 2, isStory ? 380 : 250, 620);
  glow.addColorStop(0, 'rgba(251,191,36,0.22)');
  glow.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // --- En-tête ---
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = `800 ${isStory ? 30 : 26}px ${FONT_STACK}`;
  ctx.fillText('🐐  GOAT CHÈVRE THE KING', width / 2, isStory ? 96 : 78);

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${isStory ? 68 : 54}px ${FONT_STACK}`;
  ctx.fillText('Mon classement GOAT', width / 2, isStory ? 182 : 148);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${isStory ? 32 : 26}px ${FONT_STACK}`;
  ctx.fillText(`Univers ${sportLabel} · goatchevretheking.alphabette.fr`, width / 2, isStory ? 232 : 190);

  // --- Pyramide ---
  const pyramidTop = isStory ? 300 : 230;
  const footerHeight = isStory ? 420 : 250;
  const pyramidBottom = height - footerHeight;
  const pyramidBand = pyramidBottom - pyramidTop;

  const tiers = PYRAMID_TIERS.filter((tier) => !tier.expert || expertMode);
  const gap = isStory ? 14 : 10;

  // Dimensions naturelles de chaque étage, puis mise à l'échelle pour tenir dans la bande.
  const natural = tiers.map((tier) => {
    const available = width - padding * 2;
    const cardWidth = (available - gap * (tier.places - 1)) / tier.places;
    const photoHeight = Math.min(cardWidth * 1.05, isStory ? 210 : 150);
    const cardHeight = photoHeight + (tier.places > 4 ? 46 : 54);
    return { tier, cardWidth, photoHeight, cardHeight };
  });

  const labelHeight = isStory ? 30 : 22;
  const naturalTotal = natural.reduce((sum, item) => sum + item.cardHeight + labelHeight + gap, 0);
  const scale = Math.min(1, pyramidBand / naturalTotal);

  let cursorY = pyramidTop + Math.max(0, (pyramidBand - naturalTotal * scale) / 2);

  natural.forEach(({ tier, cardWidth, photoHeight, cardHeight }) => {
    const rowWidth = cardWidth * tier.places + gap * (tier.places - 1);
    const startX = (width - rowWidth) / 2;
    const scaledCardWidth = cardWidth * scale;
    const scaledPhotoHeight = photoHeight * scale;
    const scaledCardHeight = cardHeight * scale;

    // Libellé de l'étage
    ctx.fillStyle = tier.level === 1 ? '#fbbf24' : '#64748b';
    ctx.font = `700 ${(isStory ? 22 : 17) * Math.max(scale, 0.7)}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    const label =
      tier.level === 1
        ? '👑 LE GOAT ULTIME'
        : `ÉTAGE ${tier.level} · ${tier.places} PLACE${tier.places > 1 ? 'S' : ''}`;
    ctx.fillText(label, width / 2, cursorY + labelHeight * scale * 0.7);

    let cardY = cursorY + labelHeight * scale;

    for (let index = 0; index < tier.places; index += 1) {
      const slot = `L${tier.level}-${index}`;
      const x = startX + index * (scaledCardWidth + gap * scale);
      const playerId = assignments[slot];
      const player = playerId ? playersById.get(playerId) : undefined;

      // Carte
      ctx.save();
      roundedRect(ctx, x, cardY, scaledCardWidth, scaledCardHeight, 14 * scale);
      ctx.fillStyle = player ? '#0b1220' : 'rgba(15,23,42,0.55)';
      ctx.fill();
      ctx.strokeStyle = playerId && hotTakeId === playerId ? '#fb923c' : player ? '#1e293b' : '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (player) {
        // Photo cadrée en haut (visage)
        const photo = photos.get(player.id);
        if (photo) {
          const boxX = x + 2;
          const boxY = cardY + 2;
          const boxWidth = scaledCardWidth - 4;
          const boxHeight = scaledPhotoHeight - 2;
          ctx.save();
          roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 12 * scale);
          ctx.clip();
          // Même cadrage que dans l'application (image entière par défaut).
          const rect = computePhotoDrawRect(
            photo.width,
            photo.height,
            boxX,
            boxY,
            boxWidth,
            boxHeight,
            getPhotoFrame(player.id),
          );
          ctx.drawImage(photo, rect.dx, rect.dy, rect.dw, rect.dh);
          ctx.restore();
        }

        // Nom + années
        const textPadding = 8 * scale;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.max(13, 20 * scale)}px ${FONT_STACK}`;
        ctx.fillText(
          fitText(ctx, player.name, scaledCardWidth - textPadding * 2),
          x + scaledCardWidth / 2,
          cardY + scaledPhotoHeight + 22 * scale,
        );

        ctx.fillStyle = '#fcd34d';
        ctx.font = `700 ${Math.max(11, 17 * scale)}px ${FONT_STACK}`;
        ctx.fillText(
          fitText(ctx, player.career, scaledCardWidth - textPadding * 2),
          x + scaledCardWidth / 2,
          cardY + scaledPhotoHeight + 44 * scale,
        );

        // Badge Hot Take
        if (hotTakeId === player.id) {
          ctx.fillStyle = '#f97316';
          roundedRect(ctx, x + 6 * scale, cardY + 6 * scale, 96 * scale, 30 * scale, 8 * scale);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.max(11, 16 * scale)}px ${FONT_STACK}`;
          ctx.fillText('🔥 Hot Take', x + 6 * scale + 48 * scale, cardY + 26 * scale);
        }
      } else {
        ctx.fillStyle = '#334155';
        ctx.font = `600 ${Math.max(11, 16 * scale)}px ${FONT_STACK}`;
        ctx.fillText('Place libre', x + scaledCardWidth / 2, cardY + scaledCardHeight / 2);
      }

      ctx.restore();
    }

    cursorY += (scaledCardHeight + labelHeight * scale + gap * scale);
  });

  // --- Bandeau bas : controverse + QR + mention ---
  const footerY = height - footerHeight + 8;

  // Badge de controverse
  ctx.textAlign = 'left';
  const badgeX = padding;
  const badgeW = width - padding * 2 - (isStory ? 240 : 200);
  roundedRect(ctx, badgeX, footerY, badgeW, isStory ? 118 : 92, 20);
  ctx.fillStyle = 'rgba(251,191,36,0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = `900 ${isStory ? 54 : 42}px ${FONT_STACK}`;
  ctx.fillText(`${controversy.percent}%`, badgeX + 26, footerY + (isStory ? 70 : 56));

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isStory ? 24 : 19}px ${FONT_STACK}`;
  ctx.fillText(
    fitText(ctx, controversy.label, badgeW - (isStory ? 210 : 170)),
    badgeX + (isStory ? 160 : 130),
    footerY + (isStory ? 46 : 36),
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${isStory ? 20 : 16}px ${FONT_STACK}`;
  ctx.fillText(
    'Jauge de Controverse · classement standard Wikidata',
    badgeX + (isStory ? 160 : 130),
    footerY + (isStory ? 76 : 62),
  );
  ctx.fillText(
    `Standard n°1 : ${fitText(ctx, controversy.consensusLeader, badgeW - (isStory ? 210 : 170))}`,
    badgeX + (isStory ? 160 : 130),
    footerY + (isStory ? 102 : 82),
  );

  // QR code
  const qrSize = isStory ? 200 : 168;
  const qrX = width - padding - qrSize;
  const qrY = footerY;
  const qrDataUrl = await QRCode.toDataURL(SHARE_URL, {
    margin: 1,
    width: qrSize,
    color: { dark: '#020617', light: '#ffffff' },
  });
  const qrImage = await loadPhoto(qrDataUrl);
  if (qrImage) {
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
    ctx.fill();
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  }

  // Mention d'invitation
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isStory ? 30 : 24}px ${FONT_STACK}`;
  ctx.fillText(SHARE_MENTION, width / 2, height - (isStory ? 96 : 62));

  ctx.fillStyle = '#34d399';
  ctx.font = `700 ${isStory ? 24 : 20}px ${FONT_STACK}`;
  ctx.fillText('alphabette.fr — écosystème logiciel souverain', width / 2, height - (isStory ? 52 : 30));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Génération de l'image impossible."));
    }, 'image/png');
  });
}

/** Déclenche le téléchargement du PNG généré. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
