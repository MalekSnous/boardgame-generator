"""
Agent Testeur — révise le code JS, vérifie l'implémentation des règles,
et renvoie au Développeur si des erreurs bloquantes sont détectées.

Entrée  : game_name, game_rules, game_mechanics, game_js, index_html
Sorties : test_results (str), validation_passed (bool), validation_errors (list)

Boucle de retry : encode le compteur dans state.errors (préfixe "TESTER_RETRY").
Après MAX_RETRIES tentatives infructueuses, force validation_passed=True pour
sortir de la boucle et laisser le Documentaliste conclure malgré les défauts.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from src.orchestrator import GameState

MODEL = "claude-sonnet-4-6"
MAX_RETRIES = 2
_RETRY_MARKER = "TESTER_RETRY"

_SYSTEM_PROMPT = """\
Tu es un testeur QA expert spécialisé dans les jeux de société en HTML/CSS/JavaScript vanilla.
Tu révises le code généré et le confrontes aux règles du Designer pour détecter
les problèmes fonctionnels bloquants.

### Ce qui justifie un échec (passed = false)

Renvoie au Developer UNIQUEMENT si au moins un de ces problèmes est présent :

1. **Initialisation absente** — gameState n'est pas initialisé, le jeu ne peut pas démarrer.
2. **Tour de jeu cassé** — le joueur actif ne change pas, ou les actions ne modifient pas l'état.
3. **Condition de victoire manquante** — la règle de fin de partie n'est pas implémentée.
4. **Event listeners absents ou déconnectés** — les clics/interactions ne font rien.
5. **Erreur JS critique évidente** — variable clé utilisée sans être déclarée, appel de méthode
   sur `undefined`, boucle infinie probable.
6. **Contradiction majeure** — une mécanique centrale des règles est complètement ignorée dans le code.

### Ce qui NE justifie PAS un échec

- Imperfections CSS ou manque d'animations
- Code non optimisé ou verbeux
- Fonctionnalités secondaires manquantes (sons, historique, undo)
- Style et conventions de nommage

### Format des corrections si échec

Chaque item de `fixes_required` doit être une instruction précise et actionnable :
  ✗ "Corriger la gestion des tours"
  ✓ "La fonction `nextPlayer()` ne met pas à jour `gameState.currentPlayer` —
     ajouter `gameState.currentPlayer = (gameState.currentPlayer % nbPlayers) + 1;`"

Sois chirurgical : indique le nom de la fonction ou de la variable concernée.\
"""


class ReviewResult(BaseModel):
    """Résultat structuré de la révision du code."""

    passed: bool = Field(
        description=(
            "true si le jeu est fonctionnellement jouable. "
            "false uniquement si des erreurs bloquantes sont présentes."
        )
    )
    critical_errors: list[str] = Field(
        default_factory=list,
        description="Erreurs bloquantes empêchant le jeu de fonctionner (vide si passed=true)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Problèmes mineurs non bloquants, pour information uniquement",
    )
    fixes_required: list[str] = Field(
        default_factory=list,
        description=(
            "Instructions précises pour le Developer si passed=false. "
            "Une correction par item, avec nom de fonction/variable concernée."
        ),
    )
    summary: str = Field(description="Résumé de la révision en 2-4 phrases")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _count_retries(errors: list[str]) -> int:
    return sum(1 for e in errors if e.startswith(_RETRY_MARKER))


def _build_prompt(state: GameState, retry_n: int) -> str:
    try:
        mechanics = json.loads(state.game_mechanics or "{}")
    except json.JSONDecodeError:
        mechanics = {}

    retry_note = (
        f"\n> ⚠️ TENTATIVE {retry_n + 1}/{MAX_RETRIES} — "
        "sois particulièrement attentif aux corrections demandées lors de la passe précédente.\n"
        if retry_n > 0
        else ""
    )

    player_count = mechanics.get("player_count", "")
    objective = mechanics.get("objective", "")
    mechanic_list = "\n".join(f"- {m}" for m in mechanics.get("mechanics", []))

    return f"""Révise le code du jeu **{state.game_name}** et vérifie qu'il implémente correctement les règles.
{retry_note}
## Règles du Designer (référence)

**Joueurs :** {player_count}
**Objectif :** {objective}

**Mécaniques :**
{mechanic_list}

{state.game_rules}

## Code à réviser

### index.html
```html
{state.index_html or "(absent)"}
```

### game.js
```javascript
{state.game_js or "(absent)"}
```

Confronte chaque règle et mécanique au code. Identifie les erreurs bloquantes uniquement."""


def _format_test_results(result: ReviewResult, retry_n: int, forced: bool) -> str:
    status = "VALIDÉ" if result.passed else "ÉCHEC"
    if forced:
        status = "VALIDÉ (limite de retries atteinte)"

    lines = [
        f"## Résultats du Testeur — tentative {retry_n + 1}",
        f"**Statut :** {status}",
        "",
    ]

    if result.critical_errors:
        lines += ["### Erreurs critiques"] + [f"- {e}" for e in result.critical_errors] + [""]

    if result.warnings:
        lines += ["### Avertissements"] + [f"- {w}" for w in result.warnings] + [""]

    if result.fixes_required:
        lines += ["### Corrections demandées au Developer"] + [f"- {f}" for f in result.fixes_required] + [""]

    lines += ["### Résumé", result.summary]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def run(state: GameState) -> dict:
    """Révise le code, décide de passer ou renvoyer au Developer."""
    retry_n = _count_retries(state.errors)
    forced_pass = retry_n >= MAX_RETRIES

    if forced_pass:
        # Sortie forcée de la boucle : le Documentaliste prend le relais
        summary = (
            f"Limite de {MAX_RETRIES} tentatives atteinte. "
            "Le code est transmis au Documentaliste avec les défauts connus."
        )
        return {
            "test_results": _format_test_results(
                ReviewResult(passed=True, summary=summary), retry_n, forced=True
            ),
            "validation_passed": True,
            "validation_errors": state.validation_errors,  # conserve les erreurs précédentes
            "current_step": "tester_done_forced",
        }

    llm = ChatAnthropic(model=MODEL, max_tokens=2048)
    structured_llm = llm.with_structured_output(ReviewResult)

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=_build_prompt(state, retry_n)),
    ]

    result: ReviewResult = structured_llm.invoke(messages)

    # Mise à jour du compteur de retries dans errors si on renvoie au Developer
    updated_errors = list(state.errors)
    if not result.passed:
        updated_errors.append(f"{_RETRY_MARKER}:{retry_n + 1}")

    return {
        "test_results": _format_test_results(result, retry_n, forced=False),
        "validation_passed": result.passed,
        "validation_errors": result.critical_errors,
        "errors": updated_errors,
        "current_step": "tester_done",
    }
