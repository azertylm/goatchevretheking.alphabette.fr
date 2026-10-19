/**
 * @file athleteTypes.ts
 * Modèle des bases d'athlètes, une discipline par fichier (`data/sports/*.json`).
 *
 * Ces profils sont produits par `scripts/generate-sports-data.ts` (Wikidata) et
 * chargés à la demande par `sportsDataProvider.ts`.
 */

import type { SportId } from './sportsCatalog';

export interface AthleteProfile {
  /** Identifiant Wikidata (Q…), stable et unique. */
  id: string;
  name: string;
  /** Code pays ISO 3166-1 alpha-2 (« FR », « BR »…), « XX » si inconnu. */
  countryCode: string;
  /** Première année de carrière (toujours renseignée). */
  careerStart: number;
  /** Dernière année de carrière (année courante si la carrière est en cours). */
  careerEnd: number;
  imageUrl: string;
  /** Nombre de trophées / distinctions recensés (P166). */
  trophiesCount: number;
  /** Marque « légende » (palmarès exceptionnel ou notoriété internationale). */
  isLegend: boolean;
  /** Pastille « En compétition » : carrière encore ouverte. */
  isCurrentlyCompeting?: boolean;
  /**
   * Carrière estimée : Wikidata ne fournit ni début (P2031) ni affiliation
   * datée. Les bornes sont déduites de la naissance (+18 ans). Ces profils ne
   * servent qu'à compléter les disciplines à faible couverture (voile,
   * snowboard, sports équestres…).
   */
  careerEstimated?: boolean;
}

export interface SportDataset {
  sport: SportId;
  label: string;
  generatedAt: string;
  source: string;
  license: string;
  count: number;
  athletes: AthleteProfile[];
}

export interface SportIndexEntry {
  sport: SportId;
  label: string;
  count: number;
}

export interface SportsIndex {
  generatedAt: string;
  targetPerSport: number;
  totalAthletes: number;
  sports: SportIndexEntry[];
}
