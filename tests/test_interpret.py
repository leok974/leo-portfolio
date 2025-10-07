import pytest
from assistant_api.agent.interpret import parse_command


def test_parse_rename_by_repo():
    """Test rename command with repo path."""
    plan, params = parse_command("rename leok974/leo-portfolio to siteAgent")
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params == {"rename": {"repo": "leok974/leo-portfolio", "to": "siteAgent"}}


def test_parse_rename_by_title():
    """Test rename command with title."""
    plan, params = parse_command("rename leo-portfolio to siteAgent")
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params == {"rename": {"from": "leo-portfolio", "to": "siteAgent"}}


def test_parse_set_brand():
    """Test set brand command."""
    plan, params = parse_command("set brand to LEO KLEMET — SITEAGENT")
    assert plan == ["overrides.update", "status.write"]
    assert params == {"brand": "LEO KLEMET — SITEAGENT"}


def test_parse_set_logo_for_repo():
    """Test set logo for repo command."""
    plan, params = parse_command("set logo for repo leok974/leo-portfolio to assets/logos/siteAgent.png")
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params == {"logo": {"repo": "leok974/leo-portfolio", "path": "assets/logos/siteAgent.png"}}


def test_parse_set_logo_for_title():
    """Test set logo for title command."""
    plan, params = parse_command("set logo for siteAgent to assets/logos/siteAgent.png")
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params == {"logo": {"title": "siteAgent", "path": "assets/logos/siteAgent.png"}}


def test_parse_regenerate_og():
    """Test regenerate og command."""
    plan, params = parse_command("regenerate og")
    assert plan == ["og.generate", "status.write"]
    assert params == {}


def test_parse_generate_og():
    """Test generate og command."""
    plan, params = parse_command("generate og images")
    assert plan == ["og.generate", "status.write"]
    assert params == {}


def test_parse_empty_command():
    """Test empty command returns empty plan."""
    plan, params = parse_command("")
    assert plan == []
    assert params == {}


def test_parse_invalid_command():
    """Test invalid command returns empty plan."""
    plan, params = parse_command("do something random")
    assert plan == []
    assert params == {}


def test_parse_case_insensitive():
    """Test commands are case insensitive."""
    plan1, params1 = parse_command("RENAME leo-portfolio TO siteAgent")
    plan2, params2 = parse_command("rename leo-portfolio to siteAgent")
    assert plan1 == plan2
    assert params1 == params2


def test_parse_with_extra_whitespace():
    """Test commands with extra whitespace."""
    plan, params = parse_command("  rename  leo-portfolio  to  siteAgent  ")
    assert plan == ["overrides.update", "og.generate", "status.write"]
    assert params == {"rename": {"from": "leo-portfolio", "to": "siteAgent"}}


def test_parse_scan_media():
    """Test scan media command."""
    plan, params = parse_command("scan media")
    assert plan == ["media.scan", "status.write"]
    assert params == {}


def test_parse_optimize_images():
    """Test optimize images command."""
    plan, params = parse_command("optimize images")
    assert plan == ["media.scan", "media.optimize", "status.write"]
    assert params == {}


def test_parse_optimize_pictures():
    """Test optimize pictures command (synonym)."""
    plan, params = parse_command("optimise pictures")
    assert plan == ["media.scan", "media.optimize", "status.write"]
    assert params == {}


def test_parse_suggest_link_fixes():
    """Test suggest link fixes command."""
    plan, params = parse_command("suggest link fixes")
    assert plan == ["links.suggest", "status.write"]
    assert params == {}


def test_parse_recommend_link_fix():
    """Test recommend link fix command (synonym)."""
    plan, params = parse_command("recommend link fix")
    assert plan == ["links.suggest", "status.write"]
    assert params == {}
