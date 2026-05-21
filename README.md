# Boardgame Generator

[![CI](https://github.com/MalekSnous/boardgame-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/MalekSnous/boardgame-generator/actions/workflows/ci.yml)
[![Deploy](https://github.com/MalekSnous/boardgame-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/MalekSnous/boardgame-generator/actions/workflows/deploy.yml)

Pipeline multi-agent pour générer des jeux de société jouables dans le navigateur, piloté par Claude via LangGraph.

## Architecture

```
concept de jeu (texte)
        │
        ▼
┌──────────────────────────────────────────────────┐
│                  Orchestrateur                    │
│                  (LangGraph)                      │
│                                                   │
│  ┌──────────┐   ┌───────────┐   ┌─────────────┐  │
│  │ Designer │──▶│Développeur│──▶│Asset SVG Gen│  │
│  └──────────┘   └───────────┘   └──────┬──────┘  │
│                                        │          │
│                 ┌──────────────────────┘          │
│                 ▼                                 │
│          ┌──────────┐   ┌────────────────┐        │
│          │  Testeur │──▶│ Documentaliste │        │
│          └──────────┘   └────────────────┘        │
└──────────────────────────────────────────────────┘
        │
        ▼
   output/<nom_du_jeu>/
   ├── index.html
   ├── style.css
   ├── game.js
   ├── assets/
   │   ├── piece_1.svg
   │   └── ...
   ├── rules.md
   └── README.md
```

### Agents

| Agent | Rôle |
|---|---|
| **Designer** | Conçoit les règles, la mécanique et les composants du jeu |
| **Développeur** | Génère le code HTML/CSS/JS pour jouer dans le navigateur |
| **Asset Generator** | Crée les assets visuels (pièces, plateau, cartes) en SVG |
| **Testeur** | Vérifie la cohérence des règles et la jouabilité du code |
| **Documentaliste** | Rédige `rules.md` et `README.md` |

### État partagé : `GameState`

Chaque agent lit et enrichit un objet `GameState` JSON transmis de nœud en nœud dans le graph LangGraph.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copier `.env.example` en `.env` et renseigner votre clé API :

```bash
cp .env.example .env
# éditer .env et ajouter ANTHROPIC_API_KEY=...
```

## Utilisation

```bash
python -m src.orchestrator "Jeu de plateau coopératif sur l'exploration spatiale, 2-4 joueurs"
```

Le jeu généré est disponible dans `output/<nom_du_jeu>/index.html`.

## Stack technique

- **LLM** : Claude (Anthropic) via `langchain-anthropic`
- **Orchestration** : LangGraph (StateGraph)
- **Validation** : Pydantic v2
- **Output** : HTML5 + CSS3 + JavaScript vanilla (zero dépendance npm)

## Structure du projet

```
boardgame-generator/
├── src/
│   ├── __init__.py
│   ├── orchestrator.py       ← graph LangGraph + GameState
│   └── agents/
│       ├── __init__.py
│       ├── designer.py
│       ├── developer.py
│       ├── asset_generator.py
│       ├── tester.py
│       └── documentalist.py
├── output/                   ← jeux générés (gitignored)
├── tests/
├── requirements.txt
├── .env.example
└── README.md
```
