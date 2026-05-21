"""
Agent Developer — génère index.html, style.css et game.js.

Entrée  : game_name, game_mechanics (JSON), game_rules (Markdown),
          components_description
Sorties : index_html, style_css, game_js

Stratégie : 5 appels séquentiels, chacun limité à MAX_TOKENS.
  1. game.js PARTIE 1 (core)    — constantes, helpers, gameState, logique pure (pas de DOM)
  2. game.js PARTIE 2 (actions) — fonctions d'action, capacités spéciales, événements
  3. game.js PARTIE 3 (render)  — fonctions render*, handleCellClick, listeners, DOMContentLoaded
  Les 3 parties sont concaténées en un seul game.js.
  4. index.html — structure HTML basée sur les IDs/classes de la partie render
  5. style.css  — style de tous les éléments connus

Découper game.js en 3 parties permet de gérer n'importe quelle complexité
sans jamais dépasser la limite de tokens par appel.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from src.utils.retry import with_retry

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


def _validate_js_syntax(code: str) -> tuple[bool, str]:
    """Vérifie la syntaxe JS via `node --check`. Non-bloquant."""
    with tempfile.NamedTemporaryFile(suffix=".js", mode="w", encoding="utf-8", delete=False) as f:
        f.write(code)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["node", "--check", tmp_path],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return True, ""
        error = (result.stderr or result.stdout).strip()
        return False, error
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return True, ""  # node absent ou timeout : on laisse passer
    finally:
        os.unlink(tmp_path)


def _strip_markdown_fences(code: str) -> str:
    """Supprime les lignes de backticks ``` en début/fin si le modèle en a ajouté."""
    lines = code.splitlines()
    # Retire une ligne d'ouverture (``` ou ```lang)
    if lines and re.match(r"^```", lines[0].strip()):
        lines = lines[1:]
    # Retire une ligne de fermeture
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


def _game_context(state: GameState) -> str:
    """Bloc de contexte commun réutilisé dans les 3 prompts."""
    try:
        mechanics = json.loads(state.game_mechanics or "{}")
    except json.JSONDecodeError:
        mechanics = {}

    mechanic_list = "\n".join(f"- {m}" for m in mechanics.get("mechanics", []))
    assets_block = (
        "Assets SVG disponibles (à utiliser dans le code) :\n"
        + "\n".join(f"- assets/{f}" for f in (state.asset_manifest or []))
        + "\nUtilise ces fichiers via <img src='assets/...'> ou en CSS background-image."
        " Ne génère pas de visuels en dur."
    ) if state.asset_manifest else ""
    return (
        f"Jeu : **{state.game_name}**\n"
        f"Joueurs : {mechanics.get('player_count', '')}\n"
        f"Objectif : {mechanics.get('objective', '')}\n\n"
        f"Mécaniques :\n{mechanic_list}\n\n"
        f"Règles :\n{state.game_rules}\n\n"
        f"Composants :\n{state.components_description}"
        + (f"\n\n{assets_block}" if assets_block else "")
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


@with_retry()
def _generate_game_js_core(llm: ChatAnthropic, context: str) -> str:
    """PARTIE 1 — constantes, helpers, gameState, logique pure (aucun DOM)."""
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Génère la **PARTIE 1/3** de game.js.\n\n"
            "Contenu attendu :\n"
            "- Constantes globales (tailles, limites, définitions de terrain, classes, événements)\n"
            "- Variable `let gameState = {}`\n"
            "- Helpers purs (shuffle, idx, pos, adjacent, totaux…)\n"
            "- Fonctions d'initialisation : initGame(), buildGrid(), buildPlayers()\n"
            "- Logging : addLog()\n"
            "- Logique de jeu : movePlayer(), checkDeath(), checkVictory(), et toutes les "
            "fonctions qui manipulent gameState sans toucher au DOM\n\n"
            "⛔ INTERDIT dans cette partie : `document.`, `getElementById`, fonctions render*, "
            "addEventListener, DOMContentLoaded.\n\n"
            "Termine par le commentaire : `// === FIN PARTIE 1 ===`\n"
            "Commence directement par le code JavaScript, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _strip_markdown_fences(_extract_code_block(response.content, "javascript"))


@with_retry()
def _generate_game_js_actions(llm: ChatAnthropic, context: str, core: str) -> str:
    """PARTIE 2 — actions joueur, capacités spéciales, événements."""
    core_tail = core[-3000:] if len(core) > 3000 else core
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici la **PARTIE 1/3** déjà générée (fin) :\n"
            f"```javascript\n{core_tail}\n```\n\n"
            "Génère la **PARTIE 2/3** de game.js. Continue directement — ne redéclare rien.\n\n"
            "Contenu attendu :\n"
            "- Actions du joueur : actionCollect(), actionHeal(), actionBuild()\n"
            "- Capacités spéciales : activateAbility(), hunterTrap(), healerHeal(), "
            "engineerPick(), scoutReveal()\n"
            "- Gestion des événements : advanceToEvent(), drawEvent(), applyEvent(), endTurn()\n\n"
            "⛔ INTERDIT dans cette partie : fonctions render*, addEventListener, DOMContentLoaded.\n\n"
            "Termine par le commentaire : `// === FIN PARTIE 2 ===`\n"
            "Continue directement le code JavaScript, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _strip_markdown_fences(_extract_code_block(response.content, "javascript"))


@with_retry()
def _generate_game_js_render(llm: ChatAnthropic, context: str, core: str, actions: str) -> str:
    """PARTIE 3 — fonctions render*, handleCellClick, listeners, DOMContentLoaded."""
    core_tail    = core[-1500:]    if len(core)    > 1500    else core
    actions_tail = actions[-2000:] if len(actions) > 2000    else actions
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici les PARTIES 1 et 2 déjà générées (fins) :\n"
            f"**Fin PARTIE 1 :**\n```javascript\n{core_tail}\n```\n\n"
            f"**Fin PARTIE 2 :**\n```javascript\n{actions_tail}\n```\n\n"
            "Génère la **PARTIE 3/3** de game.js. Continue directement — ne redéclare rien.\n\n"
            "Contenu attendu :\n"
            "- Fonction render() qui dispatche vers les sous-renderers\n"
            "- renderBoard() — grille complète avec brouillard, terrains, pions, highlights\n"
            "- handleCellClick(cellIdx) — gère les clics sur les cases\n"
            "- renderInfoPanel() — dispatche vers tous les sous-renderers du panneau\n"
            "- renderActivePlayer(), renderPhase(), renderActions()\n"
            "- renderInventory() — ressources, 8 emplacements visuels\n"
            "- renderAllPlayers() — liste avec barres de PV\n"
            "- renderLastEvent(), renderTurnBar(), renderLog()\n"
            "- renderGameOver() — écran de victoire/défaite\n"
            "- renderContextMessage() — message d'aide pour les modes de capacité\n"
            "- attachListeners() — tous les boutons et interactions\n"
            "- document.addEventListener('DOMContentLoaded', () => { attachListeners(); })\n\n"
            "⚠️ Tous les IDs HTML utilisés doivent exister dans index.html : "
            "crée-les de façon cohérente. "
            "Documente les IDs principaux en commentaire en tête de cette partie.\n\n"
            "Continue directement le code JavaScript, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _strip_markdown_fences(_extract_code_block(response.content, "javascript"))


@with_retry()
def _generate_index_html(llm: ChatAnthropic, context: str, render_part: str) -> str:
    """Génère index.html à partir de la partie render (qui contient tous les getElementById)."""
    render_excerpt = render_part[:6000] if len(render_part) > 6000 else render_part
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici la partie RENDER de game.js (fonctions render* et listeners) :\n"
            f"```javascript\n{render_excerpt}\n```\n\n"
            "Génère **index.html** complet : structure HTML5 avec exactement tous les IDs et "
            "classes référencés dans ce code JS, liens vers style.css et game.js.\n"
            "Commence directement par le code HTML, sans explication."
        )),
    ]
    response = llm.invoke(messages)
    return _strip_markdown_fences(_extract_code_block(response.content, "html"))


