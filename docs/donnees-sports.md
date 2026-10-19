# Données sportives — 30 disciplines × 500 athlètes

Goat Chèvre The King ne se limite plus au football et à la NBA : l'application
sait afficher **30 disciplines**, chacune avec sa propre base d'athlètes.

## 1. Une discipline = un fichier

```
data/sports/
  index.json          ← sommaire (effectifs, total, date de génération)
  football.json
  nba.json
  swimming.json
  table-tennis.json
  …
```

Chaque fichier contient au maximum **500 profils** :

```json
{
  "sport": "football",
  "label": "Football International",
  "count": 500,
  "athletes": [
    {
      "id": "Q615",
      "name": "Lionel Messi",
      "countryCode": "AR",
      "careerStart": 2004,
      "careerEnd": 2026,
      "imageUrl": "https://commons.wikimedia.org/…",
      "trophiesCount": 12,
      "isLegend": true,
      "isCurrentlyCompeting": true
    }
  ]
}
```

| Champ | Rôle |
|---|---|
| `id` | identifiant Wikidata (Q…), stable |
| `countryCode` | ISO 3166-1 alpha-2, `XX` si inconnu |
| `careerStart` / `careerEnd` | bornes de carrière, **toujours renseignées** |
| `imageUrl` | vignette Wikimedia Commons (320 px) |
| `trophiesCount` | nombre de distinctions Wikidata (P166) |
| `isLegend` | palmarès exceptionnel ou notoriété internationale |
| `isCurrentlyCompeting` | carrière encore ouverte (pastille « En compétition ») |
| `careerEstimated` | carrière déduite de la naissance (pas de données Wikidata) |

## 2. Génération

```powershell
bun run generate:sports                      # 30 disciplines × 500
bun run generate:sports -- --sport=f1        # une seule discipline
bun run generate:sports -- --target=200      # cible réduite (tests)
bun run generate:sports -- --min-links=40    # force un seuil de notoriété
```

Le script `scripts/generate-sports-data.ts` interroge **Wikidata (SPARQL)** :

1. **Découverte** — sportifs de la discipline (P106) **disposant d'une photo**
   (P18), avec un seuil de notoriété (nombre de versions linguistiques
   Wikipédia) **dégressif** jusqu'à réunir la cible : 80 → 40 → 20 → 10 → 5 → 2.
2. **Détail par lots de 250** — libellé français (repli anglais), photo (P18),
   pays (P27 → P297), naissance (P569), carrière (P2031/P2032 + affiliations P54
   avec dates), trophées (P166), discipline pratiquée (P2416), compétitions
   (P1344) et appartenance à une équipe (P54).
3. **Normalisation** — les champs manquants sont estimés selon des règles
   documentées dans le script (voir ci-dessous), jamais inventés au hasard.
4. **Écriture** — un JSON par discipline + `index.json`.

> Les requêtes d'agrégation (`MIN`/`MAX` sur des années converties) font échouer
> Blazegraph (erreur 500) : le script envoie trois requêtes simples et agrège
> côté JavaScript. Ne pas « optimiser » ce point sans revalider.

### Règles d'estimation

- début de carrière : P2031, sinon première affiliation de club, sinon naissance + 18 ans ;
- fin : P2032, sinon dernière affiliation ;
- sans fin connue et né il y a moins de 40 ans → **carrière en cours** ;
- sans fin connue et né il y a 40 ans ou plus → fin estimée à début + 15 ans.

Les profils sans nom ou sans photo sont écartés (l'application affiche la photo
en grand : une vignette manquante casserait la carte).

### Contrôle qualité sportif

Wikidata classe des personnalités **seulement accessoirement** sportives dans
nos disciplines : Albert Camus et Sean Connery y figurent comme footballeurs, et
Élie Wiesel est tagué « footballeur » parce qu'il a participé… au forum
économique mondial. Un profil n'est donc conservé que s'il présente **au moins
une preuve d'activité sportive** :

