"""Tests unitaires pour les helpers de src/agents/tester.py — sans appel LLM."""

from __future__ import annotations

from src.agents.tester import ReviewResult, _build_prompt, _format_test_results
from src.orchestrator import GameState


def _make_review(passed: bool, errors=None, fixes=None, warnings=None) -> ReviewResult:
    return ReviewResult(
        passed=passed,
        critical_errors=errors or [],
        fixes_required=fixes or [],
        warnings=warnings or [],
        summary="Résumé de test.",
    )


def test_format_test_results_passed():
    result = _make_review(passed=True)
    text = _format_test_results(result, retry_n=0, forced=False)
    assert "VALIDÉ" in text
    assert "tentative 1" in text


def test_format_test_results_failed_shows_errors():
    result = _make_review(
        passed=False,
        errors=["gameState non initialisé"],
        fixes=["Déclarer gameState avant DOMContentLoaded"],
    )
    text = _format_test_results(result, retry_n=0, forced=False)
    assert "ÉCHEC" in text
    assert "gameState non initialisé" in text
    assert "Déclarer gameState" in text


def test_format_test_results_forced():
    result = _make_review(passed=False)
    text = _format_test_results(result, retry_n=2, forced=True)
    assert "limite de retries" in text


def test_build_prompt_no_retry():
    state = GameState(
        concept="test",
        game_name="Test Game",
        game_mechanics='{"player_count": "2", "objective": "Win", "mechanics": []}',
        game_rules="# Rules",
        index_html="<html/>",
        game_js="var x = 1;",
    )
    prompt = _build_prompt(state, retry_n=0)
    assert "Test Game" in prompt
    assert "TENTATIVE" not in prompt


def test_build_prompt_with_retry_note():
    state = GameState(
        concept="test",
        game_name="Test Game",
        game_mechanics='{"player_count": "2", "objective": "Win", "mechanics": []}',
        game_rules="# Rules",
        index_html="<html/>",
        game_js="var x = 1;",
    )
    prompt = _build_prompt(state, retry_n=1)
    assert "TENTATIVE 2" in prompt
