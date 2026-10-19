import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * @file communityStore.ts
 * Comptes utilisateurs et pyramides partagées de la communauté
 * « Goat Chèvre The King ».
 *
 * Stockage volontairement simple et sans dépendance : deux fichiers JSON
 * (data/community/users.json et data/community/pyramids.json) et les images
 * haute définition des pyramides dans data/community/images/.
 * Les mots de passe ne sont jamais stockés en clair (scrypt + sel aléatoire).
 */

export interface CommunityUser {
  id: string;
  username: string;
  /** Pseudo normalisé (minuscules) utilisé pour l'unicité et la connexion. */
  usernameLower: string;
  passwordHash: string;
  createdAt: string;
  banned: boolean;
}

export interface CommunityPlayerEntry {
  slot: string;
  id: string;
  name: string;
  career: string;
  /** Vignette du joueur (utilisée pour rejouer la pyramide dans la galerie). */
  image?: string;
}

export interface CommunityPyramid {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  sport: string;
  sportLabel: string;
  /** Score de controverse 0-100 face au classement standard. */
  controversy: number;
  controversyLabel: string;
  hotTakeName: string | null;
  filled: number;
  total: number;
  expertMode: boolean;
  format: string;
  /** Empreinte de la pyramide (sport + joueurs par échelle) : évite les doublons. */
  signature: string;
  topPlayerId: string | null;
  topPlayerName: string | null;
  players: CommunityPlayerEntry[];
  /** Identifiants des votants (comptes ou visiteurs anonymes). */
  voters: string[];
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersFile {
  version: number;
  users: CommunityUser[];
}

interface PyramidsFile {
  version: number;
  pyramids: CommunityPyramid[];
}

export class CommunityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const COMMUNITY_DIR = path.join(process.cwd(), "data", "community");
export const COMMUNITY_IMAGES_DIR = path.join(COMMUNITY_DIR, "images");
const USERS_PATH = path.join(COMMUNITY_DIR, "users.json");
const PYRAMIDS_PATH = path.join(COMMUNITY_DIR, "pyramids.json");

export const MAX_PYRAMIDS_PER_USER = 40;
const MAX_VOTERS_PER_PYRAMID = 50000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Utilitaires de lecture / écriture atomique                          */
/* ------------------------------------------------------------------ */

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    // Un éditeur Windows peut ajouter un BOM : on le retire avant de parser.
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return (parsed ?? fallback) as T;
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      console.error(`[COMMUNITY] Lecture impossible (${path.basename(filePath)}):`, err?.message);
    }
    return fallback;
  }
}

