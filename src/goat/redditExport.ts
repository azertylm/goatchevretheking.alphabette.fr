import { PYRAMID_TIERS } from './pyramidModel';
import { ControversyResult } from './controversy';
import { GoatPlayer } from './types';
import { SHARE_URL } from './shareImage';

/**
 * @file redditExport.ts
 * Export « texte » prêt à coller sur Reddit, Discord ou un forum : une synthèse
 * Markdown du classement (étages, Hot Take, controverse) et un lien de
 * contestation `?p=…`. Aucune image, aucun serveur : du texte copiable.
 */

export interface RedditExportOptions {
  assignments: Record<string, string>;
  players: GoatPlayer[];
  hotTakeId: string | null;
  controversy: ControversyResult;
  sportLabel: string;
  expertMode: boolean;
  /** Lien de contestation (`?p=…`) ; à défaut, l'accueil du site. */
  link?: string;
}

const escapeMarkdown = (value: string): string => value.replace(/([|*_`[\]])/g, '\\$1');

/** Construit le bloc Markdown du classement. */
export function buildRedditMarkdown(options: RedditExportOptions): string {
  const { assignments, players, hotTakeId, controversy, sportLabel, expertMode, link } = options;
  const byId = new Map(players.map((player) => [player.id, player]));
  const linkUrl = link || SHARE_URL;

  const filled = Object.values(assignments).filter(Boolean).length;
  const total = PYRAMID_TIERS.filter((tier) => !tier.expert || expertMode)
    .reduce((sum, tier) => sum + tier.places, 0);

  const lines: string[] = [];
  lines.push(`# 🐐 Mon classement GOAT — ${escapeMarkdown(sportLabel)}`);
  lines.push('');
  lines.push(
    `**${filled}/${total} places** · **${controversy.percent} % de controverse** — ${escapeMarkdown(
      controversy.label,
    )}`,
  );
  lines.push('');

  for (const tier of PYRAMID_TIERS) {
    if (tier.expert && !expertMode) continue;
    const names: string[] = [];
    for (let index = 0; index < tier.places; index += 1) {
      const player = byId.get(assignments[`L${tier.level}-${index}`]);
      if (!player) continue;
      const hot = hotTakeId === player.id ? ' 🔥' : '';
      names.push(`${escapeMarkdown(player.name)} (${escapeMarkdown(player.career)})${hot}`);
    }
    if (names.length === 0) continue;
    const prefix = tier.level === 1 ? '👑 **LE GOAT ULTIME**' : `**Étage ${tier.level}**`;
    lines.push(`${prefix} — ${names.join(' · ')}`);
  }

  lines.push('');
  if (hotTakeId) {
    const hot = byId.get(hotTakeId);
    if (hot) lines.push(`🔥 **Hot Take** : ${escapeMarkdown(hot.name)}`);
  }
  lines.push(`📊 **${escapeMarkdown(controversy.label)}** — standard n°1 : ${escapeMarkdown(controversy.consensusLeader)}`);
  lines.push('');
  lines.push(`👉 [Fais ton classement et riposte](${linkUrl})`);
  lines.push('');
  lines.push('_Généré avec Goat Chèvre The King — goatchevretheking.alphabette.fr_');
  return lines.join('\n');
}

/** Télécharge le Markdown en `.md`. */
export function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
