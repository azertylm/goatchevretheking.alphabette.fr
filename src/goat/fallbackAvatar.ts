/**
 * @file fallbackAvatar.ts
 * Vignette de secours générée automatiquement (initiales + couleur de la
 * discipline + drapeau du pays) lorsqu'une photo Wikimedia est introuvable,
 * lente ou cassée.
 *
 * Aucune requête réseau : l'image est produite en data URI côté navigateur,
 * donc elle s'affiche instantanément même avec 500 cartes à l'écran.
 */

/** Couleur d'identité de chaque discipline (carte sportive rétro-moderne). */
export const SPORT_ACCENTS: Record<string, string> = {
  football: '#22c55e',
  nba: '#f97316',
  tennis: '#a3e635',
  swimming: '#38bdf8',
  'table-tennis': '#f43f5e',
  rugby: '#d97706',
  handball: '#06b6d4',
  athletics: '#ef4444',
  cycling: '#facc15',
  judo: '#6366f1',
  boxing: '#dc2626',
  f1: '#e11d48',
  volleyball: '#fbbf24',
  golf: '#16a34a',
  'ice-hockey': '#60a5fa',
  cricket: '#15803d',
  badminton: '#f472b6',
  gymnastics: '#c084fc',
  fencing: '#94a3b8',
  rowing: '#0ea5e9',
  weightlifting: '#9333ea',
  wrestling: '#b91c1c',
  'alpine-skiing': '#22d3ee',
  snowboarding: '#a78bfa',
  'figure-skating': '#67e8f9',
  'speed-skating': '#2dd4bf',
  equestrian: '#a16207',
  sailing: '#0284c7',
  archery: '#65a30d',
  shooting: '#71717a',
};

/** Couleur de repli si la discipline est inconnue (vert terroir de l'app). */
const DEFAULT_ACCENT = '#34d399';

/** Initiales d'un nom : « Kylian Mbappé » -> « KM ». */
export function initialsOf(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  if (!cleaned) return '?';
  const words = cleaned.split(/[\s'-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Teinte stable dérivée du nom (même joueur = même couleur de repli). */
export function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

/**
 * Drapeau du pays à partir du code ISO 3166-1 alpha-2 (« FR » -> 🇫🇷).
 * Windows ne dessine pas les drapeaux emoji : le code pays accompagne
 * toujours le drapeau dans la vignette, qui reste donc lisible partout.
 */
export function flagEmoji(countryCode?: string | null): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return '';
  const code = countryCode.toUpperCase();
  if (code === 'XX') return '';
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

/** Éclaircit (factor > 1) ou assombrit (factor < 1) une couleur #rrggbb. */
export function shade(hex: string, factor: number): string {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16);
    return Math.max(0, Math.min(255, Math.round(channel * factor)));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export interface FallbackAvatarOptions {
  /** Discipline : donne la couleur d'identité de la vignette. */
  sport?: string;
  /** Code pays ISO affiché en drapeau + code. */
  countryCode?: string | null;
  /** Côté du carré en pixels (la carte recadre en 3:4). */
  size?: number;
}

/** Code pays exploitable (« FR », mais pas « XX » ni vide). */
export function hasCountryCode(countryCode?: string | null): boolean {
  return Boolean(countryCode) && /^[A-Za-z]{2}$/.test(countryCode as string) && countryCode!.toUpperCase() !== 'XX';
}

/**
 * Construit un data URI SVG : fond aux couleurs de la discipline (bandes
 * diagonales façon carte Panini), initiales du joueur, drapeau et code pays.
 */
export function buildFallbackAvatar(
  name: string,
  options: FallbackAvatarOptions = {},
): string {
  const { sport, countryCode, size = 300 } = options;
  const initials = initialsOf(name);
  const accent = sport ? SPORT_ACCENTS[sport] ?? DEFAULT_ACCENT : null;
  // Sans discipline connue (image de partage d'une ancienne base), on retombe
  // sur une teinte stable dérivée du nom.
  const top = accent ? shade(accent, 0.55) : `hsl(${hueOf(name)} 52% 30%)`;
  const bottom = accent ? shade(accent, 0.14) : `hsl(${hueOf(name)} 48% 10%)`;
  const flag = flagEmoji(countryCode);
  const code = hasCountryCode(countryCode) ? (countryCode as string).toUpperCase() : '';

  const footer = flag
    ? `<text x="50%" y="88%" text-anchor="middle" font-family="'Segoe UI Emoji', 'Apple Color Emoji', system-ui, sans-serif" font-size="${size * 0.11}">${flag}</text>
  ${code ? `<text x="50%" y="96%" text-anchor="middle" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="${size * 0.06}" font-weight="700" fill="#f8fafc" opacity="0.75" letter-spacing="2">${code}</text>` : ''}`
    : `<text x="50%" y="90%" text-anchor="middle" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="${size * 0.055}" font-weight="600" fill="#e2e8f0" opacity="0.7">Photo indisponible</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${initials}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${top}"/>
      <stop offset="100%" stop-color="${bottom}"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g fill="#ffffff" opacity="0.07">
    <rect x="${-size}" y="${size * 0.62}" width="${size * 3}" height="${size * 0.1}" transform="rotate(-24 ${size / 2} ${size / 2})"/>
    <rect x="${-size}" y="${size * 0.78}" width="${size * 3}" height="${size * 0.05}" transform="rotate(-24 ${size / 2} ${size / 2})"/>
  </g>
  <rect width="${size}" height="${size}" fill="url(#shine)"/>
  <rect x="4" y="4" width="${size - 8}" height="${size - 8}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" rx="${size * 0.06}"/>
  <text x="50%" y="${flag ? '54%' : '52%'}" text-anchor="middle" dominant-baseline="middle"
        font-family="'Plus Jakarta Sans', system-ui, sans-serif"
        font-size="${size * 0.32}" font-weight="800" fill="#ffffff" letter-spacing="1">${initials}</text>
  ${footer}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
