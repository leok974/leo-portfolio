# Stream-then-Fallback Implementation

## Overview
The assistant UI implements a robust stream-first approach with automatic JSON fallback when the SSE stream produces no assistant tokens.

## Implementation Status ✅

### 1. UI: Stream-then-Fallback (No Duplication + Abort)

**Location**: `src/assistant-dock.ts`

**Key Features**:
- ✅ **Grace Period**: 2-second wait after receiving `meta` event before declaring "no tokens"
- ✅ **AbortController**: Properly cancels SSE stream before switching to JSON fallback
- ✅ **No Duplicates**: Guards against duplicate output by checking `receivedTokens === 0` before fallback
- ✅ **Clear Logging**: Console shows exactly what's happening at each step

**Flow**:
```typescript
1. Attempt SSE streaming to /api/chat/stream
2. Track when meta event received (sawMetaAt timestamp)
3. Count assistant tokens as they arrive (receivedTokens)
4. On stream completion:
   - If receivedTokens === 0 && sawMetaAt > 0:
     * Wait remaining grace period (2000ms - elapsed)
     * Log: "[assistant] waiting {N}ms grace period after meta..."
     * After grace, if still no tokens:
       - Log: "[assistant] stream produced no assistant tokens after grace period; falling back to JSON /api/chat"
       - Abort SSE stream with streamAbortController.abort('switch-to-json')
       - Fetch /api/chat with JSON request
   - If receivedTokens === 0 && sawMetaAt === 0:
     * Immediate fallback (no meta received at all)
   - If receivedTokens > 0:
     * Success, log first token timing
```

### 2. Backend Guard Test

**Location**: `tests/e2e/chat-stream-yields.spec.ts`

**Purpose**: Proves the backend normally yields at least one assistant token via SSE

**What it validates**:
- ✅ `/api/chat/stream` endpoint responds with HTTP 200
- ✅ Response body is a readable stream
- ✅ Stream produces at least one chunk containing assistant content
- ✅ Detects both formats: `"delta"` with `"content"` OR `"role":"assistant"` with `"content"`

**Test command**:
```bash
npm run test:backend:stream-yields
```

### 3. UI Mock Spec: No Duplicate Output

**Location**: `tests/e2e/assistant-ui-fallback.spec.ts`

**Purpose**: Assert that fallback doesn't create duplicate messages

**What it validates**:
- ✅ Mocks empty SSE stream (meta + done only, no tokens)
- ✅ Waits 2 seconds (grace period)
- ✅ Verifies fallback JSON request is made
- ✅ **Asserts exactly ONE assistant message** in chat log (no duplication)
- ✅ Verifies fallback text appears in the bubble

**Test command**:
```bash
npm run test:assistant:fallback
```

### 4. NPM Script Wiring

**Location**: `package.json`

```json
{
  "scripts": {
    "test:assistant:fallback": "npx playwright test -g \"@frontend assistant UI fallback\" --project=chromium",
    "test:backend:stream-yields": "npx playwright test -g \"@backend stream yields assistant text\" --project=chromium"
  }
}
```

### 5. Nginx Configuration

**Location**: `deploy/nginx.conf`

**Required settings for `/api/chat/stream`**:
```nginx
proxy_buffering off;         # ✅ Present (line 152)
proxy_read_timeout 24h;      # ✅ Present (line 154)
proxy_send_timeout 24h;      # ✅ Present (line 155)
```

These settings ensure:
- SSE events aren't buffered by nginx
- Long-running streams don't timeout
- Proper handling of "no tokens yet" scenarios

## Console Output Examples

### Normal Flow (Tokens Received)
```
[assistant] chat POST /api/chat/stream {messages: Array(1), stream: true}
[assistant] first token ms 234
```

### Fallback Flow (No Tokens After Grace)
```
[assistant] chat POST /api/chat/stream {messages: Array(1), stream: true}
[assistant] waiting 2000ms grace period after meta...
[assistant] stream produced no assistant tokens after grace period; falling back to JSON /api/chat
```

### Error Flow (Non-OK JSON Response)
```
[assistant] chat POST /api/chat/stream {messages: Array(1), stream: true}
[assistant] waiting 2000ms grace period after meta...
[assistant] stream produced no assistant tokens after grace period; falling back to JSON /api/chat
[assistant] JSON fallback non-OK 500 {"error":"Internal server error"...}
```

## Test Results

### ✅ All Tests Passing

```bash
# UI fallback test (3.9s)
npm run test:assistant:fallback
✓ @frontend assistant UI fallback › falls back to JSON when stream has no tokens

# Backend guard test (1.4s)
npm run test:backend:stream-yields
✓ @backend stream yields assistant text › stream returns at least one assistant token
```

## Key Design Decisions

### Why 2-Second Grace Period?
- Prevents false negatives when first token slightly delayed after meta
- Balances UX (not too long to wait) vs. robustness (catches slow starts)
- Configurable via `GRACE_AFTER_META_MS` constant

### Why Abort Before Fallback?
- Prevents race condition: stream might produce late tokens during fallback request
- Avoids double replies (stream content + JSON content concatenated)
- Clean state management: only one active request at a time

### Why Check `receivedTokens === 0`?
- Guards against appending fallback text if stream somehow produced tokens during grace wait
- Extra safety layer for edge cases (though abort should prevent this)

## Future Improvements

Potential enhancements (not currently needed):
- Expose `GRACE_AFTER_META_MS` as user-configurable setting
- Add telemetry for fallback frequency monitoring
- Implement exponential backoff for JSON fallback retries
- Add fallback reason to analytics/logging

## Related Files

- `src/assistant-dock.ts` - Main implementation
- `src/lib/sse.ts` - SSE stream reader utility
- `tests/e2e/assistant-ui-fallback.spec.ts` - UI test
- `tests/e2e/chat-stream-yields.spec.ts` - Backend test
- `deploy/nginx.conf` - Proxy configuration
- `package.json` - Test scripts

## Maintenance Notes

When debugging fallback behavior:
1. Check browser console for clear log messages
2. Verify nginx config hasn't been modified (buffering settings)
3. Run `npm run test:backend:stream-yields` to verify server health
4. Run `npm run test:assistant:fallback` to verify UI logic
5. Check `receivedTokens` counter in devtools (set breakpoint in onChunk handler)
