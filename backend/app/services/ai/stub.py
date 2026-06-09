"""Deterministic stub provider for local dev / tests (no external API)."""

from typing import Any

from app.services.ai.base import AIProvider


class StubProvider(AIProvider):
    name = "stub"

    async def generate_questions(self, spec: dict[str, Any]) -> list[dict]:
        topic = spec.get("topic", "general")
        difficulty = spec.get("difficulty", "medium")
        count = int(spec.get("count", 3))
        qtype = spec.get("type", "mcq")
        out: list[dict] = []
        for i in range(count):
            if qtype in ("mcq", "multi_select"):
                out.append({
                    "type": qtype,
                    "prompt": f"[{topic}] Sample question {i + 1}?",
                    "difficulty": difficulty,
                    "payload": {
                        "options": [
                            {"key": "a", "text": "Option A"},
                            {"key": "b", "text": "Option B"},
                            {"key": "c", "text": "Option C"},
                        ],
                        "correct_keys": ["a"],
                    },
                })
            else:
                out.append({
                    "type": "text",
                    "prompt": f"[{topic}] Explain concept {i + 1}.",
                    "difficulty": difficulty,
                    "payload": {"sample_answer": "", "rubric": "Clarity and correctness."},
                })
        return out

    async def score_text(self, req: dict[str, Any]) -> dict:
        max_points = float(req.get("max_points", 1))
        answer = (req.get("answer") or "").strip()
        # Naive heuristic: longer answers get more credit, capped.
        ratio = min(1.0, len(answer) / 200) if answer else 0.0
        score = round(max_points * ratio, 2)
        return {
            "score": score,
            "rationale": f"Stub score based on answer length ({len(answer)} chars).",
        }
