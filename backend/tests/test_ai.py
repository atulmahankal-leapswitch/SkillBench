"""AI provider factory, stub provider, and JSON extraction."""

import pytest

from app.services import ai
from app.services.ai.base import extract_json
from app.services.ai.stub import StubProvider


def test_extract_json_handles_fenced_block():
    assert extract_json('```json\n[{"a": 1}]\n```') == [{"a": 1}]
    assert extract_json('noise {"x": 2} trailing') == {"x": 2}


@pytest.mark.asyncio
async def test_stub_generates_questions():
    qs = await StubProvider().generate_questions(
        {"topic": "python", "type": "mcq", "count": 2}
    )
    assert len(qs) == 2
    assert qs[0]["type"] == "mcq"
    assert qs[0]["payload"]["correct_keys"]


@pytest.mark.asyncio
async def test_stub_scores_text():
    res = await StubProvider().score_text(
        {"answer": "x" * 100, "max_points": 4}
    )
    assert 0 <= res["score"] <= 4
    assert "rationale" in res


def test_unknown_provider_disabled():
    cfg = ai.AIConfig(provider="", model="", api_key="")
    assert ai.is_enabled(cfg) is False
    with pytest.raises(ai.AIDisabled):
        ai.get_provider(cfg)


def test_stub_provider_enabled():
    cfg = ai.AIConfig(provider="stub", model="", api_key="")
    assert ai.is_enabled(cfg) is True


def test_anthropic_requires_key():
    cfg = ai.AIConfig(provider="anthropic", model="claude-x", api_key="")
    # No org key and (in tests) no env key -> disabled.
    assert ai.is_enabled(cfg) is False
