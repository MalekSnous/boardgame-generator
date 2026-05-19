"""Décorateur de retry avec backoff exponentiel pour les appels LLM."""

from __future__ import annotations

import functools
import time

import anthropic


def with_retry(max_attempts: int = 3, base_delay: float = 2.0):
    """Réessaie la fonction décorée sur RateLimitError, APITimeoutError, APIConnectionError."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except (
                    anthropic.RateLimitError,
                    anthropic.APITimeoutError,
                    anthropic.APIConnectionError,
                ) as e:
                    last_exc = e
                    if attempt < max_attempts - 1:
                        delay = base_delay * (2 ** attempt)
                        time.sleep(delay)
            raise last_exc  # type: ignore[misc]
        return wrapper
    return decorator
