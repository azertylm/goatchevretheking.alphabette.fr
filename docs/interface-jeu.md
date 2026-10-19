# Interface de jeu — barre, pyramides, album et sons

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
