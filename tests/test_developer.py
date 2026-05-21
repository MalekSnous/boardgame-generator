"""Tests unitaires pour les fonctions utilitaires de src/agents/developer.py — sans appel LLM."""

from __future__ import annotations

from src.agents.developer import _extract_code_block, _game_context, _strip_markdown_fences
from src.orchestrator import GameState


def test_strip_markdown_fences_with_lang():
    code = "```javascript\nconst x = 1;\n```"
    assert _strip_markdown_fences(code) == "const x = 1;"


def test_strip_markdown_fences_no_fences():
    code = "const x = 1;\nconst y = 2;"
    assert _strip_markdown_fences(code) == code


def test_strip_markdown_fences_plain_backticks():
    code = "```\nsome code\n```"
    assert _strip_markdown_fences(code) == "some code"


def test_extract_code_block_with_lang():
    text = "Voici le code :\n```javascript\nconst x = 1;\n```\nFin."
    assert _extract_code_block(text, "javascript") == "const x = 1;"


def test_extract_code_block_fallback():
    text = "Intro\n```python\nx = 1\n```\nFin."
    # lang=javascript not found → fallback to any block
    assert _extract_code_block(text, "javascript") == "x = 1"


def test_extract_code_block_no_fences():
    text = "just raw code here"
    assert _extract_code_block(text, "javascript") == "just raw code here"


def test_game_context_valid_json():
    state = GameState(
        concept="test",
        game_name="Mon Jeu",
        game_mechanics='{"player_count": "2", "objective": "Gagner", "mechanics": ["Dés", "Cartes"]}',
        game_rules="# Règles\nJouer à tour de rôle.",
        components_description="2 dés, 52 cartes",
    )
    ctx = _game_context(state)
    assert "Mon Jeu" in ctx
    assert "Gagner" in ctx
    assert "Dés" in ctx
    assert "Cartes" in ctx


def test_game_context_invalid_json():
    state = GameState(
        concept="test",
        game_name="Mon Jeu",
        game_mechanics="not valid json {{{",
        game_rules="# Règles",
        components_description="composants",
    )
    # Should not raise, just produce partial context
    ctx = _game_context(state)
    assert "Mon Jeu" in ctx
