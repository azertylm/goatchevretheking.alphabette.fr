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

/** Découpe un texte en lignes (au plus `maxLines`) selon la largeur disponible. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
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
        const fallback = await loadPhoto(
          buildFallbackAvatar(player.name, {
            sport: player.sport,
            countryCode: player.countryCode,
          }),
        );
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
  const badgeW = width - padding * 2 - (isStory ? 250 : 200);
  const badgeHeight = isStory ? 170 : 110;
  roundedRect(ctx, badgeX, footerY, badgeW, badgeHeight, 20);
  ctx.fillStyle = 'rgba(251,191,36,0.10)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Le pourcentage occupe la gauche du badge, le texte la droite : deux zones
  // distinctes, sans chevauchement même avec « 100 % ».
  const pctOffsetX = isStory ? 28 : 22;
  const textOffsetX = isStory ? 214 : 158;
  const textWidth = badgeW - textOffsetX - 24;

  ctx.fillStyle = '#fbbf24';
  ctx.font = `900 ${isStory ? 58 : 44}px ${FONT_STACK}`;
  ctx.fillText(`${controversy.percent}%`, badgeX + pctOffsetX, footerY + (isStory ? 106 : 72));

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isStory ? 24 : 19}px ${FONT_STACK}`;
  const storyLabelLines = wrapLines(ctx, controversy.label, textWidth, 2);
  storyLabelLines.forEach((line, index) => {
    ctx.fillText(line, badgeX + textOffsetX, footerY + (isStory ? 50 : 36) + index * (isStory ? 32 : 25));
  });

  const metaY = footerY + (isStory ? 50 : 36) + storyLabelLines.length * (isStory ? 32 : 25) + 22;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${isStory ? 19 : 15}px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, 'Jauge de Controverse · standard Wikidata', textWidth), badgeX + textOffsetX, metaY);
  ctx.fillText(
    fitText(ctx, `Standard n°1 : ${controversy.consensusLeader}`, textWidth),
    badgeX + textOffsetX,
    metaY + (isStory ? 26 : 22),
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

/* ──────────────────────────────────────────────────────────────────────────
   Affiche A4 (2480 × 3508 px, 300 dpi) : la story 9:16 encadrée sur une
   feuille crème, avec le palmarès en légende. Prête à imprimer.
   ────────────────────────────────────────────────────────────────────────── */

async function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Lecture de l'image impossible."));
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export type PosterOptions = Omit<ShareImageOptions, 'format'>;

