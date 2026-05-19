# 🎲 Dés du Destin

> Jeu de dés coopératif généré automatiquement par un pipeline multi-agent LangGraph + Claude Sonnet.

---

## Jouer en 30 secondes

```bash
# Aucune installation requise
open index.html   # macOS
# ou double-cliquez sur index.html dans votre explorateur de fichiers
```

---

## Concept

**Dés du Destin** est un jeu coopératif pour **2 à 4 joueurs**. Les joueurs combinent leurs résultats de dés pour repousser des tuiles menace avant que la jauge de crise n'atteigne **10**. Chaque face de dé déclenche des effets spéciaux ; la coordination et la programmation d'actions collectives sont la clé de la survie.

---

## Architecture multi-agent

Ce projet est une démonstration technique d'un **pipeline LangGraph orchestrant 5 agents Claude Sonnet** en séquence. Chaque agent est spécialisé et passe sa sortie au suivant :

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌────────────┐     ┌──────────────┐
│  Designer   │ ──▶ │  Developer  │ ──▶ │ Asset Generator  │ ──▶ │   Tester   │ ──▶ │ Documentalist│
│             │     │             │     │                  │     │            │     │              │
│ Règles &    │     │ HTML/CSS/JS │     │ SVG (plateau,    │     │ Validation │     │ rules.md &   │
│ mécaniques  │     │ du moteur   │     │ dés, jauge…)     │     │ & rapport  │     │ README       │
└─────────────┘     └─────────────┘     └──────────────────┘     └────────────┘     └──────────────┘
```

Cette architecture illustre la **décomposition de tâches créatives complexes** en agents autonomes et chaînables — un pattern directement applicable à des workflows de production IA.

---

## Stack

| Couche | Technologie |
|---|---|
| Orchestration | LangGraph (graph d'agents stateful) |
| Modèles | Claude Sonnet (Anthropic) |
| Frontend | HTML5 / CSS3 / JavaScript vanilla |
| Assets | SVG généré programmatiquement |
| Exécution | Navigateur — zéro dépendance |

---

## Structure des fichiers

```
dés-du-destin/
├── index.html
├── style.css
├── game.js
├── rules.md
└── assets/
    ├── board_main.svg
    ├── board_player_red.svg
    ├── board_player_blue.svg
    ├── board_player_green.svg
    ├── board_player_yellow.svg
    ├── crisis_gauge.svg
    ├── crisis_cursor.svg
    ├── die_red_face1.svg
    ├── die_red_face2.svg
    ├── die_red_face3.svg
    ├── die_red_face4.svg
    └── die_red_face5.svg
```

---

## ⚠️ Limitations connues

Ce build est issu d'une génération automatique et présente des bugs identifiés par l'agent Tester :

| Sévérité | Description |
|---|---|
| 🔴 Bloquant | `renderGame()` appelée dans `render()` mais non définie — le jeu ne passe pas la phase `setup` |
| 🔴 Bloquant | Aucun event listener sur les boutons de sélection du nombre de joueurs — `initGame()` n'est jamais appelée |
| 🟠 Erreur | `numPlayers` utilisée dans `revealThreat()` sans déclaration locale (`gameState.numPlayers` attendu) |
| 🟡 Logique | `checkVictoryCondition()` ne détecte pas la victoire lorsque la pioche est vide et toutes les menaces neutralisées |

> Ces limitations documentent fidèlement les capacités et marges de progression actuelles du pipeline — elles font partie intégrante de la démonstration.

---

## Contribuer

Les corrections de bugs sont bienvenues. Le point d'entrée naturel est `game.js`. Les règles complètes sont dans [`rules.md`](./rules.md).

---

*Généré par un pipeline LangGraph · Agent Documentalist · Claude Sonnet*