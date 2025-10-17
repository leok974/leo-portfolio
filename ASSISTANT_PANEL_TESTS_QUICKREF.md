# Assistant Panel Tests - Quick Reference

## Run Tests

```powershell
# Headless (default)
npm run test:assistant-panel

# Interactive UI mode
npm run test:assistant-panel:ui

# Headed (see browser)
npm run test:assistant-panel:headed
```

## What's Tested

### ✅ Hide/Show Functionality
- Hide button click
- localStorage persistence (`portfolio:assistant:hidden`)
- State survives reload
- Escape key hides
- Alt+P reopens
- Multiple reload persistence

### ✅ Layout Panel
- Null handling (friendly message)
- Refresh button
- JSON rendering when data exists

### ✅ SEO & Meta Tags
- og:image absolute URL (leoklemet.com)
- og:url correct domain
- og:image dimensions (1200×630)
- canonical link
- twitter:image URL
- JSON-LD structured data

## Data-testid Selectors

```typescript
'assistant-panel'          // Main container
'assistant-hide'           // Hide button
'assistant-layout-toggle'  // Layout details
'assistant-layout-empty'   // Null message
'assistant-layout-refresh' // Refresh button
'assistant-layout-json'    // JSON <pre>
```

## localStorage Key

```typescript
'portfolio:assistant:hidden' // '1' = hidden, '0' = visible
```

## Keyboard Shortcuts

- **Escape**: Hide panel
- **Alt+P**: Show panel

## File Locations

- **Tests**: `apps/portfolio-ui/tests/assistant-panel.spec.ts`
- **Component**: `apps/portfolio-ui/src/assistant.main.tsx`
- **Controller**: `apps/portfolio-ui/src/assistant.dock.ts`
- **HTML**: `apps/portfolio-ui/index.html`

## Expected Output

```
Running 11 tests using 1 worker

  ✓ 11 passed (8.9s)
```

## Debug Failed Tests

```powershell
# Run with browser visible
npm run test:assistant-panel:headed

# Run specific test
npx playwright test -g "Hide button collapses" --headed

# Enable trace
$env:PWDEBUG=1
npm run test:assistant-panel
```
