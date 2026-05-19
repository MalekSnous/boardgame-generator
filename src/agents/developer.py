"""
Agent Developer — génère index.html, style.css et game.js.

Entrée  : game_name, game_mechanics (JSON), game_rules (Markdown),
          components_description
Sorties : index_html, style_css, game_js

Stratégie : 3 appels séquentiels, un fichier à la fois.
  1. game.js  — toute la logique + liste des IDs/classes DOM utilisés
  2. index.html — structure statique basée sur le DOM de game.js
  3. style.css  — style de tous les éléments connus

Évite le problème de token exhaustion lié à l'encodage JSON du structured output.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

if TYPE_CHECKING:
    from src.orchestrator import GameState

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8096

_SYSTEM_PROMPT = """\
Tu es un développeur web expert spécialisé dans les jeux de société jouables dans un navigateur.
Tu génères uniquement du HTML/CSS/JavaScript vanilla — aucun framework, aucune librairie externe.

Règles impératives :
- game.js gère tout l'état (objet gameState global), le rendu DOM et les interactions.
- index.html : structure statique uniquement, avec #game-board, #info-panel, liens vers les fichiers.
- style.css : tous les styles visuels, états hover/active, écran de victoire, responsive.
- IDs et classes doivent être cohérents entre les trois fichiers.
- Interface obligatoire : indicateur de joueur actif, score/progression, bouton "Nouvelle partie",
  écran de fin de partie.
- Code complet, aucun TODO ni placeholder. Jouable immédiatement.\
"""


def _game_context(state: GameState) -> str:
    """Bloc de contexte commun réutilisé dans les 3 prompts."""
    try:
        mechanics = json.loads(state.game_mechanics or "{}")
    except json.JSONDecodeError:
        mechanics = {}

    mechanic_list = "\n".join(f"- {m}" for m in mechanics.get("mechanics", []))
    return (
        f"Jeu : **{state.game_name}**\n"
        f"Joueurs : {mechanics.get('player_count', '')}\n"
        f"Objectif : {mechanics.get('objective', '')}\n\n"
        f"Mécaniques :\n{mechanic_list}\n\n"
        f"Règles :\n{state.game_rules}\n\n"
        f"Composants :\n{state.components_description}"
    )


def _extract_code_block(text: str, lang: str = "") -> str:
    """Extrait le contenu d'un bloc ```lang ... ``` ou retourne le texte brut."""
    pattern = rf"```{re.escape(lang)}\s*\n(.*?)```"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).rstrip()
    # fallback : cherche n'importe quel bloc de code
    m = re.search(r"```\w*\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).rstrip()
    return text.strip()


def _generate_game_js(llm: ChatAnthropic, context: str) -> str:
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Génère **game.js** complet : objet gameState, initialisation, rendu DOM, "
            "gestion des clics/interactions, détection de victoire, bouton nouvelle partie.\n"
            "Commence directement par le code JavaScript, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _extract_code_block(response.content, "javascript")


def _generate_index_html(llm: ChatAnthropic, context: str, game_js: str) -> str:
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici game.js déjà généré :\n"
            f"```javascript\n{game_js}\n```\n\n"
            "Génère **index.html** complet : structure HTML5 avec exactement les IDs et classes "
            "utilisés dans game.js, liens vers style.css et game.js.\n"
            "Commence directement par le code HTML, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _extract_code_block(response.content, "html")


def _generate_style_css(llm: ChatAnthropic, context: str, game_js: str, index_html: str) -> str:
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici les fichiers déjà générés :\n\n"
            f"**index.html**\n```html\n{index_html}\n```\n\n"
            f"**game.js** (extrait — IDs et classes DOM)\n"
            f"```javascript\n{game_js[:3000]}{'...' if len(game_js) > 3000 else ''}\n```\n\n"
            "Génère **style.css** complet : mise en page, plateau de jeu, pièces/tokens, "
            "boutons, états hover/active/disabled, indicateur de joueur actif, "
            "écran de victoire, responsive mobile.\n"
            "Commence directement par le code CSS, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _extract_code_block(response.content, "css")


def run(state: GameState) -> dict:
    """Génère les 3 fichiers du jeu en 3 appels séquentiels ciblés."""
    llm = ChatAnthropic(model=MODEL, max_tokens=MAX_TOKENS)
    context = _game_context(state)

    game_js    = _generate_game_js(llm, context)
    index_html = _generate_index_html(llm, context, game_js)
    style_css  = _generate_style_css(llm, context, game_js, index_html)

    return {
        "game_js":    game_js,
        "index_html": index_html,
        "style_css":  style_css,
        "current_step": "developer_done",
    }
