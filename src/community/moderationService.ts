/**
 * @file moderationService.ts
 * Client HTTP de la console de modération du Goat : pyramides publiées et comptes.
 */

export interface ModerationPyramid {
  id: string;
  title: string;
  authorName: string;
  userId: string;
  sport: string;
  sportLabel: string;
  controversy: number;
  likeCount: number;
  filled: number;
  total: number;
  hidden: boolean;
  createdAt: string;
  imageUrl: string;
}

export interface ModerationUser {
  id: string;
  username: string;
  createdAt: string;
  banned: boolean;
  pyramidCount: number;
}

export interface ModerationSession {
  authenticated: boolean;
  configured: boolean;
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchModerationSession(): Promise<ModerationSession> {
  const response = await fetch('/api/moderation/session', { headers: { Accept: 'application/json' } });
  return parseJson<ModerationSession>(response);
}

export async function loginModeration(password: string): Promise<void> {
  const response = await fetch('/api/moderation/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await parseJson<{ success: boolean }>(response);
}

export async function logoutModeration(): Promise<void> {
  const response = await fetch('/api/moderation/logout', { method: 'POST' });
  await parseJson<{ success: boolean }>(response);
}

export async function fetchModerationPyramids(): Promise<ModerationPyramid[]> {
  const response = await fetch('/api/moderation/pyramids', { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ pyramids: ModerationPyramid[] }>(response);
  return data.pyramids ?? [];
}

export async function setPyramidHiddenAdmin(id: string, hidden: boolean): Promise<void> {
  const response = await fetch(`/api/moderation/pyramids/${encodeURIComponent(id)}/hide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
  });
  await parseJson<{ success: boolean }>(response);
}

export async function deletePyramidAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/moderation/pyramids/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await parseJson<{ success: boolean }>(response);
}

export async function fetchModerationUsers(): Promise<ModerationUser[]> {
  const response = await fetch('/api/moderation/users', { headers: { Accept: 'application/json' } });
  const data = await parseJson<{ users: ModerationUser[] }>(response);
  return data.users ?? [];
}

export async function setUserBannedAdmin(id: string, banned: boolean): Promise<void> {
  const response = await fetch(`/api/moderation/users/${encodeURIComponent(id)}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banned }),
  });
  await parseJson<{ success: boolean }>(response);
}