/** Rend une affiche A4 (portrait) contenant la story et son palmarès. */
export async function renderPosterImage(options: PosterOptions): Promise<Blob> {
  const storyBlob = await renderShareImage({ ...options, format: 'story' });
  const story = await loadBlobImage(storyBlob);

  const width = 2480;
  const height = 3508;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Rendu canvas indisponible dans ce navigateur.');

  const playersById = new Map(options.players.map((player) => [player.id, player]));
  const goat = playersById.get(options.assignments['L1-0']);
  const hotTake = options.hotTakeId ? playersById.get(options.hotTakeId) : undefined;

  // Papier crème + cadre doré
  ctx.fillStyle = '#f6f0e2';
  ctx.fillRect(0, 0, width, height);
  const wash = ctx.createRadialGradient(width * 0.2, 0, 80, width * 0.2, 0, width);
  wash.addColorStop(0, 'rgba(251,191,36,0.16)');
  wash.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#b08d3f';
  ctx.lineWidth = 6;
  ctx.strokeRect(76, 76, width - 152, height - 152);
  ctx.strokeStyle = 'rgba(176,141,63,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 100, width - 200, height - 200);

  // Titre
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1f2937';
  ctx.font = `900 104px ${FONT_STACK}`;
  ctx.fillText('MON CLASSEMENT', 160, 250);
  ctx.fillStyle = '#b45309';
  ctx.font = `900 152px ${FONT_STACK}`;
  ctx.fillText('GOAT', 160, 400);

  ctx.fillStyle = '#57534e';
  ctx.font = `700 48px ${FONT_STACK}`;
  ctx.fillText(`Univers ${options.sportLabel}`, 160, 470);

  // Story encadrée (9:16), la plus grande possible au-dessus du pied de page
  const imgX = 160;
  const imgY = 520;
  const imgW = 1520;
  const imgH = Math.round((imgW * 16) / 9);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#020617';
  roundedRect(ctx, imgX - 10, imgY - 10, imgW + 20, imgH + 20, 26);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, imgX, imgY, imgW, imgH, 18);
  ctx.clip();
  ctx.drawImage(story, imgX, imgY, imgW, imgH);
  ctx.restore();

  // Colonne de légende
  const colX = 1740;
  const colW = 580;

  ctx.fillStyle = '#92400e';
  ctx.font = `800 36px ${FONT_STACK}`;
  ctx.fillText('LE GOAT ULTIME', colX, 600);

  ctx.fillStyle = '#111827';
  ctx.font = `900 62px ${FONT_STACK}`;
  const goatName = goat ? goat.name : 'Place libre';
  ctx.fillText(fitText(ctx, goatName, colW), colX, 690);

  ctx.fillStyle = '#6b7280';
  ctx.font = `600 34px ${FONT_STACK}`;
  ctx.fillText(goat ? goat.career : '—', colX, 748);

  ctx.strokeStyle = 'rgba(176,141,63,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(colX, 800);
  ctx.lineTo(colX + colW, 800);
  ctx.stroke();

  // Controverse
  ctx.fillStyle = '#b45309';
  ctx.font = `900 132px ${FONT_STACK}`;
  ctx.fillText(`${options.controversy.percent}%`, colX, 950);

  ctx.fillStyle = '#1f2937';
  ctx.font = `800 32px ${FONT_STACK}`;
  const labelLines = wrapLines(ctx, options.controversy.label, colW, 2);
  labelLines.forEach((line, index) => {
    ctx.fillText(line, colX, 1015 + index * 40);
  });

  ctx.fillStyle = '#6b7280';
  ctx.font = `600 26px ${FONT_STACK}`;
  const detailY = 1015 + labelLines.length * 40 + 24;
  ctx.fillText('Jauge de Controverse', colX, detailY);
  ctx.fillText(
    fitText(ctx, `Standard n°1 : ${options.controversy.consensusLeader}`, colW),
    colX,
    detailY + 38,
  );

  // Hot Take
  if (hotTake) {
    ctx.fillStyle = 'rgba(249,115,22,0.14)';
    roundedRect(ctx, colX, 1470, colW, 150, 22);
    ctx.fill();
    ctx.fillStyle = '#c2410c';
    ctx.font = `800 30px ${FONT_STACK}`;
    ctx.fillText('🔥  HOT TAKE', colX + 26, 1526);
    ctx.fillStyle = '#1f2937';
    ctx.font = `800 38px ${FONT_STACK}`;
    ctx.fillText(fitText(ctx, hotTake.name, colW - 52), colX + 26, 1578);
  }

  // Citation (remplit la colonne et rappelle que le standard n'est pas un verdict)
  ctx.fillStyle = '#57534e';
  ctx.font = `italic 700 34px ${FONT_STACK}`;
  wrapLines(
    ctx,
    '« Le classement standard recense les trophées ; il ne dit pas qui tu aimes. »',
    colW,
    4,
  ).forEach((line, index) => {
    ctx.fillText(line, colX, 1840 + index * 46);
  });

  ctx.fillStyle = '#92400e';
  ctx.font = `800 28px ${FONT_STACK}`;
  ctx.fillText('TA PYRAMIDE, TON VERDICT.', colX, 2100);

  // QR code
  const qrSize = 280;
  const qrY = 2300;
  const qrDataUrl = await QRCode.toDataURL(SHARE_URL, {
    margin: 1,
    width: qrSize,
    color: { dark: '#111827', light: '#ffffff' },
  });
  const qrImage = await loadPhoto(qrDataUrl);
  if (qrImage) {
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, colX - 6, qrY - 6, qrSize + 12, qrSize + 12, 18);
    ctx.fill();
    ctx.drawImage(qrImage, colX, qrY, qrSize, qrSize);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1f2937';
  ctx.font = `800 32px ${FONT_STACK}`;
  ctx.fillText('Scanne et riposte', colX, qrY + qrSize + 58);
  ctx.fillStyle = '#6b7280';
  ctx.font = `600 26px ${FONT_STACK}`;
  ctx.fillText('goatchevretheking', colX, qrY + qrSize + 98);
  ctx.fillText('.alphabette.fr', colX, qrY + qrSize + 130);

  // Pied de page
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1f2937';
  ctx.font = `800 44px ${FONT_STACK}`;
  ctx.fillText(SHARE_MENTION, width / 2, height - 190);
  ctx.fillStyle = '#b45309';
  ctx.font = `700 32px ${FONT_STACK}`;
  ctx.fillText('alphabette.fr — écosystème logiciel souverain', width / 2, height - 130);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Génération de l'affiche impossible."));
    }, 'image/png');
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Carte joueur 9:16 : une vignette individuelle (photo, nom, rang au
   classement standard) à partager ou à glisser dans une story.
   ────────────────────────────────────────────────────────────────────────── */

