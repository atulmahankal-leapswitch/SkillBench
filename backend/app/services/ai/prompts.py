"""Prompt builders shared across AI providers."""

from typing import Any

GENERATE_SYSTEM = (
    "You are an assessment author. Respond with ONLY a JSON array, no prose."
)


_SCHEMAS = {
    "mcq": (
        '{"type":"mcq","prompt":"...","difficulty":"D","payload":'
        '{"options":[{"key":"a","text":"..."},{"key":"b","text":"..."}],'
        '"correct_keys":["a"]}}'
    ),
    "multi_select": (
        '{"type":"multi_select","prompt":"...","difficulty":"D","payload":'
        '{"options":[{"key":"a","text":"..."}],"correct_keys":["a","b"]}}'
    ),
    "text": (
        '{"type":"text","prompt":"...","difficulty":"D","payload":'
        '{"sample_answer":"...","rubric":"..."}}'
    ),
}


def generate_questions_prompt(spec: dict[str, Any]) -> str:
    topic = spec.get("topic", "general knowledge")
    qtype = spec.get("type", "mcq")
    difficulty = spec.get("difficulty", "medium")
    count = int(spec.get("count", 3))
    schema = _SCHEMAS.get(qtype, "").replace('"D"', f'"{difficulty}"')
    return (
        f"Generate {count} {difficulty} {qtype} assessment questions about "
        f"'{topic}'. Return a JSON array where each item matches this shape: "
        f"{schema}. Keep prompts concise and unambiguous."
    )


SCORE_SYSTEM = (
    "You are a strict but fair grader. Respond with ONLY JSON: "
    '{"score": <number 0..max_points>, "rationale": "<short>"}'
)


def score_text_prompt(req: dict[str, Any]) -> str:
    return (
        f"Question: {req.get('prompt', '')}\n"
        f"Rubric: {req.get('rubric', '(none)')}\n"
        f"Sample answer: {req.get('sample_answer', '(none)')}\n"
        f"Max points: {req.get('max_points', 1)}\n"
        f"Candidate answer: {req.get('answer', '')}\n\n"
        "Score the candidate answer."
    )
