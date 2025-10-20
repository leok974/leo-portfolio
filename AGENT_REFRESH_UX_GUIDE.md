# Agent Refresh - UX Integration Guide

## Overview

This guide shows how to integrate agent refresh commands and status checking into the chat UI.

## Quick Integration (15-30 seconds)

### 1. Import helpers in `assistant.main.tsx`

```typescript
import { detectCommand, executeCommand, getCommandDescription, getRefreshStatus } from './agent/commands';
```

### 2. Detect commands in the send function

Add command detection before sending to the assistant API:

```typescript
async function send(text: string) {
  const clean = text.trim();
  if (!clean) return;

  // Check for agent refresh commands
  const cmd = detectCommand(clean);
  if (cmd) {
    await handleRefreshCommand(cmd);
    return; // Don't send to assistant API
  }

  // ... rest of existing send logic
}
```

### 3. Add command handler

```typescript
async function handleRefreshCommand(cmd: AgentCmd) {
  const description = getCommandDescription(cmd);

  setMsgs((p) => [
    ...p,
    { role: 'user', text: cmd, ts: now() },
    { role: 'event', text: `🚀 ${description}...`, ts: now() }
  ]);

  try {
    const result = await executeCommand(cmd);

    if (result.dispatched) {
      setMsgs((p) => [
        ...p,
        {
          role: 'assistant',
          text: `✅ Refresh dispatched successfully!\n\nWorkflow: ${result.workflow}\nReason: ${result.reason}\nTime: ${result.timestamp}\n\nWant me to check status in ~2 minutes? Type "check status" or click below.\n\n[Check Status Now]`,
          ts: now()
        }
      ]);
    }
  } catch (err: any) {
    setMsgs((p) => [
      ...p,
      {
        role: 'event',
        text: `[error] Failed to dispatch refresh: ${err.message}`,
        ts: now()
      }
    ]);
  }
}
```

### 4. Add status check handler

```typescript
async function checkRefreshStatus() {
  setMsgs((p) => [...p, { role: 'event', text: '🔍 Checking refresh status...', ts: now() }]);

  try {
    const status = await getRefreshStatus();

    if (status.state === 'unknown') {
      setMsgs((p) => [...p, {
        role: 'assistant',
        text: '📭 No recent workflow runs found.',
        ts: now()
      }]);
      return;
    }

    const { id, status: runStatus, conclusion, html_url, name, created_at } = status;

    let emoji = '⏳';
    let statusText = 'In progress';

    if (runStatus === 'completed') {
      emoji = conclusion === 'success' ? '✅' : '❌';
      statusText = conclusion === 'success' ? 'Completed successfully' : 'Failed';
    } else if (runStatus === 'queued') {
      emoji = '⏱️';
      statusText = 'Queued';
    }

    const time = created_at ? new Date(created_at).toLocaleString() : 'Unknown';

    setMsgs((p) => [...p, {
      role: 'assistant',
      text: `${emoji} **${statusText}**\n\nWorkflow: ${name}\nRun ID: ${id}\nStarted: ${time}\n\n[View Details](${html_url})`,
      ts: now()
    }]);
  } catch (err: any) {
    setMsgs((p) => [...p, {
      role: 'event',
      text: `[error] Failed to check status: ${err.message}`,
      ts: now()
    }]);
  }
}
```

### 5. Handle "check status" command

Add to the command detection in `send()`:

```typescript
async function send(text: string) {
  const clean = text.trim();
  if (!clean) return;

  // Check for status command
  if (/check\s+status|refresh\s+status/i.test(clean)) {
    await checkRefreshStatus();
    return;
  }

  // Check for agent refresh commands
  const cmd = detectCommand(clean);
  if (cmd) {
    await handleRefreshCommand(cmd);
    return;
  }

  // ... rest of existing send logic
}
```

## Advanced: Clickable Quick-Replies

To make "[Check Status Now]" clickable:

### Option 1: Simple link approach
Replace `[Check Status Now]` with a GitHub Actions link:

