"""
Agent Documentaliste — produit les deux documents finaux du jeu.

Entrée  : tout le GameState final (règles, code, assets, résultats des tests)
Sorties : rules_md (guide joueur), readme_md (doc technique GitHub/recruteur)

Deux appels LLM distincts, un par document, pour des audiences opposées :
  - rules.md   → joueur lambda, zéro jargon technique
  - README.md  → développeur/recruteur, architecture mise en avant
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from src.utils.retry import with_retry

if TYPE_CHECKING:
    from src.orchestrator import GameState

MODEL = "claude-sonnet-4-6"

# ---------------------------------------------------------------------------
# rules.md — guide joueur
# ---------------------------------------------------------------------------

_RULES_SYSTEM = """\
Tu es un rédacteur spécialisé dans les règles de jeux de société grand public.
Tu transformes une spécification technique en un guide de jeu clair et agréable à lire.

### Consignes

- Zéro mention de code, d'IA ou de pipeline technique.
- Langage simple, direct, inclusif (tutoiement ou "les joueurs").
- Structure en sections avec titres Markdown ##.
- Les étapes d'un tour sont numérotées et formulées comme des actions concrètes.
- Ton accueillant : le lecteur doit avoir envie de jouer immédiatement.
- Longueur idéale : 250 à 450 mots.\
"""

_README_SYSTEM = """\
Tu es un développeur senior qui rédige la documentation GitHub d'un projet de démonstration IA.
Ce projet est un générateur de jeux de société utilisant un pipeline multi-agent LangGraph + Claude.

### Consignes

- Mettre en avant l'architecture multi-agent comme valeur technique centrale.
- Instructions de lancement ultra-simples (ouvrir index.html dans un navigateur).
- Section "Architecture" avec le flux des 5 agents.
- Section "Stack" listant les technologies clés.
- Section "Structure des fichiers" avec tous les fichiers du jeu.
- Mentionner les limitations connues si des erreurs de validation existent.
- Ton professionnel, concis, orienté recruteur/contributeur.
- Longueur idéale : 350 à 550 mots.\
"""


def _decode_mechanics(raw: str | None) -> dict:
    try:
        return json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}


def _rules_prompt(state: GameState) -> str:
    mechanics = _decode_mechanics(state.game_mechanics)
    return f"""Écris le fichier rules.md pour le jeu **{state.game_name}**.

## Informations de conception

**Joueurs :** {mechanics.get('player_count', '')}
**Objectif :** {mechanics.get('objective', '')}
**Mécaniques :** {', '.join(mechanics.get('mechanics', []))}

## Composants
{state.components_description}

## Règles détaillées (source Designer)
{state.game_rules}

Produis un guide joueur complet : présentation, composants, mise en place,
déroulement d'un tour (étapes numérotées), conditions de victoire,
et une courte section de conseils stratégiques si pertinent."""


def _readme_prompt(state: GameState) -> str:
    mechanics = _decode_mechanics(state.game_mechanics)

    # Section limitations
    if state.validation_errors:
        limitations = "\n".join(f"- {e}" for e in state.validation_errors)
        limitations_section = f"\n## Limitations connues\n{limitations}\n"
    elif not state.validation_passed:
        limitations_section = (
            "\n## Limitations connues\n"
            "- La validation automatique n'a pas été entièrement concluante. "
            "Le jeu peut nécessiter des ajustements manuels.\n"
        )
    else:
        limitations_section = ""

    # Liste des assets SVG
    if state.assets.filenames:
        assets_list = "\n".join(f"  - `assets/{f}`" for f in state.assets.filenames)
    else:
        assets_list = "  *(aucun asset SVG généré)*"

    return f"""Écris le README.md du projet pour le jeu **{state.game_name}**.

## Contexte du projet
Concept original : « {state.concept} »
Généré automatiquement par un pipeline multi-agent LangGraph orchestrant 5 agents Claude Sonnet.

## Données du jeu
**Nom :** {state.game_name}
**Joueurs :** {mechanics.get('player_count', '')}
**Objectif :** {mechanics.get('objective', '')}
**Mécaniques :** {', '.join(mechanics.get('mechanics', []))}

## Fichiers générés
- `index.html`
- `style.css`
- `game.js`
- `rules.md`
{assets_list}

## Résultat de validation
Statut : {"✅ Validé" if state.validation_passed else "⚠️ Validé avec avertissements"}
{limitations_section}
Produis un README.md professionnel qui présente le jeu ET le pipeline technique
qui l'a généré (flux Designer → Developer → Asset Generator → Tester → Documentalist)."""


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

@with_retry()
def _invoke_batch(llm, messages_list: list) -> list:
    return llm.batch(messages_list)


def run(state: GameState) -> dict:
    """Génère rules.md et README.md en deux appels LLM ciblés."""
    llm = ChatAnthropic(model=MODEL, max_tokens=2048)

    rules_messages = [
        SystemMessage(content=_RULES_SYSTEM),
        HumanMessage(content=_rules_prompt(state)),
    ]
    readme_messages = [
        SystemMessage(content=_README_SYSTEM),
        HumanMessage(content=_readme_prompt(state)),
    ]

    # Les deux appels sont indépendants — on les lance en parallèle via batch
    results = _invoke_batch(llm, [rules_messages, readme_messages])

    rules_md = results[0].content
    readme_md = results[1].content

    return {
        "rules_md": rules_md,
        "readme_md": readme_md,
        "current_step": "documentalist_done",
    }
