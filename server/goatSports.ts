import fs from 'fs';
import path from 'path';
import { Router, type Request, type Response } from 'express';

/**
 * @file goatSports.ts
 * Sert les bases d'athlètes par discipline (`data/sports/<discipline>.json`),
 * produites par `bun run generate:sports`.
 *
 *   GET /api/goat/sports        → sommaire (effectifs par discipline)
 *   GET /api/goat/sports/:sport → base complète d'une discipline
 *
 * Le client charge normalement ces fichiers via `import()` (un chunk par
 * discipline). Cette route sert de repli quand les données ont été régénérées
 * après le build, et de source pour les outils.
 */

interface CacheEntry {
  mtimeMs: number;
  payload: unknown;
}

const cache = new Map<string, CacheEntry>();

const sportsDir = () => path.join(process.cwd(), 'data', 'sports');

/** Seuls des identifiants simples sont acceptés (pas de traversée de chemin). */
const SAFE_ID = /^[a-z0-9-]+$/i;

function readJsonFile(filePath: string): unknown {
  const stat = fs.statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.payload;

  // Un éditeur Windows peut ajouter un BOM : on le retire avant de parser.
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
  cache.set(filePath, { mtimeMs: stat.mtimeMs, payload });
  return payload;
}

export function createGoatSportsRouter(): Router {
  const router = Router();

  router.get('/sports', (_req: Request, res: Response) => {
    const indexPath = path.join(sportsDir(), 'index.json');
    try {
      res.json(readJsonFile(indexPath));
    } catch {
      res.status(404).json({ error: 'Sommaire des disciplines indisponible.', sports: [] });
    }
  });

  router.get('/sports/:sport', (req: Request, res: Response) => {
    const { sport } = req.params;
    if (!SAFE_ID.test(sport)) {
      res.status(400).json({ error: 'Identifiant de discipline invalide.' });
      return;
    }

    const filePath = path.join(sportsDir(), `${sport}.json`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Aucune base pour la discipline « ${sport} ».` });
      return;
    }

    try {
      // Le dossier contient aussi des fichiers de service (`blocklist.json`) :
      // seuls les documents porteurs d'une liste `athletes` sont des bases.
      const payload = readJsonFile(filePath) as { athletes?: unknown };
      if (!Array.isArray(payload?.athletes)) {
        res.status(404).json({ error: `Aucune base pour la discipline « ${sport} ».` });
        return;
      }
      res.json(payload);
    } catch {
      res.status(500).json({ error: `Base de « ${sport} » illisible.` });
    }
  });

  return router;
}
