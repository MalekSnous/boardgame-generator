# Morpion Duel

> Jeu de morpion 2 joueurs généré automatiquement par un pipeline multi-agent **LangGraph + Claude Sonnet**.

---

## Jouer

```bash
# Aucune installation requise
open index.html
```

Ouvrez simplement `index.html` dans votre navigateur. Le jeu est entièrement client-side.

---

## À propos du jeu

**Morpion Duel** est un classique revisité : deux joueurs s'affrontent sur une grille 3×3 et tentent d'aligner trois de leurs symboles (X ou O) en horizontal, vertical ou diagonal.

| Propriété | Valeur |
|---|---|
| Joueurs | 2 |
| Durée | 2–5 min |
| Objectif | Aligner 3 symboles avant l'adversaire |

**Mécaniques implémentées**
- Placement de symbole au tour par tour avec alternance stricte
- Détection automatique des alignements gagnants (8 combinaisons)
- Reconnaissance du match nul si la grille est pleine sans vainqueur
- Bouton de rejeu pour une nouvelle partie instantanée

---

## Architecture multi-agent

Ce projet est une démonstration concrète d'un pipeline **LangGraph** orchestrant 5 agents **Claude Sonnet** spécialisés, chacun responsable d'une étape de la chaîne de production :

```
Concept utilisateur
       │
       ▼
 [1] Designer          →  Règles, mécaniques, expérience joueur
       │
       ▼
 [2] Developer         →  Code HTML / CSS / JS fonctionnel
       │
       ▼
 [3] Asset Generator   →  Visuels SVG (plateau, symboles, banners)
       │
       ▼
 [4] Tester            →  Validation logique et cohérence du jeu
       │
       ▼
 [5] Documentalist     →  Règles joueur (rules.md) + README
       │
       ▼
  Jeu livrable ✅
```

Chaque agent reçoit le contexte produit par le précédent et enrichit le livrable — sans intervention humaine entre les étapes.

---

## Stack

| Couche | Technologie |
|---|---|
| Orchestration agents | LangGraph |
| Modèle LLM | Claude Sonnet (Anthropic) |
| Frontend | HTML5 / CSS3 / JavaScript vanilla |
| Assets | SVG généré programmatiquement |
| Runtime | Navigateur (zero dépendance) |

---

## Structure des fichiers

```
morpion-duel/
├── index.html                  # Point d'entrée du jeu
├── style.css                   # Styles et mise en page
├── game.js                     # Logique de jeu complète
├── rules.md                    # Règles lisibles par le joueur
└── assets/
    ├── board.svg               # Plateau de jeu
    ├── symbol_x.svg            # Symbole joueur 1
    ├── symbol_o.svg            # Symbole joueur 2
    ├── indicator_player1.svg   # Indicateur de tour J1
    ├── indicator_player2.svg   # Indicateur de tour J2
    ├── banner_win.svg          # Bannière victoire
    ├── banner_draw.svg         # Bannière match nul
    └── button_replay.svg       # Bouton rejouer
```

---

## Statut

**Validation pipeline : ✅ Validé** — aucune erreur détectée par l'agent Tester.

---

## Contexte de génération

Ce jeu a été produit à partir du concept : *« un jeu de morpion pour 2 joueurs »*.  
Il illustre la capacité du pipeline à transformer une intention en produit jouable complet — code, assets et documentation inclus — de façon entièrement automatisée.