```typescript
text: `... \n\n[View Runs](https://github.com/leok974/leo-portfolio/actions/workflows/refresh-content.yml)`
```

### Option 2: Custom quick-reply buttons

Add a `quickReplies` field to `ChatMsg`:

```typescript
interface ChatMsg {
  role: "system" | "assistant" | "user" | "event";
  text: string;
  ts: number;
  quickReplies?: { label: string; action: string }[];
}
```

Then in the message rendering:

```tsx
{msg.quickReplies && (
  <div class="quick-replies">
    {msg.quickReplies.map(qr => (
      <button
        class="quick-reply-btn"
        onClick={() => {
          if (qr.action === 'check-status') {
            void checkRefreshStatus();
          }
        }}
      >
        {qr.label}
      </button>
    ))}
  </div>
)}
```

Add CSS:

```css
.quick-replies {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.quick-reply-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  background: var(--bg-color);
  cursor: pointer;
  font-size: 0.875rem;
}

.quick-reply-btn:hover {
  background: var(--hover-bg);
}
```

Usage:

```typescript
setMsgs((p) => [...p, {
  role: 'assistant',
  text: '✅ Refresh dispatched successfully!',
  ts: now(),
  quickReplies: [
    { label: 'Check Status', action: 'check-status' }
  ]
}]);
```

## Auto-Polling Pattern

Poll status every 30 seconds after dispatch:

```typescript
async function handleRefreshCommand(cmd: AgentCmd) {
  const description = getCommandDescription(cmd);

  setMsgs((p) => [
    ...p,
    { role: 'user', text: cmd, ts: now() },
    { role: 'event', text: `🚀 ${description}...`, ts: now() }
  ]);

  try {
    const result = await executeCommand(cmd);

    if (result.dispatched) {
      setMsgs((p) => [
        ...p,
        {
          role: 'assistant',
          text: `✅ Refresh dispatched! Monitoring progress...`,
          ts: now()
        }
      ]);

      // Start polling
      let attempts = 0;
      const maxAttempts = 10; // 5 minutes max
      const pollInterval = setInterval(async () => {
        attempts++;

        const status = await getRefreshStatus();

        if (status.status === 'completed' || attempts >= maxAttempts) {
          clearInterval(pollInterval);

          const emoji = status.conclusion === 'success' ? '✅' : '❌';
          const msg = status.conclusion === 'success'
            ? 'Refresh completed successfully!'
            : 'Refresh completed with errors.';

          setMsgs((p) => [...p, {
            role: 'assistant',
            text: `${emoji} ${msg}\n\n[View Details](${status.html_url})`,
            ts: now()
          }]);
        }
      }, 30000); // Every 30 seconds
    }
  } catch (err: any) {
    setMsgs((p) => [
      ...p,
      {
        role: 'event',
        text: `[error] Failed to dispatch refresh: ${err.message}`,
        ts: now()
      }
    ]);
  }
}
```

## Testing

1. **Manual test**: Type "refresh portfolio" in chat
2. **Expected behavior**:
   - Shows "🚀 Refreshing entire portfolio..."
   - Dispatches to worker
   - Shows success with quick-reply
3. **Status check**: Type "check status" or click quick-reply
4. **Expected behavior**:
   - Shows current run status
   - Includes link to GitHub Actions

## Environment Variables

Ensure these are set in `.env.local`:

```env
VITE_AGENT_REFRESH_URL=https://agent-refresh.leoklemet.workers.dev
VITE_AGENT_ALLOW_KEY=<your-key>
```

## Error Handling

Handle common errors gracefully:

```typescript
try {
  const result = await executeCommand(cmd);
} catch (err: any) {
  let userMessage = 'Failed to dispatch refresh.';

  if (err.message.includes('401')) {
    userMessage = 'Authentication failed. Please check configuration.';
  } else if (err.message.includes('429')) {
    userMessage = 'Rate limit exceeded. Please try again in a minute.';
  } else if (err.message.includes('400')) {
    userMessage = 'Invalid request. Command or branch may not be allowed.';
  } else if (err.message.includes('VITE_AGENT_ALLOW_KEY not configured')) {
    userMessage = 'Agent refresh is not configured. Please set environment variables.';
  }

  setMsgs((p) => [...p, {
    role: 'event',
    text: `[error] ${userMessage}`,
    ts: now()
  }]);
}
```

## Summary

Minimal integration (3 changes):
1. Import helpers
2. Add command detection in send()
3. Add handleRefreshCommand function

Enhanced UX (optional):
- Quick-reply buttons for status checks
- Auto-polling with progress updates
- Rich status messages with emojis and links
- Graceful error handling

Full example implementation: see `apps/portfolio-ui/src/assistant.main.tsx.example` (create if needed).
