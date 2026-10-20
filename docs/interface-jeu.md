# Interface de jeu — barre, pyramides, album, sons et modes de jeu

Ce document décrit les briques d'interface ajoutées autour des 30 disciplines.
Les données elles-mêmes sont décrites dans [`donnees-sports.md`](./donnees-sports.md).

## 1. Barre de disciplines (`src/goat/SportCategoryBar.tsx`)

En tête de l'application, au-dessus de la scène principale :

- **ruban horizontal** des 30 disciplines : icône, nom court et **badge d'état** de
  la pyramide du sport :
  - `Pyramide 100 % complète` (toutes les cases visibles remplies),
  - `3 / 15 cases` (classement commencé),
  - `500 joueurs` (effectif de la base, aucun joueur placé),
  - `À découvrir` (base absente) ;
- **recherche unique** qui filtre *en même temps* les disciplines du ruban et les
  joueurs de la discipline active ; le compteur de résultats est affiché dans la
  barre et repris par la réserve ;
- flèches de défilement (desktop), navigation clavier `←`/`→`, et recentrage
  automatique de la discipline active (le défilement de la page n'est pas touché) ;
- **interrupteur de sons** (`goat_sound_v1`), actif par défaut.

L'état des pyramides est lu directement dans `localStorage` via
`readPyramidProgress()` et rafraîchi par un petit magasin observable
(`subscribePyramidStore` / `pyramidStoreRevision`), donc les badges restent
exacts même quand le placement vient d'un autre composant (duel, chaos…).

## 2. Une pyramide par discipline (`src/goat/pyramidModel.ts`, `usePyramidState.ts`)

| Élément | Valeur |
|---|---|
| Clé de stockage | `goat_pyramid_<sportId>` (ex. `goat_pyramid_football`) |
| Anciennes clés | `goat_pyramid_v3_<sport>`, `goat_pyramid_v2_<sport>` — migrées automatiquement à la première lecture |
| Contenu | `{ assignments, hotTake, expertMode }` |

Changer de discipline charge la pyramide correspondante : les autres classements
ne sont jamais écrasés. Discipline et pyramide sont stockées dans **un seul état**
(`{ sport, pyramid }`), ce qui rend impossible la sauvegarde d'un sport sous la
clé d'un autre pendant la transition.

## 3. Album Panini virtuel (`src/goat/usePaniniAlbum.ts`)

- Chaque vignette **cliquée, placée sur la pyramide ou votée** (Duels Express)
  rejoint la collection de la discipline ; les identifiants sont conservés dans
  `localStorage` sous `goat_panini_v1` (au plus 2 000 par discipline).
- Le tiroir affiche `Collection <sport> : X / 500 vignettes découvertes` avec une
  jauge de progression, et un ✓ discret sur les vignettes déjà collectionnées.
- Le magasin est observable (`useSyncExternalStore`) et synchronisé entre onglets.

## 4. Sons contextuels (`src/goat/pastureAudio.ts`)

Tout est synthétisé à la volée (aucun fichier, aucun réseau) :

| Événement | Son |
|---|---|
| Changement de discipline | **sifflet d'arbitre** (~2,4 kHz, trille FM 36 Hz, 340 ms) |
| Carte placée sur une case | **rebond** (sinus 240 → 70 Hz + clic de bruit filtré, ~130 ms) |
| Carte placée sur la case du GOAT ultime | **clochette royale** (3 frappes : fondamentale, quinte, octave) |
| Bouton « Bêler » | bêlement caprin (déjà existant) |

Deux sons identiques à moins de 110 ms d'intervalle sont ignorés (anti-saturation
quand un duel pré-remplit plusieurs cases). L'`AudioContext` reste créé au premier
geste utilisateur : aucun son ne part au chargement.

## 5. Vignettes (`PlayerAvatar.tsx`, `PlayerCard.tsx`, `fallbackAvatar.ts`)

- format **carte sportive 3:4** avec bordure fine et fondu d'apparition
  (aucun décalage de mise en page) ;
- `loading="lazy"` + `decoding="async"` : sur 500 vignettes, seules celles à
  l'écran sont téléchargées ;
- toute erreur d'image bascule **définitivement** sur la vignette dessinée
  (initiales + couleur de la discipline + drapeau du pays), l'URL fautive étant
  mémorisée pour ne pas être retentée ;
- pastille verte pulsante « En compétition » sur les carrières en cours ;
- la réserve ne rend que **40 vignettes à la fois** (défilement infini par blocs),
  le DOM ne contient donc jamais les 500 cartes.

## 6. Les jeux du pâturage (`GameHub.tsx`)

