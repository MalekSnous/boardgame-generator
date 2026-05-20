# Duel Tactique

> Jeu de stratégie pour 2 joueurs — généré automatiquement par un pipeline multi-agent LangGraph + Claude Sonnet

---

## Démarrage rapide

```bash
# Aucune installation requise
open index.html
```

Ouvrez `index.html` dans votre navigateur. C'est tout.

---

## Concept

Duel Tactique oppose deux joueurs sur un plateau quadrillé. Chaque camp déplace ses pièces pour **capturer le drapeau adverse** tout en défendant le sien. La victoire passe par la lecture du terrain, la gestion des points de mouvement et l'exploitation du brouillard de guerre pour tromper l'adversaire.

| Joueurs | Mécaniques clés |
|---------|----------------|
| 2 | Déplacement sur grille, capture de pièces, contrôle de territoire, bluff / information cachée, gestion de ressources |

---

## Architecture — Pipeline multi-agent

Ce projet est un **artefact de démonstration** produit par un pipeline LangGraph orchestrant cinq agents Claude Sonnet spécialisés, exécutés séquentiellement :

```
Designer ──► Developer ──► Asset Generator ──► Tester ──► Documentalist
```

| Agent | Responsabilité |
|-------|---------------|
| **Designer** | Traduit le concept (`jeu de stratégie 2 joueurs`) en règles structurées, mécaniques et thème |
| **Developer** | Génère le code source complet (HTML / CSS / JS) à partir des spécifications |
| **Asset Generator** | Produit les assets SVG (plateau, pièces, tuiles, marqueurs, cartes) |
| **Tester** | Analyse statiquement le code, identifie les erreurs et incohérences |
| **Documentalist** | Rédige règles (`rules.md`) et documentation finale |

L'ensemble du pipeline s'exécute sans intervention humaine à partir d'un prompt unique.

---

## Stack

- **Orchestration** : [LangGraph](https://github.com/langchain-ai/langgraph)
- **LLM** : Claude Sonnet (Anthropic)
- **Frontend** : HTML5 · CSS3 · JavaScript vanilla
- **Assets** : SVG généré programmatiquement
- **Runtime** : Navigateur uniquement — zéro dépendance

---

## Structure des fichiers

```
duel-tactique/
├── index.html                    # Point d'entrée — structure et UI
├── style.css                     # Styles du plateau et des pièces
├── game.js                       # Logique de jeu complète
├── rules.md                      # Règles générées par l'agent Documentalist
└── assets/
    ├── board.svg                 # Plateau quadrillé
    ├── piece_drapeau.svg         # Pièce : Drapeau
    ├── piece_soldat.svg          # Pièce : Soldat
    ├── piece_cavalier.svg        # Pièce : Cavalier
    ├── piece_tour.svg            # Pièce : Tour
    ├── piece_general.svg         # Pièce : Général
    ├── card_bouclier.svg         # Carte : Bouclier
    ├── card_sprint.svg           # Carte : Sprint
    ├── card_piege.svg            # Carte : Piège
    ├── tile_foret.svg            # Tuile terrain : Forêt
    ├── tile_marais.svg           # Tuile terrain : Marais
    └── marker_premier_joueur.svg # Marqueur premier joueur
```

---

## ⚠️ Limitations connues

Le **Tester** a détecté plusieurs anomalies dans le code généré. Le jeu se charge mais ne s'exécute pas correctement en l'état.

Problèmes critiques identifiés :

- **SyntaxError** (ligne ~775) : `gameState.currentPlayer` coupé par un saut de ligne — bloque le chargement du script entier
- **`gameState.pieces` indéfini** : la logique de rendu cible un tableau plat inexistant ; l'état réel est structuré sous `players[n].pieces`
- **Propriétés manquantes** dans `gameState` : `discardPile`, `gameOver`, `turnCount`, `terrain`, `flags`, `fogEnabled` utilisées sans initialisation
- **Constantes `PIECE_TYPE` incohérentes** : les clés françaises (`SOLDAT`, `CAVALIER`, `TOUR`, `DRAPEAU`) ne correspondent pas aux clés anglaises déclarées → `undefined` partout
- **`movePiece()` appelée avec un argument au lieu de deux** : la sélection de pièce n'est jamais transmise
- **`shuffleArray` indéfinie** : seule `shuffle()` existe — `ReferenceError` à l'exécution
- **`gameState.traps` utilisé comme tableau** alors que c'est un objet clé/valeur → `TypeError` sur `.map()` et `.filter()`
- **`attachListeners()` tronquée** et jamais appelée au démarrage — les contrôles UI sont inactifs

> Ces erreurs illustrent les limites actuelles de la génération de code par LLM sur des projets dépassant ~700 lignes. Elles constituent des cas de test concrets pour l'amélioration du pipeline.

---

## Contexte

Ce dépôt est un **démonstrateur technique** — son objectif est d'illustrer les capacités et les limites d'un pipeline de génération automatique de jeux, pas de fournir un produit fini. Le code généré, y compris ses défauts, est conservé tel quel en sortie de pipeline.