- une **discipline** pratiquée déclarée (P2416), ou
- une **équipe** (P54, « membre d'une équipe sportive »), ou
- une **compétition réellement sportive** : P1344 dont la cible est une instance
  (directe ou indirecte) de *sports competition* (Q13406554) ou *sporting event*
  (Q16510064). C'est ce dernier point qui écarte Élie Wiesel ou Gianni Infantino :
  leurs « compétitions » sont des conférences économiques.

Sans ces trois preuves, la fiche passe dans le **complément** (ci-dessous) et sa
carrière est marquée comme estimée.

### Liste d'exclusion curatorée (`data/sports/blocklist.json`)

Le contrôle précédent laisse passer une seconde famille d'intrus : des
personnalités dont la notoriété vient d'ailleurs et que Wikidata dote malgré tout
d'une licence dans la discipline — Niels Bohr footballeur à l'Akademisk
Boldklub, Viktor Orbán joueur amateur, Michael Crichton, Nick Nolte, George
Floyd, Bud Spencer, Vera Wang…

**Aucun filtre automatique n'est fiable ici.** La propriété « champ
d'activité » (P101) écarterait à tort Niki Lauda (champ d'activité déclaré :
« management sportif ») ; la propriété « œuvre notable » (P800) écarterait à tort
Dick Fosbury (le Fosbury-flop), Milkha Singh (son autobiographie) ou Charles
Barkley (*Space Jam*). L'exclusion est donc **curatée à la main**, dans un
fichier transparent et modifiable :

```json
{ "id": "Q7085", "nom": "Niels Bohr", "sports": ["football"], "raison": "…" }
```

- `sports` absent ⇒ exclusion de **toutes** les disciplines ;
- le critère est écrit dans le fichier : notoriété publique **principalement
  extra-sportive** *et* pratique **anecdotique** de la discipline ;
- les champions devenus scientifiques, politiques ou écrivains après leur
  carrière sont **conservés** (Ketevan Losaberidze, Alfréd Hajós, Jacques Ochs,
  Benjamin Spock, Caldwell Esselstyn, Hermann von Oppeln-Bronikowski…) ;
- les cas limites retenus (Dirk Stikker et Hans Riegel, vainqueurs de titres
  réels en badminton) sont listés dans le champ
  `_conserves_notoriete_extra_sportive` du fichier.

Le filtre est appliqué **à la génération** (`isBlocked()` dans
`scripts/generate-sports-data.ts`) **et à la purge** des fichiers existants :

```powershell
bun run prune:athletes                       # retire les profils déjà générés
bun run generate:sports -- --sport=football  # recomplète ensuite à 500
```

Pour réintégrer une personnalité : supprimer sa ligne du fichier et relancer la
génération de la discipline concernée.

### Complément des disciplines à faible couverture

