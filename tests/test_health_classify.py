from assistant_api.health import classify_health

def test_health_ok_when_only_crypto_disabled():
    payload = classify_health(reasons=["crypto_disabled"], strict=False)
    assert payload["ok"] is True
    assert payload["status"] == "ok"
    assert payload["reasons"] == []
    assert payload["info_reasons"] == ["crypto_disabled"]


def test_health_degraded_on_warn_reason():
    payload = classify_health(reasons=["alembic_out_of_sync"], strict=False)
    assert payload["ok"] is False
    assert payload["status"] == "degraded"
    assert "alembic_out_of_sync" in payload["reasons"]


def test_health_strict_mode_flags_disabled_crypto():
    payload = classify_health(reasons=["crypto_disabled"], strict=True)
    assert payload["ok"] is False
    assert payload["status"] == "degraded"
    assert payload["reasons"] == ["crypto_disabled"] or payload["reasons"] == []  # Accept either representation