function writeJsonFile(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/* ------------------------------------------------------------------ */
/* Mots de passe                                                       */
/* ------------------------------------------------------------------ */

/** Empreinte scrypt avec sel aléatoire : « scrypt:<sel>:<empreinte> ». */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

/** Vérification en temps constant d'un mot de passe. */
export function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = (stored || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(derived, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Utilisateurs                                                        */
/* ------------------------------------------------------------------ */

function readUsers(): CommunityUser[] {
  const file = readJsonFile<UsersFile>(USERS_PATH, { version: 1, users: [] });
  return Array.isArray(file.users) ? file.users : [];
}

function writeUsers(users: CommunityUser[]): void {
  writeJsonFile(USERS_PATH, { version: 1, users });
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

/** Recherche par pseudo (insensible à la casse). */
export function findUserByUsername(username: string): CommunityUser | undefined {
  const needle = (username || "").trim().toLowerCase();
  return readUsers().find((user) => user.usernameLower === needle);
}

export function findUserById(id: string): CommunityUser | undefined {
  return readUsers().find((user) => user.id === id);
}

export interface RegisterInput {
  username?: unknown;
  password?: unknown;
}

/**
 * Création d'un compte : pseudo unique (3-20 caractères) + mot de passe (6 min).
 * Aucune adresse e-mail n'est demandée : la promesse « 100 % dans ton navigateur »
 * reste tenable côté jeu, et la communauté se contente d'un pseudo.
 */
export function createUser(input: RegisterInput): CommunityUser {
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    throw new CommunityError(
      "Pseudo invalide : 3 à 20 caractères, lettres, chiffres, tirets et underscores uniquement.",
      400,
    );
  }
  if (password.length < 6) {
    throw new CommunityError("Le mot de passe doit contenir au moins 6 caractères.", 400);
  }
  if (password.length > 200) {
    throw new CommunityError("Le mot de passe est trop long (200 caractères maximum).", 400);
  }
  if (findUserByUsername(username)) {
    throw new CommunityError(`Le pseudo « ${username} » est déjà pris. Choisis-en un autre.`, 409);
  }

  const user: CommunityUser = {
    id: crypto.randomUUID(),
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    banned: false,
  };

  const users = readUsers();
  users.push(user);
  writeUsers(users);
  return user;
}

/* ------------------------------------------------------------------ */
/* Pyramides partagées                                                 */
/* ------------------------------------------------------------------ */

function readPyramids(): CommunityPyramid[] {
  const file = readJsonFile<PyramidsFile>(PYRAMIDS_PATH, { version: 1, pyramids: [] });
  return Array.isArray(file.pyramids) ? file.pyramids : [];
}

function writePyramids(pyramids: CommunityPyramid[]): void {
  writeJsonFile(PYRAMIDS_PATH, { version: 1, pyramids: pyramids });
}

/** Empreinte unique d'une pyramide (sport + joueur placé sur chaque échelle). */export function pyramidSignature(sport: string, players: CommunityPlayerEntry[]): string {
  const body = [sport, ...[...players].sort((a, b) => a.slot.localeCompare(b.slot)).map((p) => `${p.slot}:${p.id}`)];
  return crypto.createHash("sha256").update(body.join("|")).digest("hex").slice(0, 32);
}

export interface PublishPyramidInput {
  user: CommunityUser;
  title?: unknown;
  sport?: unknown;
  sportLabel?: unknown;
  controversy?: unknown;
  controversyLabel?: unknown;
  hotTakeName?: unknown;
  filled?: unknown;
  total?: unknown;
  expertMode?: unknown;
  format?: unknown;
  players?: unknown;
  /** Image PNG encodée en data URL (image haute définition prête à partager). */
  image?: unknown;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePlayers(value: unknown): CommunityPlayerEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CommunityPlayerEntry[] = [];
  for (const raw of value.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const slot = sanitizeText(item.slot, 20);
    const id = sanitizeText(item.id, 40);
    const name = sanitizeText(item.name, 80);
    if (!slot || !id || !name) continue;
    entries.push({
      slot,
      id,
      name,
      career: sanitizeText(item.career, 40),
      image: sanitizeText(item.image, 500) || undefined,
    });
  }
  return entries;
}

/** Sauvegarde de l'image haute définition sur disque (data/community/images). */
function savePyramidImage(id: string, dataUrl: unknown): boolean {
  if (typeof dataUrl !== "string") return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return false;
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return false;

  fs.mkdirSync(COMMUNITY_IMAGES_DIR, { recursive: true });
  const filePath = path.join(COMMUNITY_IMAGES_DIR, `${id}.${extension}`);
  fs.writeFileSync(filePath, buffer);

  // Un fichier qui n'est pas une vraie image est refusé puis retiré.
  if (!isPngOrJpegFile(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignoré */
    }
    return false;
  }
  return true;
}

/**
 * Publication d'une pyramide dans la communauté.
 * Si l'utilisateur a déjà publié exactement la même pyramide (même empreinte),
 * l'entrée existante est mise à jour plutôt que dupliquée.
 */
export function publishPyramid(input: PublishPyramidInput): CommunityPyramid {
  const { user } = input;
  if (user.banned) throw new CommunityError("Ce compte est suspendu et ne peut plus publier.", 403);

  const players = normalizePlayers(input.players);
  if (players.length === 0) {
    throw new CommunityError("Place au moins un joueur sur ta pyramide avant de la publier.", 400);
  }

  // 30 disciplines : on accepte tout identifiant simple, avec un repli historique.
  const sport =
    typeof input.sport === "string" && /^[a-z0-9-]{2,24}$/.test(input.sport) ? input.sport : "football";
  const sportLabel =
    sanitizeText(input.sportLabel, 40) || (sport === "nba" ? "Basketball NBA" : "Football International");
  const title = sanitizeText(input.title, 90) || "Mon classement GOAT";
  const controversy = Math.max(0, Math.min(100, Math.round(Number(input.controversy) || 0)));
  const controversyLabel = sanitizeText(input.controversyLabel, 60);
  const hotTakeName = sanitizeText(input.hotTakeName, 80) || null;
  const filled = Math.max(0, Math.round(Number(input.filled) || players.length));
  const total = Math.max(filled, Math.round(Number(input.total) || players.length));
  const format = input.format === "square" ? "square" : "story";
  const signature = pyramidSignature(sport, players);

  // Le joueur placé tout en haut de la pyramide donne son titre à la carte.
  const topEntry =
    players.find((player) => player.slot === "L1-0") ??
    [...players].sort((a, b) => a.slot.localeCompare(b.slot))[0];

  const pyramids = readPyramids();
  const existing = pyramids.find((pyramid) => pyramid.userId === user.id && pyramid.signature === signature);

  if (existing) {
    existing.title = title;
    existing.controversy = controversy;
    existing.controversyLabel = controversyLabel;
    existing.hotTakeName = hotTakeName;
    existing.filled = filled;
    existing.total = total;
    existing.expertMode = input.expertMode === true;
    existing.format = format;
    existing.players = players;
    existing.topPlayerId = topEntry?.id ?? null;
    existing.topPlayerName = topEntry?.name ?? null;
    existing.hidden = false;
    existing.updatedAt = new Date().toISOString();
    savePyramidImage(existing.id, input.image);
    writePyramids(pyramids);
    return existing;
  }

  const owned = pyramids.filter((pyramid) => pyramid.userId === user.id);
  if (owned.length >= MAX_PYRAMIDS_PER_USER) {
    throw new CommunityError(
      `Limite atteinte : ${MAX_PYRAMIDS_PER_USER} pyramides publiées. Supprime-en une avant d'en publier une nouvelle.`,
      429,
    );
  }

  const now = new Date().toISOString();
  const pyramid: CommunityPyramid = {
    id: crypto.randomUUID(),
    userId: user.id,
    authorName: user.username,
    title,
    sport,
    sportLabel,
    controversy,
    controversyLabel,
    hotTakeName,
    filled,
    total,
    expertMode: input.expertMode === true,
    format,
    signature,
    topPlayerId: topEntry?.id ?? null,
    topPlayerName: topEntry?.name ?? null,
    players,
    voters: [],
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };

  savePyramidImage(pyramid.id, input.image);
  pyramids.push(pyramid);
  writePyramids(pyramids);
  return pyramid;
}

export function getPyramid(id: string): CommunityPyramid | undefined {
  return readPyramids().find((pyramid) => pyramid.id === id);
}

export interface ListPyramidsOptions {
  sport?: string | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
  userId?: string | null;
  includeHidden?: boolean;
  includePlayers?: boolean;
}

/** Liste publique (ou filtrée sur un auteur) des pyramides partagées. */
export function listPyramids(options: ListPyramidsOptions = {}): CommunityPyramid[] {
  const { sport, sort, userId, includeHidden = false } = options;
  const limit = Math.max(1, Math.min(60, options.limit ?? 24));
  const offset = Math.max(0, options.offset ?? 0);

  let items = readPyramids().filter((pyramid) => includeHidden || !pyramid.hidden);
  if (sport && /^[a-z0-9-]{2,24}$/.test(sport)) items = items.filter((pyramid) => pyramid.sport === sport);
  if (userId) items = items.filter((pyramid) => pyramid.userId === userId);

  items.sort((a, b) => {
    if (sort === "popular") {
      const diff = b.voters.length - a.voters.length;
      if (diff !== 0) return diff;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items.slice(offset, offset + limit);
}

export function countPyramids(): number {
  return readPyramids().filter((pyramid) => !pyramid.hidden).length;
}

/** Bascule le « j'aime » d'un votant (compte connecté ou visiteur anonyme). */
export function toggleLike(id: string, voterId: string): { pyramid: CommunityPyramid; liked: boolean } {
  const pyramids = readPyramids();
  const pyramid = pyramids.find((item) => item.id === id);
  if (!pyramid) throw new CommunityError("Pyramide introuvable.", 404);

  const index = pyramid.voters.indexOf(voterId);
  if (index >= 0) {
    pyramid.voters.splice(index, 1);
  } else {
    if (pyramid.voters.length >= MAX_VOTERS_PER_PYRAMID) {
      throw new CommunityError("Cette pyramide a atteint la limite de votes.", 429);
    }
    pyramid.voters.push(voterId);
  }

  writePyramids(pyramids);
  return { pyramid, liked: index < 0 };
}

/** Suppression de l'image haute définition d'une pyramide. */
function removePyramidImage(id: string): void {
  for (const extension of ["png", "jpg", "webp"]) {
    try {
      fs.unlinkSync(path.join(COMMUNITY_IMAGES_DIR, `${id}.${extension}`));
    } catch {
      /* fichier absent : rien à faire */
    }
  }
}

/** Chemin du fichier image d'une pyramide (l'extension est résolue à la volée). */
export function findPyramidImagePath(id: string): string | null {
  if (!/^[a-f0-9-]{10,40}$/i.test(id)) return null;
  for (const extension of ["png", "jpg", "webp"]) {
    const filePath = path.join(COMMUNITY_IMAGES_DIR, `${id}.${extension}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

/** Suppression d'une pyramide (par son auteur ou par l'administrateur). */
export function deletePyramid(id: string, requesterId?: string | null): CommunityPyramid {
  const pyramids = readPyramids();
  const index = pyramids.findIndex((pyramid) => pyramid.id === id);
  if (index === -1) throw new CommunityError("Pyramide introuvable.", 404);

  const removed = pyramids[index];
  if (requesterId && removed.userId !== requesterId) {
    throw new CommunityError("Tu ne peux supprimer que tes propres pyramides.", 403);
  }

  pyramids.splice(index, 1);
  writePyramids(pyramids);
  removePyramidImage(removed.id);
  return removed;
}

/** Masquage / réaffichage depuis la console d'administration. */
export function setPyramidHidden(id: string, hidden: boolean): CommunityPyramid {
  const pyramids = readPyramids();
  const pyramid = pyramids.find((item) => item.id === id);
  if (!pyramid) throw new CommunityError("Pyramide introuvable.", 404);
  pyramid.hidden = hidden;
  writePyramids(pyramids);
  return pyramid;
}

/* ------------------------------------------------------------------ */
/* Modération                                                          */
/* ------------------------------------------------------------------ */

/** Tous les comptes (console d'administration uniquement). */
export function listUsers(): CommunityUser[] {
  return readUsers();
}

/** Suspend ou réactive un compte. */
export function setUserBanned(id: string, banned: boolean): CommunityUser {
  const users = readUsers();
  const user = users.find((item) => item.id === id);
  if (!user) throw new CommunityError("Compte introuvable.", 404);
  user.banned = banned;
  writeUsers(users);
  return user;
}

/** Nombre de pyramides publiées par un compte (toutes visibilités). */
export function countPyramidsForUser(userId: string): number {
  return readPyramids().filter((pyramid) => pyramid.userId === userId).length;
}

/* ------------------------------------------------------------------ */
/* Garde-fous                                                          */
/* ------------------------------------------------------------------ */

/** Empêche le dépôt d'un faux PNG (vérifie la signature du fichier). */
export function isPngOrJpegFile(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true; // PNG
    return buffer[0] === 0xff && buffer[1] === 0xd8; // JPEG
  } catch {
    return false;
  }
}
