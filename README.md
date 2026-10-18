# 🐐 Goat Chèvre The King

> Elisez votre goat votre chèvre ou votre Roi.

**Adresse : <https://goatchevretheking.alphabette.fr>**

Le classement GOAT le plus sérieux (et le moins sérieux) du web. Constituez votre
pyramide de légendes du **Football International** ou de la **NBA**, confrontez-les
en **duels express**, découvrez votre **score de non-conformisme**, et partagez
votre pyramide en image prête pour Instagram (Story 9:16 ou carré 1:1) avec QR code.

## Ce que fait l'application

- **400 joueurs** (200 football / 200 NBA) issus de Wikidata, avec photos libres
  et années de carrière
- **Pyramide** 1 / 2 / 4 / 8 (+ étage 5 de 16 en « Mode Expert »), réservistes avec
  recherche par nom et filtre par époque, **Mode Chaos 🎲**
- **Hot Take 🔥** : un favori mis en avant dans le partage
- **10 duels rapides** → score de non-conformisme face au classement de référence
- **Partage viral** : image HD (Story ou carré) avec le titre, les photos, le Hot Take,
  le pourcentage de controverse et un QR code vers l'application
- **Galerie communautaire** (`/communaute`) : création de compte, publication,
  votes — accessible à tous
- **Cadrage photo personnalisable** par joueur (image entière par défaut)

## Démarrer en local

```powershell
bun install
Copy-Item .env.example .env      # puis renseigner COMMUNITY_SESSION_SECRET
bun run dev
```

→ <http://localhost:3000>

## Commandes

| Commande | Rôle |
|---|---|
| `bun run dev` | serveur de développement (Vite + API) |
| `bun run build` | build de production (`dist/` + `dist/server.cjs`) |
| `bun run start` | lance le build de production |
| `bun run lint` | vérification TypeScript |
| `bun run fetch:players` | régénère `data/players.json` depuis Wikidata |

## Structure

```
src/goat/          l'application : pyramide, duels, controverse, partage, photos
src/community/     comptes, publication et galerie communautaire
server/            API des joueurs, proxy photos, comptes et galerie
data/players.json  base des 400 joueurs (générée, versionnée)
scripts/           pipeline Wikidata (fetch-players)
```

## Variable d'environnement

| Variable | Rôle |
|---|---|
| `COMMUNITY_SESSION_SECRET` | signature des sessions communauté — **obligatoire pour que les comptes survivent à un redémarrage** |
| `PORT` | port d'écoute (3000 par défaut) |

## Liens

- Vitrine de l'écosystème : <https://alphabette.fr>
- Dépôt du projet : <https://github.com/azertylm/goatchevretheking.alphabette.fr>

## Licence

Apache License 2.0 — voir [LICENSE](LICENSE).
