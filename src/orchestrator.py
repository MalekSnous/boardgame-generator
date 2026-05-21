"""
Orchestrateur multi-agent pour la génération de jeux de société.

Flux : Designer → Développeur → Asset Generator → Testeur → Documentaliste
"""

from __future__ import annotations

import sys
import time
from typing import Annotated, Optional

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field, field_validator

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

    # --- Assets manifest (Agent Designer → Developer + Asset Generator) ---
    asset_manifest: list[str] = Field(default_factory=list)

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
    fixes_required: list[str] = Field(default_factory=list)

    # --- Documentation (Agent Documentaliste) ---
    rules_md: Optional[str] = None
    readme_md: Optional[str] = None

    # --- Métadonnées ---
    current_step: str = "init"
    errors: list[str] = Field(default_factory=list)
    retry_count: int = 0

    # Messages LangChain pour le contexte conversationnel des agents
    messages: Annotated[list, add_messages] = Field(default_factory=list)

    @field_validator("assets", mode="before")
    @classmethod
    def coerce_assets(cls, v):
        if isinstance(v, dict):
            return GameAssets(**v)
        return v


# ---------------------------------------------------------------------------
# Stubs des agents (à implémenter un par un)
# ---------------------------------------------------------------------------

def _timed_agent(name: str, run_fn, state: GameState) -> dict:
    """Exécute un agent, mesure le temps et logue le résultat."""
    from src.utils.logger import get_logger
    t0 = time.time()
    error_msg: str | None = None
    result: dict = {}
    try:
        result = run_fn(state)
        return result
    except Exception as exc:
        error_msg = str(exc)
        raise
    finally:
        logger = get_logger()
        if logger:
            logger.log_step(
                agent=name,
                duration_s=time.time() - t0,
                input_keys=[k for k, v in state.model_dump().items() if v is not None and v != [] and v != {}],
                output_keys=list(result.keys()),
                success=error_msg is None,
                error=error_msg,
            )


def agent_designer(state: GameState) -> dict:
    """Conçoit les règles, la mécanique et les composants du jeu."""
    from src.agents import designer as _designer
    return _timed_agent("designer", _designer.run, state)


def agent_developer(state: GameState) -> dict:
    """Génère index.html, style.css et game.js."""
    from src.agents import developer as _developer
    return _timed_agent("developer", _developer.run, state)


def agent_asset_generator(state: GameState) -> dict:
    """Crée les assets SVG (pièces, plateau, icônes)."""
    from src.agents import asset_generator as _asset_generator
    return _timed_agent("asset_generator", _asset_generator.run, state)


def agent_tester(state: GameState) -> dict:
    """Vérifie la cohérence des règles et la validité du code."""
    from src.agents import tester as _tester
    return _timed_agent("tester", _tester.run, state)


def agent_documentalist(state: GameState) -> dict:
    """Rédige rules.md et README.md."""
    from src.agents import documentalist as _documentalist
    return _timed_agent("documentalist", _documentalist.run, state)


# ---------------------------------------------------------------------------
# Sauvegarde des fichiers générés
# ---------------------------------------------------------------------------

def save_output(state: GameState, output_dir: str) -> None:
    """Écrit les fichiers du jeu dans output_dir."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    files = {
        "index.html": state.index_html,
        "style.css":  state.style_css,
        "game.js":    state.game_js,
        "rules.md":   state.rules_md,
        "README.md":  state.readme_md,
    }
    for filename, content in files.items():
        if content:
            with open(os.path.join(output_dir, filename), "w", encoding="utf-8") as f:
                f.write(content)

    if state.assets.contents:
        assets_dir = os.path.join(output_dir, "assets")
        os.makedirs(assets_dir, exist_ok=True)
        for filename, svg in state.assets.contents.items():
            with open(os.path.join(assets_dir, filename), "w", encoding="utf-8") as f:
                f.write(svg)


# ---------------------------------------------------------------------------
# Routage conditionnel (exemple : retry depuis le testeur)
# ---------------------------------------------------------------------------

MAX_RETRIES = 3


def route_after_tester(state: GameState) -> str:
    """Redirige vers le développeur si les tests échouent et qu'on n'a pas atteint MAX_RETRIES."""
    if not state.validation_passed and state.retry_count < MAX_RETRIES:
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

def run(concept: str, output_dir: str | None = None) -> GameState:
    """Lance la génération d'un jeu à partir d'un concept textuel."""
    from src.utils.logger import init_logger
    logger = init_logger()
    try:
        graph = build_graph().compile()
        initial_state = GameState(concept=concept)
        final_state = graph.invoke(initial_state)
        state = GameState(**final_state)
        _out = output_dir or f"output/{state.game_name}"
        save_output(state, _out)
        return state
    finally:
        logger.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m src.orchestrator '<concept du jeu>'")
        sys.exit(1)

    concept = " ".join(sys.argv[1:])
    result = run(concept)
    print(f"Jeu généré : {result.game_name}")
