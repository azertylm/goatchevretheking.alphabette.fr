/**
 * @file prune-blocked-athletes.ts
 * Purge les personnalités de la liste d'exclusion (`data/sports/blocklist.json`)
 * des fichiers de discipline **déjà générés**, puis met à jour le sommaire.
 *
 * Usage : bun run prune:athletes
 *
 * La purge est déterministe et purement soustractive : elle ne récupère aucune
 * donnée, elle ne peut donc pas introduire de profil indésirable. Pour revenir
 * à 500 athlètes par discipline, relancer ensuite `bun run generate:sports`
 * (le générateur applique lui aussi la liste d'exclusion).
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'sports');

interface BlocklistEntry {
  id: string;
  nom?: string;
  sports?: string[];
  raison?: string;
}

interface Athlete {
  id: string;
  name: string;
}

interface SportFile {
  sport: string;
  label: string;
  count: number;
  athletes: Athlete[];
  [key: string]: unknown;
}

interface SportIndex {
  generatedAt?: string;
  targetPerSport?: number;
  totalAthletes?: number;
  sports?: Array<{ sport: string; label: string; count: number }>;
  [key: string]: unknown;
}

function loadBlocklist(): Map<string, Set<string>> {
  const file = path.join(OUTPUT_DIR, 'blocklist.json');
  const blocked = new Map<string, Set<string>>();
  if (!fs.existsSync(file)) return blocked;

  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '')) as {
    exclus?: BlocklistEntry[];
  };
  for (const entry of parsed.exclus ?? []) {
    if (!entry?.id) continue;
    blocked.set(entry.id, new Set(entry.sports ?? []));
  }
  return blocked;
}

const readJson = <T,>(file: string): T =>
  JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '')) as T;

const blocked = loadBlocklist();
if (blocked.size === 0) {
  console.log("Aucune entrée dans la liste d'exclusion — rien à purger.");
  process.exit(0);
}

const files = fs
  .readdirSync(OUTPUT_DIR)
  .filter((name) => name.endsWith('.json') && name !== 'index.json' && name !== 'blocklist.json');

const counts = new Map<string, number>();
const rapport: Array<{ sport: string; avant: number; apres: number; retires: string[] }> = [];
let totalRemoved = 0;

for (const file of files) {
  const full = path.join(OUTPUT_DIR, file);
  const data = readJson<SportFile>(full);
  const sport = data.sport ?? file.replace(/\.json$/, '');
  const athletes = data.athletes ?? [];

  const kept: Athlete[] = [];
  const removed: string[] = [];
  for (const athlete of athletes) {
    const sports = blocked.get(athlete.id);
    const concerne = sports !== undefined && (sports.size === 0 || sports.has(sport));
    if (concerne) removed.push(`${athlete.name} (${athlete.id})`);
    else kept.push(athlete);
  }

  counts.set(sport, kept.length);
  if (removed.length === 0) continue;

  data.athletes = kept;
  data.count = kept.length;
  fs.writeFileSync(full, `${JSON.stringify(data)}\n`, 'utf-8');

  totalRemoved += removed.length;
  rapport.push({ sport, avant: athletes.length, apres: kept.length, retires: removed });
}

const indexPath = path.join(OUTPUT_DIR, 'index.json');
if (fs.existsSync(indexPath)) {
  const index = readJson<SportIndex>(indexPath);
  for (const entry of index.sports ?? []) {
    const count = counts.get(entry.sport);
    if (count !== undefined) entry.count = count;
  }
  index.totalAthletes = [...counts.values()].reduce((sum, count) => sum + count, 0);
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

console.log(`🧹 Purge des personnalités hors sport — ${totalRemoved} profil(s) retiré(s)`);
for (const ligne of rapport) {
  console.log(`\n${ligne.sport} : ${ligne.avant} → ${ligne.apres}`);
  for (const nom of ligne.retires) console.log(`   − ${nom}`);
}
if (totalRemoved === 0) console.log('   (aucun profil de la liste ne figurait dans les bases)');
