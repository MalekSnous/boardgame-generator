"""
Agent Asset Generator — génère les assets SVG du jeu.

Entrée  : game_name, components_description, game_mechanics, index_html, game_js
Sorties : assets (GameAssets : filenames + contents SVG)

Stratégie :
  1. Extraire les assets/*.svg déjà référencés dans le code du Developer.
     Si aucun, demander à Claude une liste de noms de fichiers adaptés.
  2. Générer chaque SVG en appel individuel — élimine le problème de
     token exhaustion lié à l'encodage JSON du structured output groupé.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from src.utils.retry import with_retry

if TYPE_CHECKING:
    from src.orchestrator import GameState

MODEL = "claude-sonnet-4-6"

_PALETTE_BLOCK = """\
Palette obligatoire :
  board_bg #F1FAEE  — fond plateau
  lines    #1D3557  — bordures, grilles
  player1  #E63946  — joueur 1
  player2  #457B9D  — joueur 2
  player3  #2A9D8F  — joueur 3
  player4  #E9C46A  — joueur 4
  accent   #F4A261  — victoire / sélection
  neutral  #A8DADC  — éléments neutres\
"""

_SVG_RULES = """\
Règles SVG :
- Commencer par <svg xmlns="http://www.w3.org/2000/svg" viewBox="...">
- Premier enfant : <title>...</title>
- Aucune dépendance externe (pas de <image href>, pas de polices web)
- board.svg : viewBox="0 0 400 400" ou 500×500
- piece_*.svg / pion_*.svg : viewBox="0 0 60 60"
- card_*.svg : viewBox="0 0 60 90"
- token_*.svg / jeton_*.svg : viewBox="0 0 50 50"
- Formes simples, lisibles à 32px\
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_svg_references(html: str, js: str) -> list[str]:
    """Noms de fichiers assets/*.svg trouvés dans le code du Developer."""
    combined = f"{html}\n{js}"
    found = re.findall(r'assets/([\w./-]+\.svg)', combined)
    return list(dict.fromkeys(found))


@with_retry()
def _get_manifest_from_llm(llm: ChatAnthropic, state: GameState) -> list[str]:
    """Génère la liste des noms de fichiers SVG nécessaires (fallback)."""
    try:
        mechanics = json.loads(state.game_mechanics or "{}")
    except json.JSONDecodeError:
        mechanics = {}

    prompt = (
        f"Jeu : {state.game_name}\n"
        f"Composants : {state.components_description}\n"
        f"Joueurs : {mechanics.get('player_count', '')}\n\n"
        "Liste les noms de fichiers SVG nécessaires pour ce jeu (plateau, pions, cartes, tokens…).\n"
        "Réponds UNIQUEMENT avec une liste de noms de fichiers, un par ligne, sans extension de description.\n"
        "Exemple :\nboard.svg\npiece_p1.svg\npiece_p2.svg\ncard_back.svg"
    )
    response = llm.invoke([
        SystemMessage(content="Tu es un game designer. Liste uniquement des noms de fichiers SVG."),
        HumanMessage(content=prompt),
    ])
    lines = [ln.strip() for ln in response.content.strip().splitlines()]
    return [ln for ln in lines if ln.endswith(".svg")][:12]  # cap à 12


@with_retry()
def _generate_one_svg(llm: ChatAnthropic, filename: str, game_name: str, components: str) -> str:
    """Génère le contenu SVG d'un fichier donné."""
    prompt = (
        f"Jeu : {game_name}\n"
        f"Composants : {components}\n\n"
        f"{_PALETTE_BLOCK}\n\n"
        f"{_SVG_RULES}\n\n"
        f"Génère le fichier SVG : **{filename}**\n"
        "Réponds UNIQUEMENT avec le SVG complet (commence par <svg …>), sans commentaire."
    )
    response = llm.invoke([
        SystemMessage(content="Tu es un designer SVG expert pour jeux de société."),
        HumanMessage(content=prompt),
    ])
    # Extraire le bloc SVG si le modèle a ajouté des backticks
    text = response.content.strip()
    m = re.search(r"(<svg[\s\S]*?</svg>)", text, re.IGNORECASE)
    return m.group(1) if m else text


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def run(state: GameState) -> dict:
    """Génère les assets SVG un par un et retourne le GameAssets enrichi."""
    llm = ChatAnthropic(model=MODEL, max_tokens=4096)

    # Étape 1 : déterminer les fichiers à générer
    asset_names = _extract_svg_references(state.index_html or "", state.game_js or "")
    if not asset_names:
        asset_names = _get_manifest_from_llm(llm, state)

    # Étape 2 : générer chaque SVG individuellement
    filenames: list[str] = []
    contents: dict[str, str] = {}

    from src.utils.logger import get_logger

    for filename in asset_names:
        try:
            svg = _generate_one_svg(
                llm, filename, state.game_name or "", state.components_description or ""
            )
        except Exception as exc:
            logger = get_logger()
            if logger:
                logger.log_step(
                    agent="asset_generator",
                    duration_s=0.0,
                    input_keys=[filename],
                    output_keys=[],
                    success=False,
                    error=f"SVG generation failed for {filename}: {exc}",
                )
            svg = (
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">'
                f"<title>{filename}</title>"
                f'<rect width="60" height="60" fill="#A8DADC" rx="4"/>'
                f'<text x="30" y="35" text-anchor="middle" font-size="10" fill="#1D3557">{filename}</text>'
                f"</svg>"
            )
        filenames.append(filename)
        contents[filename] = svg

    return {
        "assets": {"filenames": filenames, "contents": contents},
        "current_step": "asset_generator_done",
    }
