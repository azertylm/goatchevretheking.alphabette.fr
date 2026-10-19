/**
 * @file generate-sports-data.ts
 * Génère la base d'athlètes de Goat Chèvre The King, **une discipline par
 * fichier** dans `data/sports/` (football.json, swimming.json, tennis.json…).
 *
 * Usage :
 *   bun run generate:sports                 # les 30 disciplines (500 athlètes)
 *   bun run generate:sports -- --sport=f1   # une seule discipline
 *   bun run generate:sports -- --target=200 --min-links=30
 *
 * Méthode (le service SPARQL de Wikidata coupe à 60 s) :
 *   1. Découverte : identifiants + notoriété (nombre de versions linguistiques
 *      Wikipédia) des sportifs de la discipline, avec un seuil de notoriété
 *      **dégressif** jusqu'à réunir la cible.
 *   2. Détail par lots (VALUES) : nom français, photo Commons, code pays ISO
 *      (P27 → P297), année de naissance, années de carrière (P2031/P2032 et
 *      affiliations P54 avec qualificatifs), nombre de trophées (P166).
 *   3. Normalisation : `careerStart`/`careerEnd` toujours renseignés, détection
 *      des carrières en cours (`isCurrentlyCompeting`), marque « légende ».
 *   4. Écriture d'un JSON par discipline + `data/sports/index.json` (sommaire).
 *
 * Sources : Wikidata (CC0) et Wikimedia Commons (licences libres).
 */

import fs from 'fs';
import path from 'path';
import { SPORTS, type SportDefinition } from '../src/goat/sportsCatalog';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'sports');
const CURRENT_YEAR = new Date().getFullYear();
const USER_AGENT = 'AlphabetteGoatChevreTheKing/2.0 (https://alphabette.fr/goat; contact@alphabette.fr)';

/** Cible d'athlètes par discipline (contrat de données : 500). */
const DEFAULT_TARGET = 500;
/** Seuils de notoriété essayés successivement jusqu'à réunir la cible. */
const FAME_LADDER = [80, 40, 20, 10, 5, 2];
/** Taille des lots VALUES envoyés à Wikidata. */
const VALUES_BATCH = 250;

interface Binding {
  [key: string]: { value: string } | undefined;
}

interface AthleteProfile {
  id: string;
  name: string;
  countryCode: string;
  careerStart: number;
  careerEnd: number;
  imageUrl: string;
  trophiesCount: number;
  isLegend: boolean;
  isCurrentlyCompeting?: boolean;
  /** Carrière estimée (naissance + 18 ans) faute de données Wikidata. */
  careerEstimated?: boolean;
}

// --------------------------------------------------------------------------
// Arguments
// --------------------------------------------------------------------------

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const onlySport = readArg('sport');
const target = Number(readArg('target') ?? DEFAULT_TARGET) || DEFAULT_TARGET;
const forcedMinLinks = readArg('min-links') ? Number(readArg('min-links')) : null;

// --------------------------------------------------------------------------
// Accès Wikidata
// --------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sparql(query: string, attempt = 1): Promise<Binding[]> {
  try {
    const response = await fetch(SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (!response.ok) {
      const retryable = [429, 500, 502, 503, 504].includes(response.status);
      throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), {
        retryable,
        rateLimited: response.status === 429,
      });
    }

    const payload = (await response.json()) as { results?: { bindings?: Binding[] } };
    return payload.results?.bindings ?? [];
  } catch (err: any) {
    if (attempt >= 5 || err?.retryable === false) throw err;
    const delay = err?.rateLimited ? 15_000 * attempt : 2_000 * attempt;
    console.warn(`   ↳ ${err.message} — nouvelle tentative dans ${Math.round(delay / 1000)} s…`);
    await sleep(delay);
    return sparql(query, attempt + 1);
  }
}

/** Un lot qui échoue définitivement est signalé puis ignoré. */
async function sparqlSafe(query: string, label: string): Promise<Binding[]> {
  try {
    return await sparql(query);
  } catch (err: any) {
    console.warn(`   ⚠ lot ignoré (${label}) : ${err?.message}`);
    return [];
  }
}

const qidOf = (binding: Binding, key: string): string | null =>
  binding[key]?.value?.split('/').pop() ?? null;

const toYear = (value?: string): number | null => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 1850 && parsed <= CURRENT_YEAR + 1 ? parsed : null;
};

