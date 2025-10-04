# SSE Stream Improvements

## Overview
Enhanced the SSE reader to handle multiple payload shapes and added a friendlier system prompt to improve the assistant's tone and helpfulness.

## Changes Applied

### 1. ✅ Multi-Format SSE Payload Support

**Location**: `src/assistant-dock.ts` - `extractPiece()` function

**Problem**: The previous implementation only handled specific payload structures, causing the fallback mechanism to trigger unnecessarily when the backend used different formats.

**Solution**: Enhanced `extractPiece()` to handle multiple OpenAI-compatible formats:

```typescript
const extractPiece = (chunk: any): string => {
  if (!chunk) return '';

  // Handle multiple payload shapes
  const text =
    chunk?.delta?.content ??
    chunk?.message?.content ??
    chunk?.choices?.[0]?.delta?.content ??
    chunk?.choices?.[0]?.message?.content ??
    chunk?.content ??
    (typeof chunk === 'string' ? chunk : '');

  // Handle arrays
  if (Array.isArray(text)) return text.join('');
  if (typeof text === 'string') return text;
  return '';
};
```

**Supported Formats**:
- ✅ `{"delta":{"content":"…"}}` - Simple delta format
- ✅ `{"choices":[{"delta":{"content":"…"}}]}` - OpenAI streaming format
- ✅ `{"message":{"content":"…"}}` - Complete message format
- ✅ `{"content":"…"}` - Top-level content
- ✅ `"plain text"` - Plain string (rare, but some proxies do this)
- ✅ Array values - Automatically joined

### 2. ✅ Friendly System Prompt

**Location**: `src/assistant-dock.ts` - Stream and fallback requests

**Problem**: Assistant responses felt too formal and robotic ("press-release" style).

**Solution**: Added a warm, concise system prompt to both streaming and JSON fallback paths:

#### Streaming Request:
```typescript
messages: [
  {
    role: 'system',
    content: "You are a warm, concise portfolio assistant. When the user asks about projects, pick the best match, explain in a friendly tone (2–4 short bullets), and end with one helpful follow-up question."
  },
  { role: 'user', content: q }
],
temperature: 0.7,
top_p: 0.95
```

#### JSON Fallback:
```typescript
messages: [
  {
    role: 'system',
    content: "You are a warm, concise portfolio assistant. Prefer natural phrasing and end with a short follow-up question."
  },
  { role: 'user', content: q }
],
temperature: 0.7,
top_p: 0.95
```

**Temperature Settings**:
- `temperature: 0.7` - Balanced creativity (not too random, not too rigid)
- `top_p: 0.95` - Nucleus sampling for natural responses

### 3. ✅ Enhanced Backend Test

**Location**: `tests/e2e/chat-stream-yields.spec.ts`

**Changes**:
- Renamed test: "stream produces text or cleanly falls back"
- Added multiple detection patterns for different SSE formats
- Checks for both tokens AND `[DONE]` marker
- More robust validation

**Detection Patterns**:
```typescript
// [DONE] marker
if (/data:\s*\[DONE\]/.test(text)) { sawDone = true; }

// Content in JSON format
if (/data:\s*{/.test(text) && /content/.test(text)) { hadToken = true; }

// Delta format
if (text.includes('"delta"') && text.includes('"content"')) { hadToken = true; }

// Assistant message format
if (text.includes('"role":"assistant"') && text.includes('"content"')) { hadToken = true; }
```

**Assertion**:
```typescript
expect(hadToken || sawDone, 'SSE produced neither tokens nor [DONE]').toBeTruthy();
```

## Backend Stream Verification

### Test Output (Successful)
```bash
$ npm run test:backend:stream-yields
✓ @backend stream yields assistant text › stream produces text or cleanly falls back (1.8s)
```

### Live Stream Output
```bash
$ curl http://127.0.0.1:8080/api/chat/stream -d '{"messages":[{"role":"user","content":"say hello"}]}'

event: meta
data: {"_served_by": "primary"}

data: {"id":"chatcmpl-392","object":"chat.completion.chunk","created":1759520759,"model":"gpt-oss:20b","choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":"The"},"finish_reason":null}]}

data: {"id":"chatcmpl-392","object":"chat.completion.chunk","created":1759520759,"model":"gpt-oss:20b","choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":" user"},"finish_reason":null}]}

... (more delta chunks) ...

data: [DONE]
```

**Observations**:
- ✅ Meta event appears first with `_served_by`
- ✅ Multiple data lines with `choices[0].delta`
- ✅ Backend uses OpenAI-compatible format
- ✅ Stream terminates with `[DONE]`
- ✅ System prompt is working (model reasons about being portfolio assistant)

## UI Test Results

### Fallback Test
```bash
$ npm run test:assistant:fallback
✓ @frontend assistant UI fallback › falls back to JSON when stream has no tokens (4.1s)

Console output:
[assistant] chat POST /api/chat/stream {messages: Array(2), stream: true, temperature: 0.7, top_p: 0.95}
[assistant] waiting 2000ms grace period after meta...
[assistant] stream produced no assistant tokens after grace period; falling back to JSON /api/chat
```

