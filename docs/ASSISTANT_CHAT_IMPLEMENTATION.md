# Assistant Chat Widget Implementation

## Overview

Added a **real-time chat interface** to the Portfolio Assistant Preact island with:
- ✅ **SSE streaming** from `/agent/events` (Server-Sent Events)
- ✅ **Chat POST endpoint** to `/chat` for user messages
- ✅ **Auto-reconnect** with jittered exponential backoff
- ✅ **Multi-role messaging** (system, assistant, user, event)
- ✅ **Graceful error handling** with visual feedback
- ✅ **Layout debug** section (collapsible)

## Architecture

```
┌─────────────────────────────────────────────┐
│       Assistant Panel (Preact Island)       │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Chat Log (asst-log)                    │ │
│  │ - System messages                      │ │
│  │ - User messages (blue bubbles)         │ │
│  │ - Assistant replies (purple bubbles)   │ │
│  │ - Event messages (gray bubbles)        │ │
│  │ - Auto-scroll to latest                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Composer (asst-compose)                │ │
│  │ - Textarea input                       │ │
│  │ - Send button                          │ │
│  │ - Enter to send (Shift+Enter: newline)│ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Layout Debug (collapsible)             │ │
│  │ - JSON view of layout recipe           │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │                          │
         │ SSE                     │ POST
         ↓                          ↓
  /agent/events              /chat
  (EventSource)              (fetch)
```

## Data Flow

### SSE Streaming (Real-time Events)
```
1. Component mounts → useSSE("/agent/events")
2. EventSource opens connection
3. Server sends: data: {"role":"assistant","text":"Hello"}\n\n
4. onmessage fires → Parse JSON → Add to msgs state
5. useEffect triggers → Auto-scroll log to bottom
6. On disconnect → Exponential backoff → Reconnect
```

### Chat Messages (User → Assistant)
```
1. User types message → Press Enter or click Send
2. Add user message to log immediately
3. POST to /chat with JSON: {"message":"user text"}
4. Server responds: {"reply":"assistant response"}
5. Add assistant reply to log
6. On error → Show [chat] error in log with event styling
```

## Message Types

### ChatMsg Interface
```typescript
interface ChatMsg {
  role: "system" | "assistant" | "user" | "event";
  text: string;
  ts: number; // Unix timestamp
}
```

### Role Styling
- **system**: Default styling (initial "Assistant ready" message)
- **user**: Blue bubble (`rgba(59, 130, 246, 0.12)`)
- **assistant**: Purple bubble (`rgba(99, 102, 241, 0.12)`)
- **event**: Gray bubble (`rgba(148, 163, 184, 0.12)`) - connection status, errors

## SSE Auto-Reconnect

### Backoff Strategy
```typescript
const backoffRef = useRef(1000); // Start at 1 second

// On error:
const delay = Math.min(backoffRef.current, 15000) + Math.floor(Math.random() * 500);
backoffRef.current = Math.min(backoffRef.current * 2, 15000);
setTimeout(connect, delay);

// On success:
backoffRef.current = 1000; // Reset
```

**Sequence**: 1s → 2s → 4s → 8s → 15s (capped) + jitter

### Connection Events
- `[events] connected` - SSE connection opened
- `[events] disconnected — retrying…` - Connection lost, will retry

## API Contracts

### SSE Endpoint: `/agent/events`

**Protocol**: Server-Sent Events (text/event-stream)

**Format**:
```
data: {"role":"assistant","text":"Hello World"}\n\n
```

**Alternative** (plain text):
```
data: Hello World\n\n
```

**Client handling**:
- JSON with `{role, text}` → Use provided role
- Plain text → Default to `role: "assistant"`

### Chat Endpoint: `/chat`

**Request**:
```http
POST /chat HTTP/1.1
Content-Type: application/json

{"message": "user question"}
```

**Response** (JSON):
```json
{
  "reply": "assistant response"
}
```

**Alternative** (plain text):
```http
HTTP/1.1 200 OK
Content-Type: text/plain

assistant response
```

**Error handling**:
- Non-200 status → Log `[chat] 500 Internal Server Error`
- Network error → Log `[chat] error: TypeError: Failed to fetch`

## CSS Classes

### Layout
- `.assistant-panel` - Fixed bottom-right, 380px wide, 600px max height
- `.hdr` - Header bar with title
- `.asst-log` - Scrollable message log (38vh max height)
- `.asst-compose` - Composer with textarea + button
- `.asst-debug` - Collapsible layout JSON viewer

### Message Bubbles
```css
.asst-log .row {
  display: grid;
  grid-template-columns: 60px 1fr; /* timestamp | bubble */
  gap: 0.5rem;
}

.asst-log .row .ts {
  color: #9ca3af;
  font-size: 11px;
  text-align: right;
}

.asst-log .row .bubble {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0.5rem 0.75rem;
}
```

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line (multi-line input)

## Testing

### Unit Tests (`assistant.sse.spec.ts`)

