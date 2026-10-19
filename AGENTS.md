# AGENTS.md — Goat Chèvre The King

Application de l'écosystème **alphabette.fr**, dans son **propre dépôt**.

## Règle — ne pas recoder l'en-tête

L'application utilise la **base commune** `@alphabette/shell` (barre écosystème
+ en-tête d'application). Ne pas recréer ces barres à la main : elles enveloppent
l'application dans `src/main.tsx` (`<AppShell app={APP}>`).

- Identité du site : `src/alphabette.app.ts` (nom, sous-titre, couleur, liens).
- Couleur d'identité : `accent: '#f59e0b'` (ambre). Toute la base s'y adapte.

## Structure

| Chemin | Rôle |
|---|---|
| `src/goat/` | L'application : pyramide, duels, controverse, partage, photos |
| `src/community/` | Comptes, publication, galerie et console de modération |
| `server/` | API joueurs, proxy photos, comptes, galerie, modération |
| `data/players.json` | Base des 400 joueurs (générée, versionnée) |

## Vérifier avant de rendre

```powershell
bun run lint    # types
bun run build   # build de production
```

## Liens de l'écosystème

- Vitrine : <https://alphabette.fr>
- Le hub est la source de vérité des tarifs (`/api/config.json`) : 15 €/app/an,
  40 €/écosystème/an, 7 jours d'essai.
