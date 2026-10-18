import { Router, type Request, type Response } from "express";
import {
  CommunityError,
  countPyramidsForUser,
  deletePyramid,
  listPyramids,
  listUsers,
  setPyramidHidden,
  setUserBanned,
} from "./communityStore";
import {
  MODERATION_COOKIE_NAME,
  attemptLogin,
  createSessionToken,
  isAuthenticated,
  isModerationConfigured,
  requireModerator,
  sessionCookieOptions,
} from "./moderationAuth";

/**
 * @file moderationRoutes.ts
 * Modération de la galerie communautaire, montée sur /api/moderation.
 *
 * La galerie est publique : n'importe qui peut publier. Cette console permet de
 * masquer une pyramide, de la supprimer définitivement, et de suspendre un compte.
 * Elle est protégée par MODERATION_PASSWORD (cookie de session signé).
 */

function handleError(res: Response, err: unknown): void {
  if (err instanceof CommunityError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[MODERATION_API]", err);
  res.status(500).json({ error: "Erreur interne de la modération." });
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ? value.split(",")[0] : req.ip) || "unknown";
}

export function createModerationRouter(): Router {
  const router = Router();

  // --- Authentification ---

  router.get("/session", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      authenticated: isAuthenticated(req),
      configured: isModerationConfigured(),
    });
  });

  router.post("/login", (req: Request, res: Response) => {
    const result = attemptLogin(clientIp(req), req.body?.password);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error, authenticated: false });
      return;
    }
    res.cookie(MODERATION_COOKIE_NAME, createSessionToken(), sessionCookieOptions(req));
    res.json({ authenticated: true, success: true });
  });

  router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie(MODERATION_COOKIE_NAME, { ...sessionCookieOptions(req), maxAge: undefined });
    res.json({ authenticated: false, success: true });
  });

  // --- Pyramides publiées ---

  /** Liste complète des pyramides (masquées comprises). */
  router.get("/pyramids", requireModerator, (req: Request, res: Response) => {
    try {
      const items = listPyramids({
        includeHidden: true,
        sort: typeof req.query.sort === "string" ? req.query.sort : "recent",
        sport: typeof req.query.sport === "string" ? req.query.sport : null,
        limit: Number(req.query.limit) || 60,
        offset: Number(req.query.offset) || 0,
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({
        pyramids: items.map((pyramid) => ({
          id: pyramid.id,
          title: pyramid.title,
          authorName: pyramid.authorName,
          userId: pyramid.userId,
          sport: pyramid.sport,
          sportLabel: pyramid.sportLabel,
          controversy: pyramid.controversy,
          likeCount: pyramid.voters.length,
          filled: pyramid.filled,
          total: pyramid.total,
          hidden: pyramid.hidden,
          createdAt: pyramid.createdAt,
          imageUrl: `/api/community/images/${pyramid.id}?v=${encodeURIComponent(pyramid.updatedAt)}`,
        })),
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** Masque / réaffiche une pyramide dans la galerie publique. */
  router.post("/pyramids/:id/hide", requireModerator, (req: Request, res: Response) => {
    try {
      const hidden = req.body?.hidden !== false;
      const pyramid = setPyramidHidden(req.params.id, hidden);
      res.json({ success: true, id: pyramid.id, hidden: pyramid.hidden });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** Suppression définitive d'une pyramide. */
  router.delete("/pyramids/:id", requireModerator, (req: Request, res: Response) => {
    try {
      deletePyramid(req.params.id, null);
      res.json({ success: true });
    } catch (err) {
      handleError(res, err);
    }
  });

  // --- Comptes ---

  /** Comptes de la communauté (avec le nombre de pyramides publiées). */
  router.get("/users", requireModerator, (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({
        users: listUsers().map((user) => ({
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
          banned: user.banned,
          pyramidCount: countPyramidsForUser(user.id),
        })),
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  /** Suspend / réactive un compte. */
  router.post("/users/:id/ban", requireModerator, (req: Request, res: Response) => {
    try {
      const banned = req.body?.banned !== false;
      const user = setUserBanned(req.params.id, banned);
      res.json({ success: true, id: user.id, banned: user.banned });
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}
