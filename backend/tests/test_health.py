"""Smoke test for the liveness endpoint (no DB required)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["name"] == "SkillBench API"
