"""Logger JSON-lines pour le pipeline multi-agent."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

_instance: "PipelineLogger | None" = None


class PipelineLogger:
    def __init__(self) -> None:
        Path("logs").mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.path = Path(f"logs/run_{ts}.json")
        self._file = self.path.open("w", encoding="utf-8")

    def log_step(
        self,
        agent: str,
        duration_s: float,
        input_keys: list[str],
        output_keys: list[str],
        success: bool,
        error: str | None = None,
    ) -> None:
        entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": agent,
            "duration_s": round(duration_s, 3),
            "input_keys": input_keys,
            "output_keys": output_keys,
            "success": success,
            "error": error,
        }
        self._file.write(json.dumps(entry, ensure_ascii=False) + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()


def init_logger() -> PipelineLogger:
    global _instance
    _instance = PipelineLogger()
    return _instance


def get_logger() -> "PipelineLogger | None":
    return _instance
