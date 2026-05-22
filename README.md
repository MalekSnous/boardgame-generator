# 🎲 Board Game Generator

[![CI](https://github.com/MalekSnous/boardgame-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/MalekSnous/boardgame-generator/actions/workflows/ci.yml)
[![Deploy](https://github.com/MalekSnous/boardgame-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/MalekSnous/boardgame-generator/actions/workflows/deploy.yml)

> Pipeline multi-agent LangGraph + Claude Sonnet qui génère
> des jeux de société jouables dans le navigateur
> à partir d'un simple prompt texte.

**🔗 [Voir les jeux en ligne](https://maleksnous.github.io/boardgame-generator/)**

---

## Jeux générés

| Jeu | Type | Joueurs | Pipeline | Lien |
|---|---|---|---|---|
| 🎲 Dés du Destin | Coopératif / Dés | 2–4 | v1 — 5 corrections manuelles | [Jouer](https://maleksnous.github.io/boardgame-generator/output/des-du-destin/) · [Règles](https://maleksnous.github.io/boardgame-generator/output/des-du-destin/rules.html) |
| ⚔️ Duel Tactique | Stratégie | 2 | v2 — 0 correction manuelle | [Jouer](https://maleksnous.github.io/boardgame-generator/output/duel-tactique/) · [Règles](https://maleksnous.github.io/boardgame-generator/output/duel-tactique/rules.html) |
| 🏝️ Île Maudite | Survie / Exploration | 2–4 | v2 — jeu complexe | [Jouer](https://maleksnous.github.io/boardgame-generator/output/ile-maudite/) · [Règles](https://maleksnous.github.io/boardgame-generator/output/ile-maudite/rules.html) |

---

## Architecture du pipeline

```
[Prompt utilisateur]
        │
        ▼
┌──────────────┐
│ Orchestrateur│  LangGraph StateGraph — gère l'état partagé
│  LangGraph   │  et route entre les agents
└──────┬───────┘
       │
┌──────▼───────┐   ┌───────────┐   ┌────────────────┐
│   Designer   │──▶│ Developer │──▶│ Asset Generator│
│              │   │           │   │                │
│ Règles       │   │ game.js   │   │ SVG plateau,   │
│ Mécaniques   │   │ index.html│   │ pions, cartes  │
│ Composants   │   │ style.css │   └───────┬────────┘
└──────────────┘   └───────────┘           │
                                           ▼
                               ┌─────────────────┐
                               │     Tester      │◀─┐
                               │                 │  │ retry si
                               │ Checklist       │──┘ bugs détectés
                               │ syntaxe+logique │   (max 3×)
                               └──────┬──────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Documentalist│
                               │              │
                               │ rules.md     │
                               │ README.md    │
                               └──────┬───────┘
                                      │
                                      ▼
                          📦 output/{game_name}/
                          ├── index.html
                          ├── style.css
                          ├── game.js
                          ├── rules.md
                          ├── rules.html
                          ├── README.md
                          └── assets/*.svg
```

---

## Robustesse du pipeline

| Amélioration | Description |
|---|---|
| Découpage game.js en 3 parties | Évite la troncature sur les jeux complexes |
| Retry ciblé Tester→Developer | Corrections chirurgicales, pas de régénération |
| Validation syntaxique JS | `node --check` après chaque génération |
| Nettoyage backticks Markdown | Suppression automatique des fences |
| Retry API avec backoff | Resilience aux erreurs réseau |
| Logging JSON structuré | Traçabilité complète de chaque run |
| Fallback SVG | Placeholder si un asset échoue |

---

## Lancer le pipeline

```bash
# Installation
git clone https://github.com/MalekSnous/boardgame-generator
cd boardgame-generator
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Configuration
cp .env.example .env
# Ajouter ANTHROPIC_API_KEY dans .env

# Générer un jeu
python -m src.orchestrator "votre concept de jeu ici"
# Le jeu est créé dans output/{nom_du_jeu}/
```

---

## Stack

| Couche | Technologie |
|---|---|
| Orchestration agents | LangGraph |
| LLM | Claude Sonnet (Anthropic) |
| Langage pipeline | Python 3.12 |
| Runtime jeux | HTML5 / CSS3 / JavaScript vanilla |
| Assets | SVG généré programmatiquement |
| CI/CD | GitHub Actions |
| Déploiement | GitHub Pages |
