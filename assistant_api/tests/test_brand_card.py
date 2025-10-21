"""
Tests for brand asset generation endpoints.

Tests the /agent/brand/card endpoint and Figma MCP integration.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_figma_tools():
    """Mock Figma tools for testing without API calls."""
    with patch('assistant_api.routers.brand.figma_tools') as mock:
        mock.generate_card = AsyncMock(return_value='TEST_FILE_KEY_123')
        mock.export_nodes = AsyncMock(return_value={
            'png': ['/agent/artifacts/cards/test-card.png'],
            'pdf': ['/agent/artifacts/cards/test-card.pdf']
        })
        yield mock


@pytest.mark.asyncio
async def test_generate_card_success(client: TestClient, mock_figma_tools):
    """Test successful business card generation."""
    payload = {
        'name': 'Test User',
        'role': 'Software Engineer',
        'email': 'test@example.com',
        'domain': 'example.com',
        'qr_url': 'https://example.com'
    }

    # TODO: Add auth header once CF Access is configured
    response = client.post('/api/agent/brand/card', json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data['ok'] is True
    assert data['file_key'] == 'TEST_FILE_KEY_123'
    assert 'export' in data
    assert 'png' in data['export']
    assert len(data['export']['png']) > 0

    # Verify mocks were called correctly
    mock_figma_tools.generate_card.assert_called_once()
    call_args = mock_figma_tools.generate_card.call_args[0][0]
    assert call_args['name'] == 'Test User'
    assert call_args['role'] == 'Software Engineer'

    mock_figma_tools.export_nodes.assert_called_once_with(
        file_key='TEST_FILE_KEY_123',
        node_ids=['CardFront', 'CardBack'],
        fmt='png'
    )


@pytest.mark.asyncio
async def test_generate_card_missing_fields(client: TestClient):
    """Test card generation with missing required fields."""
    payload = {
        'name': 'Test User',
        # Missing role, email, domain
    }

    response = client.post('/api/agent/brand/card', json=payload)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_generate_card_figma_error(client: TestClient):
    """Test card generation when Figma API fails."""
    with patch('assistant_api.routers.brand.figma_tools') as mock:
        mock.generate_card = AsyncMock(side_effect=ValueError('FIGMA_PAT not configured'))

        payload = {
            'name': 'Test User',
            'role': 'Developer',
            'email': 'test@example.com',
            'domain': 'example.com'
        }

        response = client.post('/api/agent/brand/card', json=payload)
        assert response.status_code == 400
        assert 'FIGMA_PAT' in response.json()['detail']


@pytest.mark.asyncio
async def test_list_templates(client: TestClient):
    """Test templates listing endpoint."""
    response = client.get('/api/agent/brand/templates')

    assert response.status_code == 200
    data = response.json()

    assert data['ok'] is True
    assert 'templates' in data
    assert len(data['templates']) > 0

    # Check business card template exists
    templates = {t['id']: t for t in data['templates']}
    assert 'business_card' in templates
    assert templates['business_card']['type'] == 'card'


@pytest.mark.asyncio
async def test_get_design_tokens(client: TestClient):
    """Test design tokens endpoint."""
    response = client.get('/api/agent/brand/tokens')

    assert response.status_code == 200
    data = response.json()

    assert data['ok'] is True
    assert 'tokens' in data
    assert 'colors' in data['tokens']
    assert 'typography' in data['tokens']
    assert 'spacing' in data['tokens']


@pytest.mark.asyncio
async def test_audit_design_file(client: TestClient):
    """Test design file audit endpoint."""
    with patch('assistant_api.routers.brand.figma_tools') as mock:
        mock.audit_file = AsyncMock(return_value={
            'components': 42,
            'untyped_text': 3,
            'non_token_colors': 5
        })

        file_key = 'TEST_FILE_KEY'
        response = client.get(f'/api/agent/brand/audit/{file_key}')

        assert response.status_code == 200
        data = response.json()

        assert data['ok'] is True
        assert data['file_key'] == file_key
        assert 'audit' in data
        assert data['audit']['components'] == 42

        mock.audit_file.assert_called_once_with(file_key)


# TODO: Add Playwright e2e test
# Test flow:
# 1. Open Dev Overlay
# 2. Click Brand tab
# 3. Click "Generate Business Card"
# 4. Wait for preview image
# 5. Verify PNG artifact exists
# 6. Verify "Open in Figma" link (if file_key present)