/** Photo Commons à la largeur demandée (vignette légère). */
function toThumbnail(filePathUrl: string, width = 320): string {
  const fileName = decodeURIComponent(filePathUrl.split('Special:FilePath/')[1] ?? '');
  if (!fileName) return '';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

// --------------------------------------------------------------------------
// 1. Découverte : qui pratique cette discipline, et à quel point est-ce connu ?
// --------------------------------------------------------------------------

/**
 * Découverte des sportifs d'une discipline.
 *
 * La photo (P18) est **exigée dès la découverte** : l'application affiche les
 * portraits en grand, un profil sans vignette n'est pas exploitable. Cela évite
 * aussi de dépenser des requêtes de détail sur des fiches condamnées (les
 * golfeurs, par exemple, n'ont une photo que dans 27 % des cas).
 */
const discoveryQuery = (sport: SportDefinition, minLinks: number, limit: number): string => `
SELECT DISTINCT ?person ?links WHERE {
  ?person wdt:P106 wd:${sport.wikidata} ;
          wdt:P18 ?photo ;
          wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
}
LIMIT ${limit}
`;

/** Découverte à un seuil de notoriété donné. */
async function discoverAt(
  sport: SportDefinition,
  minLinks: number,
  limit: number,
): Promise<Map<string, number>> {
  const bindings = await sparqlSafe(
    discoveryQuery(sport, minLinks, limit),
    `${sport.id} seuil ${minLinks}`,
  );
  const found = new Map<string, number>();

  for (const binding of bindings) {
    const qid = qidOf(binding, 'person');
    if (!qid) continue;
    found.set(qid, Number.parseInt(binding.links?.value ?? '0', 10) || 0);
  }

  console.log(`   · seuil notoriété ≥ ${minLinks} : ${found.size} candidats`);
  return found;
}

// --------------------------------------------------------------------------
// 2. Détail : nom, photo, pays, carrière, trophées
// --------------------------------------------------------------------------

const identityQuery = (qids: string[]): string => `
SELECT ?person ?name ?nameEn ?image ?code ?birthYear ?p2031Year ?p2032Year ?discipline ?event ?inTeam WHERE {
  VALUES ?person { ${qids.map((qid) => `wd:${qid}`).join(' ')} }
  OPTIONAL { ?person rdfs:label ?name . FILTER(LANG(?name) = "fr") }
  OPTIONAL { ?person rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?person wdt:P18 ?image }
  OPTIONAL { ?person wdt:P27 ?country . ?country wdt:P297 ?code }
  OPTIONAL { ?person wdt:P569 ?dob . BIND(YEAR(?dob) AS ?birthYear) }
  OPTIONAL { ?person wdt:P2031 ?p2031 . BIND(YEAR(?p2031) AS ?p2031Year) }
  OPTIONAL { ?person wdt:P2032 ?p2032 . BIND(YEAR(?p2032) AS ?p2032Year) }
  OPTIONAL { ?person wdt:P2416 ?discipline }
  OPTIONAL { ?person wdt:P54 ?teamMember . BIND(true AS ?inTeam) }
  # Preuve sportive : la compétition doit être une vraie compétition sportive.
  # Sans ce filtre, Élie Wiesel (forum économique mondial) passait pour footballeur.
  OPTIONAL {
    ?person wdt:P1344 ?event .
    ?event wdt:P31/wdt:P279* ?eventType .
    FILTER(?eventType IN (wd:Q13406554, wd:Q16510064))
  }
}
`;

const affiliationQuery = (qids: string[]): string => `
SELECT ?person ?teamStart ?teamEnd ?openStart WHERE {
  VALUES ?person { ${qids.map((qid) => `wd:${qid}`).join(' ')} }
  ?person p:P54 ?statement . ?statement ps:P54 ?team .
  OPTIONAL { ?statement pq:P580 ?startDate . BIND(YEAR(?startDate) AS ?teamStart) }
  OPTIONAL { ?statement pq:P582 ?endDate . BIND(YEAR(?endDate) AS ?teamEnd) }
  OPTIONAL {
    ?statement pq:P580 ?openDate .
    FILTER NOT EXISTS { ?statement pq:P582 ?closedDate }
    BIND(YEAR(?openDate) AS ?openStart)
  }
}
`;

const awardQuery = (qids: string[]): string => `
SELECT ?person ?award WHERE {
  VALUES ?person { ${qids.map((qid) => `wd:${qid}`).join(' ')} }
  ?person wdt:P166 ?award .
}
`;

interface Detail {
  name: string | null;
  image: string | null;
  countryCode: string | null;
  birthYear: number | null;
  teamStart: number | null;
  teamEnd: number | null;
  /** Dernière affiliation encore ouverte (aucune date de fin) : activité en cours. */
  openSince: number | null;
  careerStart: number | null;
  careerEnd: number | null;
  awards: number;
  /** Notoriété : nombre de versions linguistiques Wikipédia. */
  fame: number;
  /**
   * Preuve d'activité sportive réelle : discipline déclarée (P2416) ou
   * compétition disputée (P1344). Sert à écarter les personnalités seulement
   * « accessoirement » sportives (Albert Camus ou Sean Connery figurent comme
   * footballeurs sur Wikidata).
   */
  sportSignal: boolean;
}

async function fetchDetails(qids: string[], sink?: Map<string, Detail>): Promise<Map<string, Detail>> {
  const details = sink ?? new Map<string, Detail>();

  const ensure = (qid: string): Detail =>
    details.get(qid) ?? {
      name: null,
      image: null,
      countryCode: null,
      birthYear: null,
      teamStart: null,
      teamEnd: null,
      openSince: null,
      careerStart: null,
      careerEnd: null,
      awards: 0,
      fame: 0,
      sportSignal: false,
    };

  for (let index = 0; index < qids.length; index += VALUES_BATCH) {
    const batch = qids.slice(index, index + VALUES_BATCH);
    const tag = `${index}/${qids.length}`;

    // Trois requêtes simples plutôt qu'une agrégation : Blazegraph (Wikidata)
    // échoue en erreur 500 sur MIN/MAX portant sur des années converties.
    const [identities, affiliations, awards] = await Promise.all([
      sparqlSafe(identityQuery(batch), `identité ${tag}`),
      sparqlSafe(affiliationQuery(batch), `affiliations ${tag}`),
      sparqlSafe(awardQuery(batch), `trophées ${tag}`),
    ]);

    for (const binding of identities) {
      const qid = qidOf(binding, 'person');
      if (!qid) continue;

      const entry = ensure(qid);
      // Libellé français quand il existe, sinon le libellé anglais : la plupart
      // des sportifs sans page française ont tout de même une page anglaise.
      const rawName = binding.name?.value?.trim() ?? binding.nameEn?.value?.trim();
      // Un libellé manquant arrive sous forme d'identifiant : on l'écarte.
      const usableName = rawName && !/^Q\d+$/.test(rawName) ? rawName : null;
      const image = binding.image?.value;

      entry.name ??= usableName;
      entry.image ??= image ? toThumbnail(image) : null;
      entry.countryCode ??= binding.code?.value?.toUpperCase() ?? null;
      entry.birthYear ??= toYear(binding.birthYear?.value);
      entry.careerStart ??= toYear(binding.p2031Year?.value);
      entry.careerEnd ??= toYear(binding.p2032Year?.value);
      if (binding.discipline || binding.event || binding.inTeam) entry.sportSignal = true;
      details.set(qid, entry);
    }

    for (const binding of affiliations) {
      const qid = qidOf(binding, 'person');
      if (!qid) continue;

      const entry = ensure(qid);
      const start = toYear(binding.teamStart?.value);
      const end = toYear(binding.teamEnd?.value);
      const open = toYear(binding.openStart?.value);
      if (start !== null) entry.teamStart = Math.min(entry.teamStart ?? start, start);
      if (end !== null) entry.teamEnd = Math.max(entry.teamEnd ?? end, end);
      if (open !== null) entry.openSince = Math.max(entry.openSince ?? open, open);
      details.set(qid, entry);
    }

    for (const binding of awards) {
      const qid = qidOf(binding, 'person');
      if (!qid) continue;

      const entry = ensure(qid);
      entry.awards += 1;
      details.set(qid, entry);
    }

    console.log(`   · détail ${Math.min(index + batch.length, qids.length)}/${qids.length}`);
    await sleep(400);
  }

  return details;
}

// --------------------------------------------------------------------------
// 3. Normalisation d'un profil
// --------------------------------------------------------------------------

/**
 * Construit un profil exploitable par l'application.
 *
 * Règles de carrière (documentées, car Wikidata est incomplet) :
 *  - début : P2031, sinon première affiliation P54, sinon naissance + 18 ans ;
 *  - fin   : P2032, sinon dernière affiliation P54 ;
 *  - sans fin connue et né il y a moins de 40 ans → carrière en cours
 *    (`isCurrentlyCompeting`), fin = année courante ;
 *  - sans fin connue et né il y a 40 ans ou plus → fin estimée à début + 15 ans.
 */
function buildProfile(qid: string, detail: Detail, requireSportProof = true): AthleteProfile | null {
  const name = detail.name;
  const imageUrl = detail.image;
  if (!name || !imageUrl) return null;

  // Contrôle qualité sportif : sans discipline déclarée (P2416) *ni* compétition
  // disputée (P1344) *ni* équipe (P54), la personne n'est pas retenue — Wikidata
  // classe par exemple Albert Camus et Sean Connery comme footballeurs. Les
  // disciplines trop maigres (golf, snowboard…) complètent leur effectif avec
  // `requireSportProof = false` : les profils sont alors marqués « estimés ».
  const hasSportProof =
    detail.sportSignal || detail.teamStart !== null || detail.teamEnd !== null;
  if (requireSportProof && !hasSportProof) return null;

  const birthYear = detail.birthYear;
  const careerEstimated = detail.careerStart === null && detail.teamStart === null;
  const start = detail.careerStart ?? detail.teamStart ?? (birthYear ? birthYear + 18 : null);
  if (!start) return null;

  let end = detail.careerEnd ?? detail.teamEnd;
  let isCurrentlyCompeting = false;

  // Une affiliation sans date de fin signe une carrière encore ouverte.
  if (detail.openSince !== null && detail.openSince >= CURRENT_YEAR - 2) {
    isCurrentlyCompeting = true;
  }

  if (end === null) {
    const age = birthYear ? CURRENT_YEAR - birthYear : null;
    if (age !== null && age >= 40 && !isCurrentlyCompeting) {
      end = start + 15;
    } else {
      end = CURRENT_YEAR;
      isCurrentlyCompeting = true;
    }
  } else if (end >= CURRENT_YEAR - 1) {
    // Fin déclarée à l'année courante (ou l'an dernier) : toujours en activité.
    isCurrentlyCompeting = true;
    end = Math.max(end, CURRENT_YEAR - 1);
  }

  if (isCurrentlyCompeting) end = Math.max(end, CURRENT_YEAR);
  if (end < start) end = start;
  if (start > CURRENT_YEAR) return null;

  const trophiesCount = Math.max(detail.awards, 0);
  const countryCode = (detail.countryCode ?? 'XX').slice(0, 2);

  return {
    id: qid,
    name,
    countryCode,
    careerStart: start,
    careerEnd: end,
    imageUrl,
    trophiesCount,
    // « Légende » : palmarès fourni **ou** notoriété internationale très large.
    // Seuils volontairement hauts pour rester un marqueur rare (≈ 5-10 %).
    isLegend: trophiesCount >= 8 || detail.fame >= 80,
    ...(isCurrentlyCompeting ? { isCurrentlyCompeting: true } : {}),
    ...(careerEstimated ? { careerEstimated: true } : {}),
  };
}

// --------------------------------------------------------------------------
// 4. Pipeline d'une discipline
// --------------------------------------------------------------------------

async function collectSport(sport: SportDefinition): Promise<AthleteProfile[]> {
  console.log(`\n→ ${sport.emoji} ${sport.label} (${sport.id})`);

  const limit = Math.max(target * 8, 2000);
  const ladder = forcedMinLinks !== null ? [forcedMinLinks, 1] : FAME_LADDER;
  const detailed = new Set<string>();
  const accepted = new Set<string>();
  // Les fiches détaillées sont accumulées : elles resservent à la passe de
  // complément, qui réexamine les mêmes personnes avec un critère plus souple.
  const details = new Map<string, Detail>();
  const athletes: AthleteProfile[] = [];

  // On descend les seuils de notoriété jusqu'à réunir la cible : une
  // discipline discrète (tir à l'arc, snowboard…) doit pouvoir la remplir
  // sans jamais sacrifier les profils les plus connus, déjà pris en premier.
  for (const minLinks of ladder) {
    if (athletes.length >= target) break;

    const candidates = await discoverAt(sport, minLinks, limit);
    const ranked = [...candidates.entries()].sort((a, b) => b[1] - a[1]);

    // On détaille avec une marge confortable : beaucoup de profils seront
    // écartés faute de photo ou de carrière exploitable.
    const fresh = ranked
      .map(([qid]) => qid)
      .filter((qid) => !detailed.has(qid))
      .slice(0, Math.max(target * 2, 400));
    for (const qid of fresh) detailed.add(qid);
    if (fresh.length > 0) await fetchDetails(fresh, details);

    // Les profils sont pris dans l'ordre de notoriété, toutes tranches
    // confondues : le fichier final reste décroissant en notoriété.
    for (const [qid, fame] of ranked) {
      if (accepted.has(qid)) continue;
      const detail = details.get(qid);
      if (!detail) continue;
      detail.fame = Math.max(detail.fame, fame);
      const profile = buildProfile(qid, detail);
      if (!profile) continue;
      athletes.push(profile);
      accepted.add(qid);
      if (athletes.length >= target) break;
    }
  }

  // Complément : certaines disciplines (voile, snowboard, sports équestres…)
  // n'ont pas assez de profils « prouvés » pour atteindre la cible. On réutilise
  // alors les fiches déjà récupérées **et** on détaille les sportifs restants,
  // avec un critère plus souple : la carrière est estimée à partir de la
  // naissance et signalée comme telle (`careerEstimated`).
  if (athletes.length < target) {
    console.log(`   · complément : ${target - athletes.length} profils à trouver`);

    const candidates = await discoverAt(sport, 1, limit);
    const ranked = [...candidates.entries()].sort((a, b) => b[1] - a[1]);

    const fresh = ranked
      .map(([qid]) => qid)
      .filter((qid) => !detailed.has(qid))
      .slice(0, Math.max(target * 2, 600));
    for (const qid of fresh) detailed.add(qid);
    if (fresh.length > 0) await fetchDetails(fresh, details);

    for (const [qid, fame] of ranked) {
      if (accepted.has(qid)) continue;
      const detail = details.get(qid);
      if (!detail) continue;
      detail.fame = Math.max(detail.fame, fame);
      const profile = buildProfile(qid, detail, false);
      if (!profile) continue;
      athletes.push(profile);
      accepted.add(qid);
      if (athletes.length >= target) break;
    }
  }

  console.log(`   ✓ ${athletes.length} profils retenus (cible ${target})`);
  return athletes;
}

function writeSportFile(sport: SportDefinition, athletes: AthleteProfile[]): void {
  const payload = {
    sport: sport.id,
    label: sport.label,
    generatedAt: new Date().toISOString(),
    source: 'Wikidata SPARQL (https://query.wikidata.org/sparql) + Wikimedia Commons',
    license:
      'Données Wikidata : CC0. Photos : Wikimedia Commons, licences libres — crédit obligatoire selon la licence de chaque fichier.',
    count: athletes.length,
    athletes,
  };

  const file = path.join(OUTPUT_DIR, `${sport.id}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload)}\n`, 'utf-8');
}

/**
 * Réécrit `data/sports/index.json` en fusionnant les effectifs connus.
 * Appelé après **chaque** discipline : l'application peut afficher les
 * effectifs pendant une génération longue, sans attendre la fin des 30 sports.
 */
function writeIndex(known: Map<string, { sport: string; label: string; count: number }>): number {
  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  const total = [...known.values()].reduce((sum, entry) => sum + entry.count, 0);

  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetPerSport: target,
        totalAthletes: total,
        sports: SPORTS.map(
          (sport) => known.get(sport.id) ?? { sport: sport.id, label: sport.label, count: 0 },
        ),
      },
      null,
      2,
    )}\n`,
    'utf-8',
  );

  return total;
}

async function main(): Promise<void> {
  console.log('🐐 Goat Chèvre The King — génération des bases par discipline');
  console.log(`   cible : ${target} athlètes · ${onlySport ? `discipline ${onlySport}` : `${SPORTS.length} disciplines`}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const selected = onlySport ? SPORTS.filter((sport) => sport.id === onlySport) : SPORTS;
  if (selected.length === 0) {
    console.error(`❌ Discipline inconnue : ${onlySport}`);
    process.exit(1);
  }

  // Sommaire existant : une génération partielle ne doit pas effacer les
  // effectifs déjà connus des autres disciplines.
  const indexPath = path.join(OUTPUT_DIR, 'index.json');
  const previous = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, 'utf-8').replace(/^\uFEFF/, '')) as {
        sports?: Array<{ sport: string; label: string; count: number }>;
      })
    : { sports: [] };
  const known = new Map((previous.sports ?? []).map((entry) => [entry.sport, entry]));

  const summary: Array<{ sport: string; label: string; count: number }> = [];

  for (const sport of selected) {
    const athletes = await collectSport(sport);
    const entry = { sport: sport.id, label: sport.label, count: athletes.length };

    if (athletes.length > 0) writeSportFile(sport, athletes);
    summary.push(entry);
    known.set(sport.id, entry);
    writeIndex(known);

    if (athletes.length > 0 && athletes.length < target) {
      console.warn(`   ⚠ ${sport.id} : ${athletes.length}/${target} (relancer avec --sport=${sport.id})`);
    }

    await sleep(800);
  }

  const total = writeIndex(known);

  console.log('\n✅ Génération terminée');
  for (const entry of summary) {
    console.log(`   ${entry.sport.padEnd(16)} ${String(entry.count).padStart(4)} athlètes`);
  }
  console.log(`   total (sommaire) : ${total}`);
}

main().catch((err) => {
  console.error("❌ Échec de la génération :", err);
  process.exit(1);
});