@with_retry()
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
    return _strip_markdown_fences(_extract_code_block(response.content, "css"))


@with_retry()
def _fix_game_js(
    llm: ChatAnthropic,
    context: str,
    game_js: str,
    fixes_required: list[str],
) -> str:
    """
    Applique les corrections ciblées du Tester sans régénérer
    le fichier entier. Moins coûteux, plus précis qu'une
    régénération complète.
    """
    fixes_block = "\n".join(f"- {f}" for f in fixes_required)
    game_js_excerpt = game_js[:12000] if len(game_js) > 12000 else game_js

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=(
            f"{context}\n\n"
            "Voici game.js actuel :\n"
            f"```javascript\n{game_js_excerpt}\n```\n\n"
            "Le Testeur a identifié ces erreurs bloquantes à corriger :\n"
            f"{fixes_block}\n\n"
            "Règles impératives :\n"
            "- Corrige UNIQUEMENT les fonctions et variables mentionnées\n"
            "- Ne réécris PAS les fonctions qui fonctionnent correctement\n"
            "- Retourne le fichier game.js COMPLET avec les corrections appliquées\n"
            "- Aucun TODO ni placeholder\n"
            "- Commence directement par le code JavaScript, sans explication"
        )),
    ]
    response = llm.invoke(messages)
    return _strip_markdown_fences(
        _extract_code_block(response.content, "javascript")
    )


def run(state: GameState) -> dict:
    """Génère les 3 fichiers du jeu ; au retry, corrige game.js de façon ciblée."""
    llm     = ChatAnthropic(model=MODEL, max_tokens=MAX_TOKENS)
    context = _game_context(state)

    # Retry : corrections ciblées si le Tester a fourni des fixes
    if state.retry_count > 0 and state.fixes_required and state.game_js:
        game_js = _fix_game_js(llm, context, state.game_js, state.fixes_required)
    else:
        # Première génération : 3 parties séquentielles
        core    = _generate_game_js_core(llm, context)
        actions = _generate_game_js_actions(llm, context, core)
        render  = _generate_game_js_render(llm, context, core, actions)
        game_js = "\n\n".join([core, actions, render])

    ok, err = _validate_js_syntax(game_js)
    if not ok:
        game_js = f"// WARNING: syntax validation failed — {err}\n{game_js}"

    # index.html et style.css : régénérés seulement à la première passe
    # Au retry, on les conserve sauf si game.js a changé de structure
    if state.retry_count > 0 and state.index_html and state.style_css:
        index_html = state.index_html
        style_css  = state.style_css
    else:
        render_part = render if state.retry_count == 0 else game_js[-4000:]
        index_html  = _generate_index_html(llm, context, render_part)
        style_css   = _generate_style_css(llm, context, game_js, index_html)

    return {
        "game_js":    game_js,
        "index_html": index_html,
        "style_css":  style_css,
        "current_step": "developer_done",
    }
