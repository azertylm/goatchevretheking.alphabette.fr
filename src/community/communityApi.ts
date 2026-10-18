/**
 * @file communityApi.ts
 * Client HTTP de la communauté « Goat Chèvre The King »
 * (comptes, publication de pyramides, galerie et votes).
 */

export interface CommunityUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface CommunityPlayerEntry {
  slot: string;
  id: string;
  name: string;
  career: string;
  image?: string;
}

export interface CommunityPyramid {
  id: string;
  title: string;
  authorName: string;
  userId: string;
  sport: string;
  sportLabel: string;
  controversy: number;
  controversyLabel: string;
  hotTakeName: string | null;
  filled: number;
  total: number;
  expertMode: boolean;
  format: string;
  topPlayerId: string | null;
  topPlayerName: string | null;
  players: CommunityPlayerEntry[];
  likeCount: number;
  liked: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: string }).error || `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

/** Compte connecté (null si visiteur). */
export async function fetchCommunitySession(): Promise<CommunityUser | null> {
  const response = await fetch('/api/community/me', { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ authenticated: boolean; user: CommunityUser | null }>(response);
  return data.user ?? null;
}

export async function registerCommunity(username: string, password: string): Promise<CommunityUser> {
  const response = await fetch('/api/community/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJson<{ user: CommunityUser }>(response);
  return data.user;
}

export async function loginCommunity(username: string, password: string): Promise<CommunityUser> {
  const response = await fetch('/api/community/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJson<{ user: CommunityUser }>(response);
  return data.user;
}

export async function logoutCommunity(): Promise<void> {
  await fetch('/api/community/logout', { method: 'POST' });
}

export interface PublishPyramidInput {
  title: string;
  sport: string;
  sportLabel: string;
  controversy: number;
  controversyLabel: string;
  hotTakeName: string | null;
  filled: number;
  total: number;
  expertMode: boolean;
  format: string;
  players: CommunityPlayerEntry[];
  image: string;
}

export async function publishCommunityPyramid(input: PublishPyramidInput): Promise<CommunityPyramid> {
  const response = await fetch('/api/community/pyramids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ pyramid: CommunityPyramid }>(response);
  return data.pyramid;
}

export interface GalleryQuery {
  sport?: string | null;
  sort?: 'recent' | 'popular';
  limit?: number;
  offset?: number;
  author?: 'me';
}

export async function fetchCommunityPyramids(query: GalleryQuery = {}): Promise<CommunityPyramid[]> {
  const params = new URLSearchParams();
  if (query.sport) params.set('sport', query.sport);
  if (query.sort) params.set('sort', query.sort);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  if (query.author) params.set('author', query.author);

  const response = await fetch(`/api/community/pyramids?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await parseJson<{ pyramids: CommunityPyramid[] }>(response);
  return data.pyramids ?? [];
}

export async function fetchCommunityPyramid(id: string): Promise<CommunityPyramid> {
  const response = await fetch(`/api/community/pyramids/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await parseJson<{ pyramid: CommunityPyramid }>(response);
  return data.pyramid;
}

export async function toggleCommunityLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
  const response = await fetch(`/api/community/pyramids/${encodeURIComponent(id)}/like`, { method: 'POST' });
  return parseJson<{ liked: boolean; likeCount: number }>(response);
}

export async function deleteCommunityPyramid(id: string): Promise<void> {
  const response = await fetch(`/api/community/pyramids/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await parseJson<{ success: boolean }>(response);
}

/** Conversion d'un Blob image en data URL (utilisable côté serveur). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(blob);
  });
}

/** Lien public d'une pyramide partagée. */
export function pyramidLink(id: string): string {
  return `https://goatchevretheking.alphabette.fr/communaute?p=${id}`;
}
