"""Tests unitaires pour src/orchestrator.py — sans appel LLM."""

from __future__ import annotations

import os
import tempfile

from src.orchestrator import (
    MAX_RETRIES,
    GameAssets,
    GameState,
    route_after_tester,
    save_output,
)


def test_gamestate_default_values():
    state = GameState(concept="test")
    assert state.concept == "test"
    assert state.game_name is None
    assert state.validation_passed is False
    assert state.retry_count == 0
    assert state.errors == []
    assert state.validation_errors == []
    assert state.current_step == "init"


def test_gamestate_assets_coercion():
    """GameState accepte un dict pour assets et le coerce en GameAssets."""
    state = GameState(concept="test", assets={"filenames": ["a.svg"], "contents": {}})
    assert isinstance(state.assets, GameAssets)
    assert state.assets.filenames == ["a.svg"]


def test_route_after_tester_passes():
    state = GameState(concept="test", validation_passed=True)
    assert route_after_tester(state) == "documentalist"


def test_route_after_tester_fails_under_max():
    state = GameState(concept="test", validation_passed=False, retry_count=0)
    assert route_after_tester(state) == "developer"


def test_route_after_tester_fails_at_max():
    state = GameState(concept="test", validation_passed=False, retry_count=MAX_RETRIES)
    assert route_after_tester(state) == "documentalist"


def test_save_output_creates_files():
    state = GameState(
        concept="test",
        index_html="<html></html>",
        style_css="body {}",
        game_js="var x = 1;",
        rules_md="# Rules",
        readme_md="# README",
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        save_output(state, tmpdir)
        assert os.path.exists(os.path.join(tmpdir, "index.html"))
        assert os.path.exists(os.path.join(tmpdir, "style.css"))
        assert os.path.exists(os.path.join(tmpdir, "game.js"))
        assert os.path.exists(os.path.join(tmpdir, "rules.md"))
        assert os.path.exists(os.path.join(tmpdir, "README.md"))


def test_save_output_writes_assets():
    state = GameState(
        concept="test",
        assets=GameAssets(
            filenames=["piece.svg"],
            contents={"piece.svg": "<svg/>"},
        ),
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        save_output(state, tmpdir)
        assert os.path.exists(os.path.join(tmpdir, "assets", "piece.svg"))
        with open(os.path.join(tmpdir, "assets", "piece.svg")) as f:
            assert f.read() == "<svg/>"
