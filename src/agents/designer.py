"""
Agent Designer — conçoit le jeu à partir du concept utilisateur.

Entrée  : state.concept (str)
Sorties : game_name, game_mechanics (JSON), game_rules (Markdown),
          components_description
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.utils.retry import with_retry

if TYPE_CHECKING:
    from src.orchestrator import GameState

MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = """\
Tu es un game designer expert en jeux de société jouables dans un navigateur web.
À partir d'un concept, tu crées un design de jeu complet, équilibré et amusant,
réalisable en HTML/CSS/JS vanilla (pas de framework externe).
Sois précis et concret : les règles doivent être cohérentes, sans ambiguïté,
et directement implémentables par un développeur.\
"""


class GameDesign(BaseModel):
    """Design structuré retourné par l'Agent Designer."""

    game_name: str = Field(description="Nom du jeu — court et mémorable")
    player_count_min: int = Field(description="Nombre minimum de joueurs")
    player_count_max: int = Field(description="Nombre maximum de joueurs")
    objective: str = Field(
        description="Objectif principal du jeu en une phrase claire"
    )
    mechanics: list[str] = Field(
        description="3 à 6 mécaniques de jeu principales (ex: 'draft de cartes', 'placement de tuiles')"
    )
    turn_structure: list[str] = Field(
        description=(
            "Étapes d'un tour de jeu dans l'ordre, formulées comme des instructions "
            "directes au joueur actif (commencer par un verbe)"
        )
    )
    victory_conditions: str = Field(
        description="Conditions précises pour gagner la partie"
    )
    components: list[str] = Field(
        description=(
            "Tous les composants nécessaires avec quantité "
            "(ex: '1 plateau de jeu 8×8', '52 cartes action', '4 pions joueur')"
        )
    )


@with_retry()
def _invoke_design(structured_llm, messages) -> "GameDesign":
    return structured_llm.invoke(messages)


def run(state: GameState) -> dict:
    """Conçoit le jeu et retourne les champs enrichis du GameState."""
    llm = ChatAnthropic(model=MODEL)
    structured_llm = llm.with_structured_output(GameDesign)

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(
            content=(
                "Conçois un jeu de société pour navigateur à partir de ce concept :\n\n"
                f"{state.concept}"
            )
        ),
    ]

    design: GameDesign = _invoke_design(structured_llm, messages)

    # game_mechanics : JSON compact — lu par l'agent Developer
    mechanics_payload = {
        "player_count": f"{design.player_count_min}–{design.player_count_max} joueurs",
        "objective": design.objective,
        "mechanics": design.mechanics,
    }

    # game_rules : Markdown structuré — lu par Testeur et Documentaliste
    turn_steps = "\n".join(
        f"{i + 1}. {step}" for i, step in enumerate(design.turn_structure)
    )
    rules_md = (
        f"## Déroulement d'un tour\n\n"
        f"{turn_steps}\n\n"
        f"## Conditions de victoire\n\n"
        f"{design.victory_conditions}\n"
    )

    # components_description : liste Markdown — lu par Asset Generator
    components_md = "\n".join(f"- {c}" for c in design.components)

    return {
        "game_name": design.game_name,
        "game_mechanics": json.dumps(mechanics_payload, ensure_ascii=False, indent=2),
        "game_rules": rules_md,
        "components_description": components_md,
        "current_step": "designer_done",
    }