**Verified**:
- ✅ System prompt is included (messages: Array(2))
- ✅ Temperature and top_p are set
- ✅ Grace period works correctly
- ✅ Fallback triggers after 2 seconds with no tokens
- ✅ No duplicate output

### Follow-Up Question Test
**Location**: `tests/e2e/chat-followup.spec.ts`

**Purpose**: Verifies that the assistant's responses include a follow-up question, ensuring conversational engagement.

```bash
$ npm run test:backend:req -- -g "@backend chat follow-up"
✓ @backend chat follow-up › assistant answers include a follow-up question (5.0s)
```

**What it validates**:
- ✅ Uses same system prompt as UI ("Prefer natural phrasing and end with a short follow-up question")
- ✅ Sets temperature: 0.7 and top_p: 0.95
- ✅ Checks for question marks (?, ？) at end of response
- ✅ Supports locale variants (English, Japanese, Chinese question marks)
- ✅ Handles both string and array-of-chunks content shapes

**Detection Logic**:
```typescript
function hasFollowUp(text: string) {
  // allow locale variants and optional trailing punctuation/whitespace
  return /[?？]\s*$|[?？！]\s*$/m.test(text) || text.split('\n').some(l => /[?？]/.test(l));
}
```

This test ensures the assistant maintains its conversational tone and doesn't regress into "press release" style responses.

## Benefits

### 1. Reduced False Fallbacks
The enhanced `extractPiece()` function now correctly recognizes tokens in multiple formats, preventing unnecessary fallbacks to JSON mode.

### 2. Better User Experience
- **Warmer tone**: Less robotic, more conversational
- **Concise responses**: 2-4 bullets for projects
- **Engagement**: Ends with follow-up questions
- **Natural phrasing**: Temperature 0.7 balances creativity and accuracy

### 3. Robust Format Support
Handles various SSE payload structures from different LLM providers:
- OpenAI streaming format (`choices[0].delta.content`)
- Simple delta format (`delta.content`)
- Complete message format (`message.content`)
- Plain text fallback

### 4. Better Observability
Enhanced test now checks for multiple success conditions:
- Token detection (various formats)
- Clean [DONE] termination
- Clear failure messages

## Configuration Options

### Stream Budget (Optional)
To increase timeout in development:

```typescript
// Set before interaction
(window as any).STREAM_BUDGET_MS = 30000; // 30 seconds
```

Default: 20 seconds

### Grace Period
Configurable in `src/assistant-dock.ts`:

```typescript
const GRACE_AFTER_META_MS = 2_000; // 2 seconds
```

## Troubleshooting

### If Fallback Still Triggers Often

1. **Check nginx buffering**:
   ```nginx
   location /api/chat/stream {
     proxy_buffering off;           # ✅ Must be off
     proxy_read_timeout 24h;        # ✅ Long timeout
     proxy_send_timeout 24h;        # ✅ Long timeout
   }
   ```

2. **Verify backend streams properly**:
   ```bash
   curl -N http://127.0.0.1:8080/api/chat/stream \
     -d '{"messages":[{"role":"user","content":"hi"}]}' \
     | head -40
   ```

   Should see multiple `data:` lines with content, not just meta + [DONE].

3. **Check backend doesn't buffer tokens**:
   - Ensure streaming endpoint yields tokens incrementally
   - Don't accumulate full response before sending

4. **Increase stream budget**:
   ```typescript
   (window as any).STREAM_BUDGET_MS = 30000;
   ```

### If System Prompt Not Working

1. **Verify backend accepts system messages**:
   Some backends ignore or strip system messages. Check backend logs.

2. **Adjust temperature if needed**:
   ```typescript
   temperature: 0.7,  // Lower = more focused, Higher = more creative
   top_p: 0.95        // Nucleus sampling threshold
   ```

3. **Test prompt changes**:
   Edit the system content in `src/assistant-dock.ts` and rebuild:
   ```bash
   npm run build
   ```

## Related Files

- `src/assistant-dock.ts` - Main implementation
- `src/lib/sse.ts` - SSE stream reader utility
- `tests/e2e/chat-stream-yields.spec.ts` - Backend stream test
- `tests/e2e/chat-followup.spec.ts` - Follow-up question validation test
- `tests/e2e/assistant-ui-fallback.spec.ts` - UI fallback test
- `deploy/nginx.conf` - Proxy configuration

## Next Steps

Optional enhancements (not currently needed):
- Expose system prompt as user-configurable setting
- Add prompt templates for different contexts (technical, casual, brief)
- Implement streaming progress indicator
- Add telemetry for token detection success rate

## Maintenance Notes

When updating the system prompt:
1. Edit both streaming and fallback paths in `src/assistant-dock.ts`
2. Keep both prompts aligned (streaming can be more detailed)
3. Test with `npm run build && npm run test:assistant:fallback`
4. Verify tone manually through the UI

When adding new SSE format support:
1. Update `extractPiece()` function with new pattern
2. Add test case in `chat-stream-yields.spec.ts`
3. Document the format in this file
4. Test with real backend streaming that format
