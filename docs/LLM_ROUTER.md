# LLM Router - Primary → Fallback Configuration

## Overview

The LLM router provides resilient AI completion with automatic fallback from a primary backend (e.g., local Ollama) to a fallback backend (e.g., OpenAI cloud) when the primary is unavailable.

## Features

- **Automatic Fallback**: Retries on primary timeout/connection errors
- **Flexible Configuration**: Environment-based backend selection
- **Zero Downtime**: Seamless failover on network issues
- **Cost Optimization**: Use free local models first, cloud only when needed

## Configuration

### Environment Variables

Add to your `.env` file (in `assistant_api/` directory):

```env
# Primary backend (local Ollama, LM Studio, etc.)
PRIMARY_OPENAI_BASE_URL=http://localhost:11434/v1
PRIMARY_OPENAI_API_KEY=dummy
PRIMARY_OPENAI_MODEL=gpt-oss:20b
PRIMARY_OPENAI_TIMEOUT_S=12

# Fallback backend (OpenAI cloud)
FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
FALLBACK_OPENAI_API_KEY=sk-your-real-openai-key
FALLBACK_OPENAI_MODEL=gpt-4o-mini
FALLBACK_OPENAI_TIMEOUT_S=20
```

### Configuration Options

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIMARY_OPENAI_BASE_URL` | Primary LLM API endpoint | `http://localhost:11434/v1` (Ollama) |
| `PRIMARY_OPENAI_API_KEY` | Primary API key (use "dummy" for local) | `dummy` |
| `PRIMARY_OPENAI_MODEL` | Model name for primary | `gpt-oss:20b`, `llama2`, etc. |
| `PRIMARY_OPENAI_TIMEOUT_S` | Request timeout (seconds) | `12` (fast failover) |
| `FALLBACK_OPENAI_BASE_URL` | Fallback LLM API endpoint | `https://api.openai.com/v1` |
| `FALLBACK_OPENAI_API_KEY` | Fallback API key | `sk-proj-...` |
| `FALLBACK_OPENAI_MODEL` | Model name for fallback | `gpt-4o-mini`, `gpt-4`, etc. |
| `FALLBACK_OPENAI_TIMEOUT_S` | Fallback timeout (seconds) | `20` |

## Usage

### In PR Generator

The autonomous PR generator uses the LLM router to generate PR titles and bodies:

```bash
# With LLM-generated title/body
curl -X POST http://localhost:8001/agent/artifacts/pr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev" \
  -d '{"use_llm": true, "dry_run": true}'
```

**Behavior:**
1. Tries PRIMARY backend first (local Ollama)
2. If timeout/connection error → automatically uses FALLBACK (OpenAI)
3. If both fail → falls back to simple template-based title/body
4. PR body includes `<sub>LLM: model-name</sub>` to show which model was used

### In Code

```python
from assistant_api.llm.router import chat_complete

# Automatic primary → fallback routing
model_used, response = chat_complete(
    messages=[{"role": "user", "content": "Summarize this diff"}],
    temperature=0.2
)

print(f"Used model: {model_used}")
print(f"Response: {response}")
```

## Retryable Errors

The router automatically retries on fallback for these error types:

- **Timeout errors**: `TimeoutError`, "timed out", "timeout"
- **Connection errors**: `ConnectionError`, "refused", "reset"
- **HTTP 5xx**: "bad gateway", "service unavailable", "5xx"

**Non-retryable errors** (bubbles up immediately):
- HTTP 4xx (bad request, auth errors, etc.)
- Invalid model/parameters
- Other client-side errors

## Testing

### Smoke Test

```bash
# Test with local Ollama running
export PRIMARY_OPENAI_BASE_URL=http://localhost:11434/v1
export PRIMARY_OPENAI_MODEL=llama2
export FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
export FALLBACK_OPENAI_API_KEY=sk-your-key
export FALLBACK_OPENAI_MODEL=gpt-4o-mini

# Run backend
uvicorn assistant_api.main:app --reload

# Test dry-run with LLM
curl -X POST http://localhost:8001/agent/artifacts/pr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev" \
  -d '{"use_llm": true, "dry_run": true}' | jq
```

### Unit Tests

```bash
# Run LLM router tests
pytest tests/test_llm_router.py -v
```

## Deployment Scenarios

### Local Development (Ollama Primary)

```env
PRIMARY_OPENAI_BASE_URL=http://localhost:11434/v1
PRIMARY_OPENAI_MODEL=llama2
FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
FALLBACK_OPENAI_API_KEY=sk-...
FALLBACK_OPENAI_MODEL=gpt-4o-mini
```

**Behavior**: Uses local Ollama when available, OpenAI when Ollama is down.

### CI/CD (Cloud Only)

```env
# Leave PRIMARY_* unset or empty
FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
FALLBACK_OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
FALLBACK_OPENAI_MODEL=gpt-4o-mini
```

**Behavior**: Always uses OpenAI (no local models in CI).

### Self-Hosted Gateway

```env
PRIMARY_OPENAI_BASE_URL=https://llm-gateway.yourdomain.com/v1
PRIMARY_OPENAI_API_KEY=your-gateway-key
PRIMARY_OPENAI_MODEL=custom-model
FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
FALLBACK_OPENAI_API_KEY=sk-...
FALLBACK_OPENAI_MODEL=gpt-4o-mini
```

**Behavior**: Uses self-hosted gateway first, OpenAI as backup.

## Performance Tips

1. **Short Primary Timeout**: Set `PRIMARY_OPENAI_TIMEOUT_S=12` for fast failover
2. **Longer Fallback Timeout**: Set `FALLBACK_OPENAI_TIMEOUT_S=20` to allow cloud latency
3. **Health Check**: Add startup health check to log which backends are reachable
4. **Monitoring**: Track which model is used to optimize primary availability

## Troubleshooting

### Primary Always Fails

**Symptom**: Always using fallback even though Ollama is running

**Check**:
```bash
# Verify Ollama is accessible
curl http://localhost:11434/v1/models

# Check model name matches
ollama list
```

### Both Backends Fail

**Symptom**: `RuntimeError: No usable LLM backends configured`

**Solution**: Ensure at least one backend is fully configured:
```bash
# Minimum for primary
PRIMARY_OPENAI_BASE_URL=http://localhost:11434/v1
PRIMARY_OPENAI_MODEL=llama2

# OR minimum for fallback
FALLBACK_OPENAI_BASE_URL=https://api.openai.com/v1
FALLBACK_OPENAI_API_KEY=sk-...
FALLBACK_OPENAI_MODEL=gpt-4o-mini
```

### API Key Errors

**Symptom**: `401 Unauthorized` from OpenAI

**Solution**:
- Verify `FALLBACK_OPENAI_API_KEY` is correct
- Check key has required permissions
- For local models, use `dummy` as key

## Implementation Details

**File**: `assistant_api/llm/router.py`

**Key Functions**:
- `chat_complete(messages, temperature)` - Main completion function
- `_is_retryable(exc)` - Determines if error should trigger fallback
- `_cfg(prefix)` - Loads config for PRIMARY or FALLBACK

**Used By**:
- `assistant_api/routers/agent_act.py` - PR title/body generation
- (Future) SEO optimization, content summarization, etc.

## Next Steps

1. **Add Embeddings Router**: Similar primary→fallback for vector embeddings
2. **Health Check Endpoint**: `/llm/status` showing which backends are available
3. **Metrics**: Track primary vs fallback usage, latency, cost
4. **Streaming Support**: Add `chat_complete_stream()` for SSE responses