1. **Basic rendering and send**
   - Mocks SSE with fake event
   - Mocks `/chat` endpoint
   - Verifies message appears in log
   - Verifies echo response

2. **Enter key handling**
   - Types message + Enter
   - Verifies input clears
   - Verifies message sent

3. **Error handling**
   - Mocks 500 error from `/chat`
   - Verifies error message in log

4. **Layout debug section**
   - Verifies collapsible details element
   - Clicks to expand
   - Verifies JSON pre block visible

### Running Tests
```bash
# Run all assistant tests
pnpm exec playwright test tests/e2e/assistant.sse.spec.ts --project=chromium

# Run specific test
pnpm exec playwright test -g "assistant panel renders"

# Debug mode
pnpm exec playwright test tests/e2e/assistant.sse.spec.ts --debug
```

## Build Output

**Before**: 19.60 kB JS
**After**: 21.14 kB JS (+1.54 kB for SSE + chat logic)

```
dist-portfolio/
├── index.html (12.64 kB)
└── assets/
    ├── main-Clnt1TRi.css (11.43 kB) +20 bytes
    └── main-lHVkl9On.js (21.14 kB)  +1.54 kB
```

## Backend Integration

### Mock Endpoints (for testing)

```python
# FastAPI example
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI()

@app.post("/chat")
async def chat(request: dict):
    message = request.get("message", "")
    return {"reply": f"Echo: {message}"}

@app.get("/agent/events")
async def events():
    async def event_generator():
        while True:
            yield {
                "event": "message",
                "data": '{"role":"assistant","text":"Periodic update"}'
            }
            await asyncio.sleep(5)

    return EventSourceResponse(event_generator())
```

### Real Implementation

The backend should:
1. **SSE**: Stream agent status updates, tool executions, LLM responses
2. **Chat**: Process user message → Run agent → Stream response
3. **Layout**: Integrate with layout system for context-aware suggestions

## Security

### CSP Compliance
- All scripts have `nonce="__CSP_NONCE__"` attribute
- SSE and fetch use same-origin by default
- `credentials: 'include'` enables cookies for auth

### CORS
```nginx
# nginx.conf
add_header Access-Control-Allow-Origin "https://assistant.ledger-mind.org";
add_header Access-Control-Allow-Credentials "true";
```

## Troubleshooting

### SSE not connecting
- Check `/agent/events` endpoint returns 200
- Verify `Content-Type: text/event-stream` header
- Check browser console for CORS errors
- Verify nginx doesn't buffer SSE (needs `proxy_buffering off`)

### Chat not sending
- Check `/chat` endpoint accepts POST
- Verify `Content-Type: application/json` header
- Check browser console for fetch errors
- Verify CORS allows POST from origin

### Messages not appearing
- Check message format matches ChatMsg interface
- Verify timestamps are Unix milliseconds (not seconds)
- Check for JavaScript errors in console
- Verify log ref is not null

### Auto-scroll not working
- Check `logRef.current` is attached to `.asst-log` div
- Verify `scrollHeight` > `clientHeight` (content overflows)
- Check for CSS `overflow: hidden` preventing scroll

## Future Enhancements

### Planned Features
1. **Typing indicators** - Show "..." when assistant is thinking
2. **Message actions** - Copy, regenerate, edit buttons
3. **History persistence** - Save chat to localStorage
4. **Voice input** - Speech-to-text integration
5. **Rich content** - Markdown rendering, code blocks, images
6. **Multi-turn context** - Send conversation history with each message
7. **Rate limiting** - Throttle message sends
8. **Sound effects** - Audio cues for new messages

### Performance Optimizations
- **Virtual scrolling** for long chat histories
- **Message batching** for rapid SSE updates
- **Lazy loading** of old messages
- **WebSocket upgrade** for bidirectional streaming

## Commit Message

```bash
git add apps/portfolio-ui/src/assistant.main.tsx
git add apps/portfolio-ui/portfolio.css
git add tests/e2e/assistant.sse.spec.ts

git commit -m "feat(portfolio): add minimal assistant chat (SSE events + /chat POST) to Preact island

- Add real-time SSE streaming from /agent/events
- Add chat POST endpoint to /chat for user messages
- Implement auto-reconnect with exponential backoff
- Add multi-role message styling (user/assistant/event)
- Add Enter-to-send keyboard shortcut
- Add collapsible layout debug section
- Add comprehensive Playwright tests
- Bundle size: +1.54 kB (19.60 → 21.14 kB)
"
```

## Files Changed

### Modified (2 files)
- `apps/portfolio-ui/src/assistant.main.tsx` (185 lines) - Chat widget implementation
- `apps/portfolio-ui/portfolio.css` (100+ lines added) - Chat styling

### Created (1 file)
- `tests/e2e/assistant.sse.spec.ts` (155 lines) - E2E tests

### Total Changes
- **285+ lines added** across 3 files
- **80+ lines removed** (old assistant panel styles)
- **Net +205 lines**