export interface PlayerCardImageOptions {
  player: GoatPlayer;
  /** Rang au classement standard (1 = le plus prestigieux). */
  rank: number;
  /** Effectif de la discipline. */
  total: number;
  sportLabel: string;
}

export async function renderPlayerCardImage(options: PlayerCardImageOptions): Promise<Blob> {
  const { player, rank, total, sportLabel } = options;
  if (document.fonts?.ready) await document.fonts.ready;

  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Rendu canvas indisponible dans ce navigateur.');

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#020617');
  background.addColorStop(0.6, '#0f172a');
  background.addColorStop(1, '#020617');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, 420, 60, width / 2, 420, 720);
  glow.addColorStop(0, 'rgba(251,191,36,0.24)');
  glow.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = `800 30px ${FONT_STACK}`;
  ctx.fillText('🐐  GOAT CHÈVRE THE KING', width / 2, 100);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `700 28px ${FONT_STACK}`;
  ctx.fillText(`Univers ${sportLabel}`, width / 2, 150);

  // Vignette 3:4
  const photo = (await loadPhoto(player.image)) ?? (await loadPhoto(
    buildFallbackAvatar(player.name, { sport: player.sport, countryCode: player.countryCode }),
  ));

  const cardX = 130;
  const cardY = 220;
  const cardW = 820;
  const cardH = Math.round((cardW * 4) / 3);

  ctx.save();
  ctx.shadowColor = 'rgba(251,191,36,0.28)';
  ctx.shadowBlur = 80;
  ctx.fillStyle = '#0b1220';
  roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
  ctx.clip();
  if (photo) {
    const rect = computePhotoDrawRect(
      photo.width,
      photo.height,
      cardX,
      cardY,
      cardW,
      cardH,
      getPhotoFrame(player.id),
    );
    ctx.drawImage(photo, rect.dx, rect.dy, rect.dw, rect.dh);
  } else {
    ctx.fillStyle = '#111827';
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }
  ctx.restore();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 34);
  ctx.stroke();

  if (player.isCurrentlyCompeting) {
    ctx.fillStyle = '#10b981';
    roundedRect(ctx, cardX + 24, cardY + 24, 250, 54, 27);
    ctx.fill();
    ctx.fillStyle = '#022c22';
    ctx.font = `800 26px ${FONT_STACK}`;
    ctx.fillText('En compétition', cardX + 149, cardY + 60);
  }

  const nameY = cardY + cardH + 100;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 72px ${FONT_STACK}`;
  ctx.fillText(fitText(ctx, player.name, width - 160), width / 2, nameY);

  ctx.fillStyle = '#fcd34d';
  ctx.font = `700 36px ${FONT_STACK}`;
  ctx.fillText(player.career, width / 2, nameY + 60);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `800 40px ${FONT_STACK}`;
  ctx.fillText(`N° ${rank} sur ${total} au palmarès recensé`, width / 2, nameY + 150);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 28px ${FONT_STACK}`;
  ctx.fillText('Classement standard (palmarès recensé), pas une vérité absolue.', width / 2, nameY + 200);

  const qrSize = 180;
  const qrDataUrl = await QRCode.toDataURL(SHARE_URL, {
    margin: 1,
    width: qrSize,
    color: { dark: '#020617', light: '#ffffff' },
  });
  const qrImage = await loadPhoto(qrDataUrl);
  if (qrImage) {
    const qrX = width - qrSize - 60;
    const qrY = height - qrSize - 90;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 14);
    ctx.fill();
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${FONT_STACK}`;
  wrapLines(ctx, SHARE_MENTION, 720, 2).forEach((line, index) => {
    ctx.fillText(line, 60, height - 240 + index * 42);
  });
  ctx.fillStyle = '#34d399';
  ctx.font = `700 24px ${FONT_STACK}`;
  ctx.fillText('alphabette.fr', 60, height - 150);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Génération de la carte impossible."));
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
