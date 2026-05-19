# Duel Tactique

> Jeu de stratégie au tour par tour pour 2 joueurs — généré automatiquement par un pipeline multi-agent LangGraph + Claude Sonnet.

---

## Jouer

```bash
# Aucune installation requise
open index.html   # macOS
# ou double-cliquez sur index.html dans votre explorateur de fichiers
```

Le jeu tourne entièrement dans le navigateur, sans serveur ni dépendance externe.

---

## Concept

**Duel Tactique** oppose deux joueurs sur un plateau quadrillé. Chaque camp commande une armée asymétrique — Généraux, Soldats, Chevaliers, Tours — et gère un pool de **Points d'Action** pour déplacer ses unités, capturer celles de l'adversaire et contrôler des zones stratégiques. **Capturer le Général ennemi** met fin à la partie.

Les mécaniques clés : déplacement sur grille, capture par contact, zones de contrôle, gestion de ressources (PA) et asymétrie tactique entre les types d'unités.

---

## Architecture — Pipeline multi-agent

Ce projet est le produit d'un pipeline **LangGraph** orchestrant 5 agents spécialisés **Claude Sonnet** en séquence :

```
Designer ──► Developer ──► Asset Generator ──► Tester ──► Documentalist
```

| Agent | Responsabilité |
|---|---|
| **Designer** | Conception du concept, règles et mécaniques de jeu |
| **Developer** | Génération du code (`index.html`, `style.css`, `game.js`) |
| **Asset Generator** | Création des assets SVG (plateau, unités, tokens) |
| **Tester** | Validation fonctionnelle et détection d'anomalies |
| **Documentalist** | Rédaction des règles (`rules.md`) et du README |

Chaque agent reçoit le contexte produit par le précédent — aucune intervention humaine dans la boucle de génération.

---

## Stack

- **LangGraph** — orchestration du pipeline multi-agent
- **Claude Sonnet (Anthropic)** — modèle de langage pour chaque agent
- **HTML5 / CSS3 / JavaScript** — runtime du jeu (vanilla, zéro dépendance)
- **SVG** — assets graphiques générés programmatiquement

---

## Structure des fichiers

```
duel-tactique/
├── index.html
├── style.css
├── game.js
├── rules.md
└── assets/
    ├── board.svg
    ├── general_blue.svg      ├── general_red.svg
    ├── soldier_blue.svg      ├── soldier_red.svg
    ├── knight_blue.svg       ├── knight_red.svg
    ├── tower_blue.svg        ├── tower_red.svg
    ├── action_point_token.svg
    ├── turn_indicator_blue.svg
    └── turn_indicator_red.svg
```

---

## Statut

| Critère | Résultat |
|---|---|
| Validation pipeline | ✅ Validé |
| Dépendances externes | ✅ Aucune |
| Compatibilité navigateur | Chrome, Firefox, Safari, Edge |

---

## Reproductibilité

Ce dépôt illustre la capacité du pipeline à produire un jeu jouable et documenté à partir d'un prompt de 10 mots :  
> *« un jeu de stratégie simple pour 2 joueurs »*

Pour régénérer un jeu depuis un nouveau concept, relancer le pipeline LangGraph avec votre propre prompt comme seed.

---

*Généré par [Board Game Generator](../README.md) — architecture multi-agent LangGraph + Claude Sonnet.*