Menu de jeu à cinq onglets, monté dans `PyramidStage` (ancre
`#jeux-du-paturage`) et accessible depuis le bouton **Jeux** de la barre de
disciplines. Un seul mode est monté à la fois ; changer de mode ou de discipline
remet la partie à zéro.

| Mode | Fichier | Mécanique | Gains | Record affiché |
|---|---|---|---|---|
| **Défi Chrono** | `GameChrono.tsx` | 60 s de face-à-face A/B ; +1 point par duel, la série multiplie (×2 dès 3 duels d'affilée, ×5 à 12) ; « Passer » remet la série à zéro | +1 Crottin par point | duels votés en 60 s |
| **Duels d'époques** | `GameEraDuels.tsx` | 8 duels entre le tiers le plus ancien et le tiers le plus récent de la discipline (les plus prestigieux de chaque extrémité) ; après le vote : palmarès, écart d'années, rang standard, verdict | 1 Crottin par duel + 2 par vote conforme | votes conformes (sur 8) |
| **Duel du jour** | `GameDailyDuel.tsx` | un duel par discipline et par jour, tiré de `discipline:jour` — **le même pour tous les visiteurs** ; vote unique, série de jours, rappel du duel de la veille | +5 Crottins | série de jours |
| **Trouve le GOAT** | `GameQuiz.tsx` | 10 joueurs mystère ; trois indices (décennie, pays, palmarès) et six vignettes **sans années** ; 3 / 2 / 1 points selon l'indice utilisé | +1 Crottin par point | points (sur 30) |
| **Bouc Émissaire** | `GameScapegoat.tsx` | 8 manches de 5 vignettes ; désigner le maillon faible (le moins titré, à égalité la carrière la plus courte) ; rangs révélés après le vote | +3 Crottins par bonne réponse | maillons trouvés (sur 8) |

**Classement standard.** Les bases par discipline ne publient pas la notoriété
Wikipédia : `sportsDataProvider.ts` renseigne `fame` avec `trophiesCount`. Le
classement de référence des jeux (`standardScore`) combine donc **trophées
recensés**, marque « légende », puis longévité de carrière, afin d'obtenir un
ordre total et stable (des centaines de carrières n'ont aucun trophée recensé).
L'interface parle de **« classement standard (palmarès recensé) »** et jamais de
notoriété.

**Persistance.** Clé dédiée `goat_games_v1`, distincte de `goat_pyramid_*`, de
`goat_progression_v1` et de `goat_panini_v1` :

```
{ best: { "chrono:football": { score, at } }, plays: { chrono: 1 },
  streak: { count, best, lastDay },
  dailyVotes: { "2026-10-19:football": { day, sport, choiceId } },
  history: [ { mode, sport, score, at } ] }   // 30 dernières parties
```

**Déterminisme.** `hashString` (FNV-1a) + `mulberry32` : le Duel du jour se
recalcule à l'identique hors ligne, à la date et à la discipline près — d'où le
rappel du duel de la veille sans stockage supplémentaire.

**Sans backend.** Le pourcentage du Duel du jour est un **pronostic du
classement standard**, annoncé comme tel (« aucun vote n'est envoyé
aujourd'hui »). Brancher des votes réels ne demande que de relayer
`registerDailyVote` vers une route du hub.

**Récompenses et album.** Les gains passent par `addCrottins` (raisons `chrono`,
`epoques`, `jour`, `quiz`, `bouc`) ; chaque affrontement ou manche inscrit les
joueurs rencontrés dans l'album Panini (`discoverVignettes`). Les sons du
chrono, du quiz et du bouc réutilisent `pastureAudio` (anti-saturation 110 ms).

## 7. Viralité, exports et vitrine

### 7.1 Liens de défi sans serveur (`challenge.ts`)

Tout l'état utile voyage dans l'URL, encodé en **base64url** (JSON compact) :

| Paramètre | Contenu | Écran |
|---|---|---|
| `?p=…` | pyramide complète (discipline, cases, Hot Take, mode expert, pseudo) | bandeau « Défi reçu » au-dessus de la pyramide |
| `?d=…` | un duel (deux identifiants, choix de l'auteur, pseudo) | bandeau violet en tête des jeux du pâturage |

- **Riposter** (`?p=`) : `usePyramidState.adopt()` remplace la pyramide de la
  discipline par celle du lien, après confirmation explicite. Seuls les
  identifiants présents dans la base locale sont repris.
- **Duel reçu** (`?d=`) : les deux cartes sont affichées, le vote est comparé au
  choix de l'auteur (« même choix » / « pas d'accord »), et le duel peut être
  retransmis tel quel.
- Les paramètres sont retirés de l'URL (`history.replaceState`) dès que le défi
  est adopté, ignoré ou fermé. Les liens utilisent `window.location.origin`, donc
  fonctionnent aussi en aperçu local.

### 7.2 Exports (`SharePanel.tsx`, `shareImage.ts`, `redditExport.ts`)

| Export | Taille | Contenu |
|---|---|---|
| Story | 1080 × 1920 | pyramide, Hot Take, controverse, QR |
| Carré | 1080 × 1080 | idem, format réseaux |
| Affiche A4 | 2480 × 3508 | story encadrée sur papier crème + palmarès + QR (imprimable 300 dpi) |
| Carte du GOAT | 1080 × 1920 | vignette 3:4 du GOAT ultime, rang au classement standard, QR |
| Texte Reddit | Markdown | étages, Hot Take, controverse, lien de contestation (`buildRedditMarkdown`, copie ou `.md`) |

Le bouton **Partager…** utilise `navigator.share` avec le fichier PNG et le lien
de contestation ; sans partage natif (ou sans `canShare({ files })`), le lien est
copié dans le presse-papiers. Aucune image n'est envoyée à un serveur.

### 7.3 Vitrine (`ViralPanel.tsx`, `collector.ts`)

Section `#ma-vitrine`, montée après le partage dans `PyramidStage` :

- **Succès** — dix objectifs (`achievements.ts`, clé `goat_achievements_v1`),
  débloqués une fois pour toutes, avec barres de progression et notifications
  (`AchievementToasts.tsx`). Définitions : premier duel, 20 duels au chrono,
  24 points au quiz, 8 maillons faibles, 7 votes conformes, série de 7 jours,
  100 vignettes, une pyramide complète, 500 Crottins, 5 disciplines jouées.
- **Badges de décennies** — `decadeBadges()` croise la pyramide active et les
  débuts de carrière : bronze dès 1 joueur, or à partir de 3, sur 1930 → 2020.
- **Tableau d'honneur** — `honorBoard()` : les trois meilleurs records de
  l'utilisateur par mode, toutes disciplines (les scores d'un même mode sont
  comparables).
- **Bilan** — parties, disciplines, pyramides finies, places posées, vignettes,
  meilleure série de jours.
- **Boutique** — trois cadres cosmétiques (`cosmetics.ts`, clé
  `goat_cosmetics_v1`) : or (30 🪙), croûte fleurie (60), néon (100). L'achat
  dépense des Crottins **dépensables** (`spendCrottins`) sans toucher au score
  cumulé ni au rang. Le cadre actif est appliqué globalement via
  `body[data-goat-frame]` (aucune souscription par carte).
- **Historique** — les six dernières parties (`history`), avec « Rejouer » qui
  ouvre le mode correspondant.
- **Installation** — `beforeinstallprompt` capturé : bouton « Installer
  maintenant » quand le navigateur le propose.

### 7.4 Confort de jeu

- **Raccourcis clavier** (`useGameKeys.ts`) : `←`/`A` et `→`/`D` pour voter,
  `S` pour passer (chrono), `1–6` pour les vignettes (quiz, Bouc Émissaire),
  `Entrée` pour enchaîner. Les champs de saisie et les combinaisons
  Ctrl/Alt/Meta sont ignorés. Rappel affiché sous le menu de jeu.
- **Surprise** — le bouton 🎲 de la barre de disciplines tire une discipline et
  un mode au hasard (`playRequest.ts`, demande mémorisée au niveau du module :
  elle survit au démontage du menu pendant le chargement de la base).
- **Flamme de série** — l'en-tête affiche la série de jours du Duel du jour dès
  qu'elle est non nulle.
- **Mascotte** (`MascotBuddy.tsx`) — chèvre flottante : clic = réplique + bêlement,
  raccourcis vers « Surprise », la vitrine et le bêlement. Elle ne s'ouvre jamais
  toute seule.

### 7.5 Application installable

`public/manifest.webmanifest`, `public/icon.svg`, `public/icon-maskable.svg` et
`public/sw.js` (enregistré **en production seulement**, `src/main.tsx`).
Le service worker sert le réseau d'abord pour les navigations et les JSON de
données (classements frais), le cache d'abord pour les assets construits, et
ignore `/api/*`. Après la première visite, le pâturage reste jouable hors-ligne.

### 7.6 Clés de stockage

| Clé | Contenu |
|---|---|
| `goat_games_v1` | records, parties, série, votes du jour, historique |
| `goat_achievements_v1` | succès débloqués (identifiant → date) |
| `goat_cosmetics_v1` | cadres possédés + cadre actif |
| `goat_pyramid_<sport>` | une pyramide par discipline |
| `goat_progression_v1` | Crottins dépensables + score cumulé |
| `goat_panini_v1` | vignettes découvertes |

