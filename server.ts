import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createGoatPlayersRouter } from "./server/goatPlayers";
import { createGoatPhotosRouter } from "./server/goatPhotos";
import { createCommunityRouter, ensureCommunityStorage } from "./server/communityRoutes";

/**
 * @file server.ts
 * Serveur de Goat Chèvre The King (goatchevretheking.alphabette.fr).
 *
 * Trois rôles :
 *  - servir l'application React (Vite en développement, `dist/` en production) ;
 *  - exposer la base des 400 joueurs (data/players.json) ;
 *  - relayer les photos Wikimedia et gérer les comptes + la galerie communautaire.
 */

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // --- COMMUNAUTÉ (avant le parser JSON global : les images publiées pèsent plusieurs Mo) ---
  ensureCommunityStorage();
  app.use("/api/community", createCommunityRouter());

  // Middleware JSON
  app.use(express.json());

  // --- API ---

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      app: "goatchevretheking.alphabette.fr",
      time: new Date().toISOString(),
    });
  });

  // Base des joueurs de Goat Chèvre The King (data/players.json)
  app.use("/api/goat", createGoatPlayersRouter());

  // Proxy des photos (Wikimedia) : indispensable pour que le canvas de partage reste exploitable
  app.use("/api/goat", createGoatPhotosRouter());

  // --- FRONT-END ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GOAT] Goat Chèvre The King démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Échec critique du démarrage du serveur:", err);
  process.exit(1);
});