Une discipline très peu documentée sur Wikidata (voile, snowboard, sports
équestres, tir à l'arc…) ne réunit pas 500 profils « prouvés ». Le script
descend alors les seuils de notoriété (80 → 40 → 20 → 10 → 5 → 2), puis
complète avec les sportifs restants dont Wikidata n'indique ni début de carrière
ni équipe : leur carrière est **estimée** (naissance + 18 ans) et le profil
porte `careerEstimated: true`. Ils sont ajoutés en fin de fichier, après les
profils documentés.

## 3. Chargement dans l'application

`src/goat/sportsDataProvider.ts`

```ts
const dataset = await loadSportData('swimming'); // import() d'un seul chunk
```

- les 30 fichiers sont découpés par Vite en **autant de modules séparés** ;
- `import()` ne charge en mémoire que la discipline demandée (≈ 100 Ko) ;
- repli HTTP `/api/goat/sports/:sport` si les données ont été régénérées après
  le build ;
- `toGoatPlayer()` adapte le profil au modèle historique (`image`, `career`,
  `startYear`…) : les composants existants n'ont pas été réécrits.

## 4. Filtre décennal glissant

`src/goat/decadeFilters.ts`

```ts
generateDecadeWindows(1920, 2025);
// 1920–1930, 1925–1935, …, 2010–2020, 2015–2025

isPlayerInWindow(player, 1995, 2005); // chevauchement de carrière
```

Une carrière 1988–2002 apparaît donc dans **1995–2005** et **2000–2010**, mais
aussi dans **1985–1995** : chaque fenêtre retient tout joueur dont la carrière la
chevauche, et les fenêtres se recouvrent, par pas de 5 ans.

Le filtre géographique (`matchesGeo`) restreint au pays de référence
(`FR` par défaut) quand on bascule sur « National / Régional ».

## 5. Réserve des joueurs

`src/goat/ReserveDrawer.tsx` affiche le ruban `DecadeSelector` (époques +
bascule géographique) au-dessus de la grille.

**Les filtres ne touchent que la liste affichée** : l'état de la pyramide
(placements, Hot Take, mode expert) n'est jamais modifié par un changement de
filtre. Un joueur déjà placé reste sur la pyramide même s'il sort du filtre.

## 6. Couverture réelle des disciplines

Effectifs vérifiés dans `data/sports/` (table générée par
`coverage-table.mjs`, à relancer après toute régénération) :

| Discipline | Athlètes | Carrières estimées |
|---|---:|---:|
| Badminton | 500 | 491 (98 %) |
| Sports équestres | 500 | 489 (98 %) |
| Formule 1 | 500 | 420 (84 %) |
| Football International | 500 | 0 (0 %) |
| Gymnastique | 500 | 484 (97 %) |
| Handball | 500 | 329 (66 %) |
| Judo | 500 | 469 (94 %) |
| Aviron | 500 | 490 (98 %) |
| Voile | 500 | 482 (96 %) |
| Patinage de vitesse | 500 | 448 (90 %) |
| Tennis | 500 | 18 (4 %) |
| Volley-ball | 500 | 260 (52 %) |
| Haltérophilie | 500 | 481 (96 %) |
| Lutte | 500 | 422 (84 %) |
| Ski alpin | 499 | 484 (97 %) |
| Boxe | 499 | 423 (85 %) |
| Cricket | 499 | 38 (8 %) |
| Cyclisme | 499 | 66 (13 %) |
| Escrime | 499 | 488 (98 %) |
| Patinage artistique | 499 | 463 (93 %) |
| Golf | 499 | 433 (87 %) |
| Basketball NBA | 499 | 12 (2 %) |
| Tir sportif | 499 | 486 (97 %) |
| Tennis de table | 499 | 435 (87 %) |
| Athlétisme | 498 | 341 (68 %) |
| Hockey sur glace | 498 | 385 (77 %) |
| Rugby | 498 | 68 (14 %) |
| Natation | 498 | 473 (95 %) |
| Snowboard | 374 | 371 (99 %) |
| Tir à l'arc | 341 | 334 (98 %) |

**Total : 14 697 profils · 72 % de carrières estimées · 14 disciplines à 500.**

Trois raisons expliquent les disciplines sous la barre des 500 :

1. **Plafond Wikidata** — le snowboard (374) et le tir à l'arc (341) n'ont pas
   500 personnes à la fois classées dans la discipline (P106), dotées d'une photo
   (P18) et d'un nom exploitable. Inutile de relancer la génération : elle
   redonnera les mêmes effectifs.
2. **Curation** — les disciplines touchées par la liste d'exclusion perdent de 1
   à 6 profils. Football, Sports équestres, Voile et NBA ont été recomplétés à
   500 (NBA à 499 après retrait d'un intrus apparu dans le lot de recomplètement,
   Arik Einstein) :
   ```powershell
   bun run generate:sports -- --sport=football
   ```
   Le générateur reprend alors les candidats suivants par notoriété, **en
   appliquant la liste d'exclusion**. Attention : la fin du classement de
   notoriété contient encore du bruit (un intrus tous les ~500 profils dans nos
   essais) — relancer `probe-intruders.mjs` après un recomplètement.
3. **Carrières estimées** — Wikidata ne date ni le début ni la fin de carrière
   des sportifs individuels ; le générateur se rabat sur la naissance + 18 ans
   (`careerEstimated: true`). Le taux atteint 98 % pour le badminton ou
   l'escrime, mais tombe à 0–4 % pour le football, la NBA et le tennis, dont les
   affiliations de club (P54) sont bien documentées. Le taux est affiché dans la
   réserve quand des profils estimés sont présents.
