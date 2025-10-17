# Portfolio Assistant API Migration Complete

## Date
October 14, 2025

## Summary
Successfully migrated portfolio assistant from EventSource-based `/agent/events` SSE to fetch-based POST `/chat` and POST `/chat/stream` endpoints matching the SiteAgent API contract.

## Changes Made

### 1. Environment Configuration
**Files Modified:**
- `apps/portfolio-ui/.env.development`
- `apps/portfolio-ui/.env.production`

**Before:**
```bash
VITE_AGENT_API_BASE=http://127.0.0.1:8001
VITE_ASSISTANT_CHAT_PATH=/chat
VITE_ASSISTANT_EVENTS_PATH=/agent/events
```

**After:**
```bash
VITE_AGENT_API_BASE=http://127.0.0.1:8001
```

**Rationale:** Simplified to single API base URL. Chat helpers now use hardcoded `/chat` and `/chat/stream` paths that match SiteAgent API.

### 2. Assistant Client Implementation
**File:** `apps/portfolio-ui/src/assistant.main.tsx`

**Removed:**
- `useSSE()` hook (EventSource-based)
- `/agent/events` SSE connection
- Channel-based message routing
- `uuid()` helper (no longer needed)

**Added:**
```typescript
// Fetch-based chat helpers
async function chatOnce(messages: ChatMessage[]): Promise<string>
async function chatStream(
  messages: ChatMessage[],
  { onDelta, onDone, onError }
): Promise<void>
```

**Key Improvements:**
- **Streaming with fetch + ReadableStream**: Replaces EventSource for better control
- **Message history context**: Sends last 5 turns for conversation continuity
- **Fallback strategy**: Attempts streaming first, falls back to non-streaming on failure
- **Incremental UI updates**: `onDelta` callback updates assistant message character-by-character
- **Proper SSE parsing**: Handles `data:` lines, `[DONE]` sentinel, and JSON/text deltas

### 3. Nginx Proxy Configuration
**File:** `deploy/nginx.portfolio-dev.conf`

**Added locations:**
```nginx
location /chat/stream {
  proxy_pass http://host.docker.internal:8001/chat/stream;
  proxy_buffering off;             # critical for SSE streams
  proxy_request_buffering off;
  chunked_transfer_encoding off;
  proxy_read_timeout 3600s;
}

location /chat {
  proxy_pass http://host.docker.internal:8001/chat;
  proxy_http_version 1.1;
}
```

**Removed:**
- `/agent/events` location (no longer used by portfolio assistant)

**Key Settings:**
- `proxy_buffering off`: Essential for SSE streaming to work
- `proxy_read_timeout 3600s`: Allow long-lived streaming connections
- `chunked_transfer_encoding off`: Let backend control chunking

## Verification Tests

### 1. Non-Streaming Chat
```powershell
curl -X POST http://localhost:8090/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

**Result:** ✅ 200 OK
```json
{
  "content": "Hello! How can I assist you today?",
  "_served_by": "fallback",
  "grounded": false
}
```

### 2. Streaming Chat
```powershell
Invoke-WebRequest -Uri "http://localhost:8090/chat/stream" \
  -Method POST \
  -Headers @{"Content-Type"="application/json"} \
  -Body '{"messages":[{"role":"user","content":"hello"}]}'
```

**Result:** ✅ 200 OK
- Content-Type: `text/event-stream; charset=utf-8`
- Streams SSE data with `data:` lines
- Proper chunked transfer encoding

### 3. UI Testing
**Open:** http://localhost:8090/

**Expected Behavior:**
1. Assistant panel loads with "Assistant ready" message
2. Type message and press Enter
3. Message appears with "user" badge
4. Streaming response appears character-by-character with "assistant" badge
5. "Sending…" button text while streaming
6. No console errors, no 405 errors in Network tab

## Architecture Diagram

### Before (EventSource Pattern)
```
Portfolio UI (EventSource)
  ↓ GET /agent/events?channel=uuid
nginx :8090
  ↓ proxy_pass
Backend :8001 /agent/events (❌ doesn't exist)
```

### After (Fetch + ReadableStream)
```
Portfolio UI (fetch POST)
  ↓ POST /chat/stream
nginx :8090 (proxy_buffering off)
  ↓ proxy_pass
Backend :8001 /chat/stream
  ↓ StreamingResponse (SSE)
Portfolio UI (body.getReader())
```

## API Contract

### Request (Both Endpoints)
```typescript
POST /chat or /chat/stream
{
  "messages": [
    { "role": "user", "content": "hello" }
  ]
}
```

### Response: POST /chat (Non-Streaming)
```json
{
  "content": "response text",
  "choices": [
    {
      "message": { "role": "assistant", "content": "response text" },
      "finish_reason": "stop"
    }
  ],
  "_served_by": "primary|fallback",
  "grounded": false,
  "sources": []
}
```

### Response: POST /chat/stream (Streaming)
```
event: meta
data: {"_served_by":"primary","grounded":false}

data: {"delta":{"content":"Hello"}}

data: {"delta":{"content":" world"}}

data: [DONE]
```

## Benefits

1. **Standards Compliance**: Uses standard fetch API instead of EventSource
2. **Better Error Handling**: Can inspect response status/headers before reading stream
3. **Simplified Architecture**: No channel routing, direct POST → response
4. **Context Awareness**: Sends conversation history for better responses
5. **Progressive Enhancement**: Falls back to non-streaming gracefully
6. **No More 405 Errors**: Correct HTTP methods (POST, not GET)

## Files Changed
- `apps/portfolio-ui/.env.development`
- `apps/portfolio-ui/.env.production`
- `apps/portfolio-ui/src/assistant.main.tsx` (major refactor: ~100 lines changed)
- `deploy/nginx.portfolio-dev.conf`

## Deployment Status
✅ **COMPLETE** - Deployed to http://localhost:8090/ at 2025-10-14 15:04

## Next Steps (Production)
1. Update production nginx config (`nginx.portfolio.conf`) with same streaming settings
2. Verify CSP headers allow `https://assistant.ledger-mind.org` for streaming
3. Test assistant on production deployment
4. Monitor streaming connection stability in production logs
