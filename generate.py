#!/usr/bin/env python3
"""
Génère un jeu de société complet à partir d'un concept et écrit les fichiers
dans output/<nom_du_jeu>/.

Usage :
    python generate.py "<concept du jeu>"
    python generate.py "un jeu de stratégie médiévale pour 2-4 joueurs"
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OUTPUT_DIR = Path("output")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Convertit un nom de jeu en nom de dossier filesystem-safe."""
    slug = text.lower().strip()
    slug = re.sub(r"[àâä]", "a", slug)
    slug = re.sub(r"[éèêë]", "e", slug)
    slug = re.sub(r"[îï]", "i", slug)
    slug = re.sub(r"[ôö]", "o", slug)
    slug = re.sub(r"[ùûü]", "u", slug)
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "_", slug)
    return slug.strip("_") or "game"


def write_file(path: Path, content: str | None) -> bool:
    """Écrit content dans path. Retourne True si le fichier a été écrit."""
    if not content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def write_output(state, game_dir: Path) -> dict[str, list[Path]]:
    """
    Écrit tous les fichiers du GameState dans game_dir.
    Retourne un dict {"written": [...], "skipped": [...]} pour le rapport.
    """
    written: list[Path] = []
    skipped: list[Path] = []

    def _w(path: Path, content: str | None):
        (written if write_file(path, content) else skipped).append(path)

    _w(game_dir / "index.html",  state.index_html)
    _w(game_dir / "style.css",   state.style_css)
    _w(game_dir / "game.js",     state.game_js)
    _w(game_dir / "rules.md",    state.rules_md)
    _w(game_dir / "README.md",   state.readme_md)

    for filename in state.assets.filenames:
        svg = state.assets.contents.get(filename)
        _w(game_dir / "assets" / filename, svg)

    return {"written": written, "skipped": skipped}


def print_report(state, game_dir: Path, result: dict[str, list[Path]]) -> None:
    written  = result["written"]
    skipped  = result["skipped"]
    val_icon = "✅" if state.validation_passed else "⚠️ "

    print()
    print(f"  Jeu          : {state.game_name}")
    print(f"  Dossier      : {game_dir}/")
    print(f"  Validation   : {val_icon} {'passée' if state.validation_passed else 'partielle'}")
    print()

    if written:
        print("  Fichiers écrits :")
        for f in written:
            size = f.stat().st_size
            print(f"    {str(f.relative_to(OUTPUT_DIR.parent)):<45}  {size:>6} octets")

    if skipped:
        print()
        print("  Fichiers manquants (agent non exécuté ou sortie vide) :")
        for f in skipped:
            print(f"    {str(f.relative_to(OUTPUT_DIR.parent))}")

    if state.validation_errors:
        print()
        print("  Problèmes détectés par le Testeur :")
        for err in state.validation_errors:
            print(f"    • {err}")

    print()
    if "index.html" in [f.name for f in written]:
        abs_path = (OUTPUT_DIR.parent / game_dir / "index.html").resolve()
        print(f"  Ouvrir dans le navigateur :")
        print(f"    open {abs_path}")
    print()


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage : python generate.py '<concept du jeu>'")
        print("Exemple : python generate.py 'un jeu de dés coopératif pour 2-4 joueurs'")
        sys.exit(1)

    concept = " ".join(sys.argv[1:])

    print()
    print("=" * 60)
    print("  BOARDGAME GENERATOR")
    print("=" * 60)
    print(f"  Concept : « {concept} »")
    print("  Pipeline : Designer → Developer → Assets → Tester → Docs")
    print("=" * 60)
    print()

    from src.orchestrator import run  # import tardif pour que load_dotenv() soit effectif

    state = run(concept)

    slug     = slugify(state.game_name or concept)
    game_dir = OUTPUT_DIR / slug

    result = write_output(state, game_dir)
    print_report(state, game_dir, result)


if __name__ == "__main__":
    main()
