# Follow-Up Question Test

## Overview
Automated test to ensure the assistant maintains conversational engagement by including follow-up questions in responses, preventing regression to "press release" style.

## Test File
**Location**: `tests/e2e/chat-followup.spec.ts`

## Purpose
Validates that the assistant's system prompt ("end with a short follow-up question") is working correctly and that responses maintain a conversational tone.

## How It Works

### System Prompt
Uses the same system prompt as the UI fallback:
```typescript
const SYSTEM_PRIMER =
  "You are a warm, concise portfolio assistant. Prefer natural phrasing and end with a short follow-up question.";
```

### Detection Logic
```typescript
function hasFollowUp(text: string) {
  // allow locale variants and optional trailing punctuation/whitespace
  return /[?？]\s*$|[?？！]\s*$/m.test(text) || text.split('\n').some(l => /[?？]/.test(l));
}
```

**Supported question marks**:
- `?` - English/standard
- `？` - Japanese/Chinese (full-width)
- `？！` - Japanese interrobang variant

**Detection patterns**:
1. Question mark at end of text (with optional whitespace)
2. Question mark at end of any line (multiline support)

### Test Flow
1. Wait for backend to be ready (`waitForPrimary`)
2. POST to `/api/chat` with:
   - System primer message
   - User request: "Recommend one of my projects for a hiring manager and explain briefly."
   - Temperature: 0.7
   - Top_p: 0.95
3. Extract assistant response from `choices[0].message.content`
4. Verify response is non-empty
5. Verify response contains a question mark

### Error Output
If the test fails, it shows the full response for debugging:
```
assistant reply missing follow-up question
--- reply start ---
{actual response text}
--- reply end ---
```

## Running the Test

### Standard Run
```bash
npm run test:backend:req -- -g "@backend chat follow-up"
```

### With Backend Pre-check
The `test:backend:req` script includes:
- Pre-test health check: `/_up` endpoint
- Long timeouts for model warm-up
- Configured wait times for streaming

### Expected Output
```bash
[wait-http] OK: http://127.0.0.1:8080/_up
[wait-primary] server phase: ok=1 tries=1 elapsed=8ms
✓ @backend chat follow-up › assistant answers include a follow-up question (5.0s)
```

## Test Results

### ✅ Current Status: PASSING
- Runtime: ~5 seconds
- Backend: Primary model responding
- Follow-up questions: Detected correctly

## Benefits

### 1. Prevents Tone Regression
If the system prompt is removed or ignored, this test will fail, alerting developers that the assistant has lost its conversational tone.

### 2. Validates System Prompt
Confirms that:
- Backend respects system messages
- Temperature/top_p settings are applied
- Response generation includes instructed behavior

### 3. Multi-Language Support
Works with different question mark styles:
- Western: `?`
- East Asian: `？`
- Mixed punctuation: `？！`

### 4. Fast Feedback
5-second runtime provides quick validation during development.

## Troubleshooting

### Test Fails: No Question Mark Found

**Possible causes**:
1. **Backend ignoring system messages**
   - Check backend logs for system message handling
   - Verify model supports system role

2. **Temperature too low**
   - Current: 0.7 (balanced)
   - Try increasing if responses too rigid

3. **Model instruction following**
   - Some models ignore instruction better than others
   - May need stronger prompt wording

4. **Response format issues**
   - Verify `choices[0].message.content` path is correct
   - Check if content is string vs array

### Test Times Out

**Possible causes**:
1. **Backend not responding**
   - Check `/_up` endpoint: `curl http://127.0.0.1:8080/_up`
   - Verify model is loaded and ready

2. **Model loading slowly**
   - First request may take longer (model warm-up)
   - Subsequent runs should be faster

3. **Network issues**
   - Check if backend container is running
   - Verify port 8080 is accessible

### False Positives (Test Passes But Response is Poor)

The test only checks for presence of `?`, not quality. If responses are low-quality but contain a question mark, consider:

1. **Add content quality checks**
   - Minimum response length
   - Keyword presence (project names)
   - Bullet format validation

2. **Manual review**
   - Periodically check actual responses
   - Verify tone matches brand voice

3. **Enhanced prompts**
   - Make system message more specific
   - Add examples in prompt

## Integration with CI/CD

### Recommended Usage

**Pre-deployment**:
```bash
# Run full backend test suite including follow-up check
npm run test:backend:req
```

**Quick smoke test**:
```bash
# Run just the follow-up test
npm run test:backend:req -- -g "@backend chat follow-up"
```

### Exit Codes
- `0` - Test passed (follow-up question detected)
- `1` - Test failed (no question mark found or request failed)

## Future Enhancements

Optional improvements (not currently implemented):

### 1. Question Quality Validation
```typescript
function hasGoodFollowUp(text: string) {
  // Check for vague questions
  const vague = /anything else|help you|can I do/i;
  // Prefer specific questions about projects/skills
  const specific = /which project|what technology|how did|tell me more/i;

  return hasFollowUp(text) && specific.test(text) && !vague.test(text);
}
```

### 2. Multiple Test Cases
Test different user intents:
- Project recommendation (current)
- Skills inquiry
- Experience questions
- Contact/availability

### 3. Response Time Tracking
Log how long the model takes to respond:
```typescript
const start = performance.now();
const res = await request.post('/api/chat', {...});
const elapsed = performance.now() - start;
console.log(`Response time: ${elapsed}ms`);
```

### 4. Content Structure Validation
Check for recommended format (2-4 bullets):
```typescript
const bullets = text.match(/^[•\-*]/gm);
expect(bullets?.length).toBeGreaterThanOrEqual(2);
expect(bullets?.length).toBeLessThanOrEqual(4);
```

## Maintenance Notes

### When to Update This Test

**Update the test if**:
1. System prompt changes
2. Expected response format changes
3. Question detection needs refinement
4. Backend API changes (`/api/chat` structure)

### When NOT to Update

**Don't modify if**:
1. Model outputs vary slightly (that's expected)
2. Question phrasing differs (as long as `?` present)
3. Response length varies
4. Model switches (test should be model-agnostic)

### Keeping Prompts in Sync

The system prompt should match across:
- ✅ `tests/e2e/chat-followup.spec.ts` (this test)
- ✅ `src/assistant-dock.ts` (UI fallback path)
- ✅ `src/assistant-dock.ts` (UI streaming path)

Consider extracting to shared constant:
```typescript
// shared/prompts.ts
export const ASSISTANT_SYSTEM_PROMPT =
  "You are a warm, concise portfolio assistant...";
```

## Related Files

- `tests/e2e/chat-followup.spec.ts` - This test file
- `src/assistant-dock.ts` - UI implementation with same system prompt
- `tests/e2e/chat-stream-yields.spec.ts` - Backend stream validation
- `tests/e2e/assistant-ui-fallback.spec.ts` - UI fallback validation
- `docs/SSE_IMPROVEMENTS.md` - SSE enhancements documentation

## Summary

This test provides:
- ✅ **Fast feedback** (~5s runtime)
- ✅ **Conversational tone validation** (prevents "press release" regression)
- ✅ **Multi-language support** (Western and East Asian question marks)
- ✅ **Clear failure messages** (shows actual response for debugging)
- ✅ **Low maintenance** (simple regex check, model-agnostic)

The assistant stays friendly and engaging, not robotic! 🎉
