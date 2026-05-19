"""
Orchestrateur multi-agent pour la génération de jeux de société.

Flux : Designer → Développeur → Asset Generator → Testeur → Documentaliste
"""

from __future__ import annotations

import sys
from typing import Annotated, Optional

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field

load_dotenv()

MODEL = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# GameState — état partagé entre tous les agents
# ---------------------------------------------------------------------------

class GameAssets(BaseModel):
    """Fichiers SVG générés par l'agent Asset Generator."""
    filenames: list[str] = Field(default_factory=list)
    contents: dict[str, str] = Field(default_factory=dict)  # filename → SVG


class GameOutput(BaseModel):
    """Fichiers finaux constituant le jeu jouable."""
    index_html: Optional[str] = None
    style_css: Optional[str] = None
    game_js: Optional[str] = None
    assets: GameAssets = Field(default_factory=GameAssets)
    rules_md: Optional[str] = None
    readme_md: Optional[str] = None


class GameState(BaseModel):
    """État partagé transmis entre les agents du graph LangGraph."""

    # --- Entrée utilisateur ---
    concept: str = Field(description="Description textuelle du jeu à créer")

    # --- Design (Agent Designer) ---
    game_name: Optional[str] = None
    game_rules: Optional[str] = None          # règles détaillées en Markdown
    game_mechanics: Optional[str] = None       # mécanique centrale
    components_description: Optional[str] = None  # pièces, plateau, cartes…

    # --- Code (Agent Développeur) ---
    game_js: Optional[str] = None
    index_html: Optional[str] = None
    style_css: Optional[str] = None

    # --- Assets (Agent Asset Generator) ---
    assets: GameAssets = Field(default_factory=GameAssets)

    # --- Tests (Agent Testeur) ---
    test_results: Optional[str] = None
    validation_passed: bool = False
    validation_errors: list[str] = Field(default_factory=list)

    # --- Documentation (Agent Documentaliste) ---
    rules_md: Optional[str] = None
    readme_md: Optional[str] = None

    # --- Métadonnées ---
    current_step: str = "init"
    errors: list[str] = Field(default_factory=list)

    # Messages LangChain pour le contexte conversationnel des agents
    messages: Annotated[list, add_messages] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Stubs des agents (à implémenter un par un)
# ---------------------------------------------------------------------------

def agent_designer(state: GameState) -> dict:
    """Conçoit les règles, la mécanique et les composants du jeu."""
    from src.agents import designer as _designer
    return _designer.run(state)


def agent_developer(state: GameState) -> dict:
    """Génère index.html, style.css et game.js."""
    from src.agents import developer as _developer
    return _developer.run(state)


def agent_asset_generator(state: GameState) -> dict:
    """Crée les assets SVG (pièces, plateau, icônes)."""
    from src.agents import asset_generator as _asset_generator
    return _asset_generator.run(state)


def agent_tester(state: GameState) -> dict:
    """Vérifie la cohérence des règles et la validité du code."""
    from src.agents import tester as _tester
    return _tester.run(state)


def agent_documentalist(state: GameState) -> dict:
    """Rédige rules.md et README.md."""
    from src.agents import documentalist as _documentalist
    return _documentalist.run(state)


# ---------------------------------------------------------------------------
# Routage conditionnel (exemple : retry depuis le testeur)
# ---------------------------------------------------------------------------

def route_after_tester(state: GameState) -> str:
    """Redirige vers le développeur si les tests échouent, sinon continue."""
    if not state.validation_passed:
        return "developer"
    return "documentalist"


# ---------------------------------------------------------------------------
# Construction du graph LangGraph
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    graph = StateGraph(GameState)

    # Déclaration des nœuds
    graph.add_node("designer", agent_designer)
    graph.add_node("developer", agent_developer)
    graph.add_node("asset_generator", agent_asset_generator)
    graph.add_node("tester", agent_tester)
    graph.add_node("documentalist", agent_documentalist)

    # Edges fixes
    graph.add_edge(START, "designer")
    graph.add_edge("designer", "developer")
    graph.add_edge("developer", "asset_generator")
    graph.add_edge("asset_generator", "tester")

    # Edge conditionnel depuis le testeur
    graph.add_conditional_edges(
        "tester",
        route_after_tester,
        {"developer": "developer", "documentalist": "documentalist"},
    )

    graph.add_edge("documentalist", END)

    return graph


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def run(concept: str) -> GameState:
    """Lance la génération d'un jeu à partir d'un concept textuel."""
    graph = build_graph().compile()
    initial_state = GameState(concept=concept)
    final_state = graph.invoke(initial_state)
    return GameState(**final_state)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m src.orchestrator '<concept du jeu>'")
        sys.exit(1)

    concept = " ".join(sys.argv[1:])
    result = run(concept)
    print(f"Jeu généré : {result.game_name}")
