# Île Maudite

> Jeu de survie coopératif généré automatiquement par un pipeline multi-agent LangGraph + Claude Sonnet.

![Statut](https://img.shields.io/badge/statut-validé%20avec%20avertissements-yellow) ![Joueurs](https://img.shields.io/badge/joueurs-2–4-blue) ![Généré par IA](https://img.shields.io/badge/généré%20par-LangGraph%20%2B%20Claude-blueviolet)

---

## À propos

**Île Maudite** est un jeu de plateau coopératif pour 2 à 4 joueurs. Chaque explorateur — Chasseur, Soigneur, Ingénieur ou Éclaireur — doit coopérer pour collecter 3 Nourriture, 3 Bois et 3 Métal, construire un radeau et quitter l'île avant le tour 20. Chaque fin de tour déclenche un événement aléatoire (tempête, attaque de bête, malédiction). Si un explorateur meurt ou si le compteur atteint 20 tours : défaite collective.

Ce projet est une **démonstration technique** : le jeu entier a été conçu, développé, illustré, testé et documenté sans intervention humaine par un pipeline de 5 agents IA.

---

## Lancement

```bash
# Aucune installation requise
open index.html
```

> Ouvrez simplement `index.html` dans votre navigateur. Aucun serveur, aucune dépendance.

> ⚠️ **Limitation connue :** `game.js` est tronqué à la ligne 621 — la condition `if (!gameState.gameOver && gameState.abil` n'est pas fermée, rendant le script invalide. Le jeu ne se chargera pas dans l'état actuel. Voir [#Limitations](#limitations) pour le détail.

---

## Architecture

Ce projet illustre une **orchestration multi-agent** où chaque agent a un rôle délimité et passe sa sortie à l'agent suivant via un graphe LangGraph.

```
Designer ──► Developer ──► Asset Generator ──► Tester ──► Documentalist
```

| Agent | Responsabilité |
|---|---|
| **Designer** | Traduit le concept en règles, mécaniques et structure de données |
| **Developer** | Génère `index.html`, `style.css` et `game.js` |
| **Asset Generator** | Produit les SVG du plateau, des tuiles et des cartes événements |
| **Tester** | Analyse statiquement le code, remonte les erreurs et avertissements |
| **Documentalist** | Rédige `rules.md` et ce `README.md` |

Chaque agent est un appel indépendant à **Claude Sonnet**, conditionné par le contexte accumulé des étapes précédentes.

---

## Stack

- **LangGraph** — orchestration du graphe d'agents et gestion des états
- **Claude Sonnet (Anthropic)** — modèle de génération pour chaque agent
- **HTML / CSS / JavaScript** — runtime du jeu, sans framework
- **SVG** — assets graphiques générés programmatiquement

---

## Structure des fichiers

```
île-maudite/
├── index.html
├── style.css
├── game.js
├── rules.md
└── assets/
    ├── board.svg
    ├── tile_foret.svg
    ├── tile_plaine.svg
    ├── tile_ruine.svg
    ├── tile_marais.svg
    ├── tile_plage.svg
    ├── tile_volcan.svg
    ├── tile_back.svg
    ├── card_tempete.svg
    ├── card_attaque_bete.svg
    ├── card_malediction.svg
    └── card_accalmie.svg
```

---

## Limitations

| Fichier | Problème | Impact |
|---|---|---|
| `game.js` | Fichier tronqué à la ligne 621 — blocs `if`, `function renderBoard()` et parents non fermés (`SyntaxError`) | **Bloquant** — le jeu est non fonctionnel |

Cette limitation est un artefact de la fenêtre de contexte de l'agent Developer. Elle illustre une problématique réelle des pipelines de génération de code long : la **gestion de la troncature** est un axe d'amélioration prioritaire du pipeline.

---

## Licence

Projet de démonstration — usage libre à des fins d'apprentissage et d'évaluation.