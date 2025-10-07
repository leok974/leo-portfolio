"""
Tests for /resume/generate.md and /resume/generate.json endpoints
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from assistant_api.main import app

client = TestClient(app)


def test_resume_markdown_no_content():
    """When no projects.json or index.html exists, should 404."""
    with patch("assistant_api.routers.resume_public._load_projects", return_value=[]):
        response = client.get("/resume/generate.md")
        assert response.status_code == 404
        assert "no_site_content" in response.json().get("detail", "")


def test_resume_json_no_content():
    """When no projects.json or index.html exists, JSON should 404."""
    with patch("assistant_api.routers.resume_public._load_projects", return_value=[]):
        response = client.get("/resume/generate.json")
        assert response.status_code == 404
        assert "no_site_content" in response.json().get("detail", "")


def test_resume_markdown_with_projects():
    """When projects exist, markdown should generate successfully."""
    mock_projects = [
        {
            "title": "Test Project",
            "slug": "test-project",
            "summary": "A test project for resume generation",
            "tags": ["python", "fastapi", "testing"],
            "cats": ["backend"],
            "links": ["https://github.com/test"],
            "year": "2025"
        }
    ]
    
    with patch("assistant_api.routers.resume_public._load_projects", return_value=mock_projects):
        response = client.get("/resume/generate.md")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"
        
        content = response.text
        assert "# Leo Klemet — LinkedIn Resume" in content
        assert "Test Project" in content
        assert "## About" in content
        assert "## Experience" in content
        assert "## Skills" in content
        assert "## Links" in content


def test_resume_json_structure():
    """JSON response should have correct structure."""
    mock_projects = [
        {
            "title": "Test Project",
            "slug": "test-project",
            "summary": "A test project",
            "tags": ["python"],
            "cats": [],
            "links": [],
            "year": "2025"
        }
    ]
    
    with patch("assistant_api.routers.resume_public._load_projects", return_value=mock_projects):
        response = client.get("/resume/generate.json")
        assert response.status_code == 200
        
        data = response.json()
        assert "headline" in data
        assert "about" in data
        assert "projects" in data
        assert "markdown" in data
        assert "year" in data
        
        # Verify projects structure
        assert len(data["projects"]) == 1
        assert data["projects"][0]["title"] == "Test Project"
        
        # Verify markdown is included
        assert "# Leo Klemet" in data["markdown"]
        assert data["year"] >= 2025


def test_resume_markdown_featured_ordering():
    """Featured projects should appear first in markdown."""
    mock_projects = [
        {"title": "Random Project", "summary": "Random", "tags": [], "cats": [], "links": [], "year": "2025", "slug": ""},
        {"title": "SiteAgent", "summary": "Featured", "tags": [], "cats": [], "links": [], "year": "2025", "slug": ""},
        {"title": "Another Project", "summary": "Another", "tags": [], "cats": [], "links": [], "year": "2025", "slug": ""},
    ]
    
    with patch("assistant_api.routers.resume_public._load_projects", return_value=mock_projects):
        response = client.get("/resume/generate.md")
        content = response.text
        
        # SiteAgent should appear before Random/Another
        siteagent_pos = content.find("SiteAgent")
        random_pos = content.find("Random Project")
        
        assert siteagent_pos < random_pos, "Featured project should appear first"
