# Agent Uploads & Gallery Tools

**Comprehensive file upload system with gallery integration and agent automation.**

## Overview

This system enables:
- **File uploads** via chat interface (images, videos)
- **Automatic gallery card creation** with metadata
- **FFmpeg poster generation** for videos
- **Agent-callable gallery tools** for autonomous content management
- **Sitemap auto-refresh** after changes
- **Media validation** to catch errors

## Architecture

### Backend Components

**File:** `assistant_api/services/gallery_service.py` (190 lines)

Core service handling:
- File storage in `public/assets/{uploads,video}/YYYY/MM/`
- Gallery JSON CRUD operations
- FFmpeg integration for video posters
- Sitemap refresh orchestration
- Media lint validation

**Key functions:**
- `save_upload()` - Store files with date-based paths
- `ffmpeg_poster()` - Extract 1280px poster frame at 1s
- `add_gallery_item()` - Create gallery card
- `run_sitemap_refresh()` - Trigger sitemap regeneration
- `run_media_lint()` - Validate assets exist

### API Endpoints

#### 1. Upload Endpoint

**File:** `assistant_api/routers/uploads.py`

```
POST /api/uploads
Content-Type: multipart/form-data

Fields:
  file: File (required)
  make_card: bool (default: false)
  title: string (optional, defaults to filename)
  description: string (optional)
  tools: string (comma-separated, optional)
  tags: string (comma-separated, optional)

Response:
{
  "ok": true,
  "url": "/assets/video/2025/10/demo.mp4",
  "kind": "video",
  "item": { ... },      // if make_card=true
  "lint_ok": true       // if make_card=true
}
```

**Features:**
- Accepts images and videos
- Auto-detects type by extension
- Generates FFmpeg poster for videos (if available)
- Optional gallery card creation
- Automatic sitemap refresh

#### 2. Gallery Add Endpoint

**File:** `assistant_api/routers/gallery.py`

```
POST /api/gallery/add
Content-Type: application/json

Body:
{
  "title": "Project Title",
  "description": "Brief description",
  "type": "image|video-local|youtube|vimeo",
  "src": "/assets/video/demo.mp4",
  "poster": "/assets/video/demo.jpg",
  "mime": "video/mp4",
  "tools": ["ComfyUI", "Blender"],
  "workflow": ["Step 1", "Step 2"],
  "tags": ["animation", "shader"]
}

Response:
{
  "ok": true,
  "item": { ... },
  "lint_ok": true
}
```

**Use cases:**
- Agent-initiated gallery additions
- YouTube/Vimeo embed cards
- Manual API usage

## File Organization

### Upload Paths

```
public/
├── assets/
│   ├── uploads/     # Images
│   │   └── YYYY/MM/
│   │       └── filename.jpg
│   └── video/       # Videos
│       └── YYYY/MM/
│           ├── clip.mp4
│           └── clip.jpg  # Auto-generated poster
└── gallery.json     # Updated automatically
```

### Gallery JSON Structure

```json
{
  "items": [
    {
      "id": "pixel-banana-abc123",
      "title": "Pixel Banana Demo",
      "description": "ComfyUI procedural animation",
      "date": "2025-10-06",
      "type": "video-local",
      "src": "/assets/video/2025/10/demo.mp4",
      "poster": "/assets/video/2025/10/demo.jpg",
      "mime": "video/mp4",
      "tools": ["ComfyUI", "Python"],
      "workflow": ["Generate base", "Animate", "Export"],
      "tags": ["animation", "sprites"]
    }
  ]
}
```

## FFmpeg Integration

### Poster Generation

When a video is uploaded with `make_card=true`:

1. Video saved to `public/assets/video/YYYY/MM/filename.mp4`
2. FFmpeg extracts frame: `ffmpeg -y -ss 00:00:01.000 -i input.mp4 -vframes 1 -vf scale=1280:-2 output.jpg`
3. Poster saved as `filename.jpg` in same directory
4. Gallery item includes `poster` field

### Requirements

- **ffmpeg** must be installed and in PATH
- If unavailable, videos are added without posters
- Media linter warns about missing posters

### Manual Poster Generation

Use existing script:
```powershell
npm run poster -- dist/assets/video/demo.mp4 public/assets/video/demo.jpg
```

## Sitemap Integration

### Auto-Refresh

After each gallery modification:
1. `run_sitemap_refresh()` executes `scripts/generate-sitemap.mjs`
2. Gallery items auto-ingested into sitemaps
3. `run_media_lint()` validates assets
4. Response includes `lint_ok` status

### Validation

The linter checks:
- ✅ Required fields present (poster for videos)
- ✅ Asset files exist in dist/
- ✅ URL formats valid
- ⚠️ Warnings for missing posters (videos won't appear in video sitemap)

## Frontend Integration

### API Helpers

**File:** `src/api.ts`

The API module has been extended with upload functions:

```typescript
// Upload file with optional gallery card creation
export async function uploadFile(formData: FormData): Promise<UploadResponse>

// Add gallery item programmatically
export async function galleryAdd(payload: GalleryAddRequest): Promise<GalleryAddResponse>

// CSRF token retrieval (from localStorage or meta tag)
function getCsrfToken(): string
```

**Usage:**
```typescript
import { uploadFile } from '@/api';

const formData = new FormData();
formData.append('file', fileObject);
formData.append('make_card', 'true');
formData.append('title', 'My Upload');

const result = await uploadFile(formData);
console.log('Uploaded:', result.url);
if (result.item) {
  console.log('Gallery card:', result.item.id);
}
```

### Attachment Button Component

**File:** `public/assets/js/attachment-button.js`

Vanilla JavaScript component for chat interface integration.

**Initialization:**
```javascript
// In assistant-dock.ts or similar
AttachmentButton.init('#chatForm', {
  makeCard: true,
  onAdded: (result) => {
    console.log('File uploaded:', result);
  },
  onError: (error) => {
    console.error('Upload failed:', error);
  }
});
```

**Features:**
- 📎 Paperclip icon button
- File chooser for images/videos
- Upload progress indicators (⏳ → ✓/✗)
- Success/error messages in chat log
- Keyboard accessible
- Disabled state during upload

**Styling:**
```css
/* public/assets/css/attachment-button.css */
.attachment-btn {
  /* Matches chat composer button style */
  border: 1px solid var(--lk-border);
  border-radius: 6px;
  padding: 8px 12px;
  margin-right: 8px;
}

.chat-message-success {
  background: color-mix(in srgb, var(--lk-accent) 10%, transparent);
  border-left: 3px solid var(--lk-accent);
}
```

### HTML Integration

**File:** `index.html` (and other pages with chat)

```html
<head>
  <!-- Attachment button CSS -->
  <link rel="stylesheet" href="/assets/css/attachment-button.css">
</head>

<body>
  <!-- Chat form - button is injected automatically -->
  <form id="chatForm" class="chat-composer">
    <input id="chatInput" name="q" placeholder="Ask about my projects..." />
    <!-- Attachment button inserted here by JavaScript -->
    <button id="chatSend" type="submit">Send</button>
  </form>

  <!-- Main TypeScript bundle loads attachment button -->
  <script type="module" src="/src/main.ts"></script>
</body>
```

**Automatic Initialization:**

The attachment button is automatically initialized in `src/assistant-dock.ts`:

```typescript
// Load attachment-button.js dynamically
const script = document.createElement('script');
script.src = '/assets/js/attachment-button.js';
document.head.appendChild(script);

// Initialize after load
AttachmentButton.init('#chatForm', {
  makeCard: true,
  onAdded: (result) => { /* handle success */ },
  onError: (error) => { /* handle error */ }
});
```## Agent Orchestration

### Tool Registration

Add gallery tool to agent's available functions:

```python
# In your agent orchestration
TOOLS = [
    {
        "name": "add_gallery_item",
        "description": "Add image/video to portfolio gallery",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "type": {"type": "string", "enum": ["image", "video-local", "youtube", "vimeo"]},
                "src": {"type": "string"},
                "poster": {"type": "string"},
                "tools": {"type": "array", "items": {"type": "string"}},
                "tags": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["title", "type", "src"]
        }
    }
]
```

### Intent Detection

Examples:
- "Add this to gallery" → Upload + create card
- "Create a card for this YouTube video" → Gallery add with embed
- "Upload and showcase this" → Upload with make_card=true

## Testing

### E2E Test Suite

**File:** `tests/e2e/upload-gallery.spec.ts`

Comprehensive Playwright tests covering:

1. **Attachment button presence and accessibility**
   - Visible in chat interface
   - Has proper ARIA labels
   - Keyboard accessible (Tab + Enter)

2. **File upload flow**
   - Triggers file chooser on click
   - Accepts images and videos
   - Shows loading state during upload
   - Disabled during upload

3. **Gallery card creation**
   - Image uploads create gallery items
   - Video uploads include posters
   - Success messages displayed in chat

4. **Error handling**
   - Failed uploads show error messages
   - Button resets after error
   - User-friendly error text

5. **Security**
   - CSRF tokens included in requests
   - Credentials sent with uploads

**Running tests:**
```powershell
# Run all upload tests
npx playwright test -g "@uploads" --project=chromium

# Run with UI
npx playwright test -g "@uploads" --ui

# Debug specific test
npx playwright test -g "upload image creates gallery card" --debug
```

### Test Coverage

- ✅ Button accessibility (ARIA, keyboard nav)
- ✅ File chooser integration
- ✅ Image upload → gallery card
- ✅ Video upload → gallery card with poster
- ✅ Error handling and messages
- ✅ Loading states and button feedback
- ✅ CSRF token transmission
- ✅ API structure validation

### Manual Testing

**Local test flow:**

1. Start backend:
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
   ```

2. Start frontend:
   ```powershell
   npm run dev
   ```

3. Open browser: `http://localhost:5173`

4. Click assistant chip (💬) to open chat

5. Click attachment button (📎)

6. Select an image or video

7. Verify:
   - ✓ Button shows ⏳ during upload
   - ✓ Success message appears: "Added to gallery: **Title**"
   - ✓ Button returns to 📎
   - ✓ Gallery page (`/gallery.html`) shows new item
   - ✓ Sitemap updated (`/sitemap.xml`)

**Video poster verification:**

```powershell
# Check if FFmpeg is available
ffmpeg -version

# Manually generate poster if needed
npm run poster -- public/assets/video/2025/10/demo.mp4 public/assets/video/2025/10/demo.jpg

# Verify poster exists
Test-Path public/assets/video/2025/10/demo.jpg
```## Security

### Cloudflare Access Authentication

**All upload routes are protected by Cloudflare Access JWT verification.** This provides enterprise-grade authentication without managing passwords or sessions.

**Backend Verification (`assistant_api/utils/cf_access.py`):**
```python
def require_cf_access(request: Request) -> str:
    """
    Verifies Cf-Access-Jwt-Assertion header against Cloudflare's JWKS.

    Returns:
        str: User's email address from verified JWT

    Raises:
        HTTPException: 403 if header missing, 401 if JWT invalid, 403 if email not allowed
    """
    token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not token:
        raise HTTPException(403, "Cloudflare Access required")

    # Verify JWT signature against Cloudflare's public keys
    unverified = jwt.get_unverified_header(token)
    key = _get_key_for_kid(unverified.get("kid", ""))

    claims = jwt.decode(
        token,
        key=key,
        algorithms=["RS256", "ES256"],  # CF can use either
        audience=AUD if AUD else None,
        options={"verify_exp": True, "verify_aud": bool(AUD)},
    )

    email = (claims.get("email") or "").lower()
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Not allowed")

    return email  # Principal for logging
```

**How it works:**
1. Cloudflare Tunnel proxies requests to backend
2. Cloudflare Access intercepts unauthenticated requests → shows login page
3. After authentication, CF Access adds `Cf-Access-Jwt-Assertion` header with signed JWT
4. Backend verifies JWT signature using Cloudflare's JWKS (cached for 10 minutes)
5. Optional email allowlist provides additional filtering

**Configuration:**
```bash
# Required environment variables
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=your-application-audience-tag
ACCESS_ALLOWED_EMAILS=admin@example.com,user@example.com  # Optional
```

**Security Benefits:**
- ✅ No password management (uses identity providers: Google, GitHub, etc.)
- ✅ JWT signature verification prevents header spoofing
- ✅ Short-lived tokens (auto-expire)
- ✅ Centralized access control in Cloudflare dashboard
- ✅ Audit logs of all authentication attempts
- ✅ No CSRF needed (no cookies/sessions)

### File Validation

**Size Limits:**
- Images: 30MB (configurable via `MAX_IMAGE_MB`)
- Videos: 200MB (configurable via `MAX_VIDEO_MB`)

**Allowed File Types:**
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.svg`
- Videos: `.mp4`, `.mov`, `.webm`, `.mkv`, `.m4v`

**Backend Validation (`assistant_api/routers/uploads.py`):**
```python
# Size check
MAX_IMG_MB = int(os.getenv("MAX_IMAGE_MB", "30"))
MAX_VID_MB = int(os.getenv("MAX_VIDEO_MB", "200"))

content = await file.read()
size_mb = len(content) / (1024 * 1024)

if (is_video and size_mb > MAX_VID_MB) or (not is_video and size_mb > MAX_IMG_MB):
    raise HTTPException(413, detail="File too large")

# MIME type check
if not is_video and not ext.endswith(('.png', '.jpg', ...)):
    raise HTTPException(415, detail="Unsupported media type")
```

### Path Safety

- All paths use `Path` objects
- No directory traversal allowed
- Files stored under controlled directories
- Filename sanitization (slugify)

## Configuration

### Environment Variables

**Backend - Cloudflare Access (`assistant_api/.env` or docker-compose):**
```bash
# Cloudflare Access JWT Verification
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=your-application-audience-tag-here
ACCESS_ALLOWED_EMAILS=admin@example.com,user@example.com  # Optional: extra filter

# Size Limits
MAX_IMAGE_MB=30                # Max image size (default: 30)
MAX_VIDEO_MB=200               # Max video size (default: 200)
```

**How to find your CF Access values:**
1. **Team Domain:** From Cloudflare Zero Trust dashboard → Settings → Custom Pages URL
2. **AUD Tag:** From Cloudflare Access → Applications → Your App → Overview → Application Audience (AUD) Tag
3. **Allowed Emails:** Optional comma-separated list for additional filtering beyond CF Access policies

**Production Security:**
- ✅ CF Access handles all authentication (Google, GitHub, email OTP, etc.)
- ✅ JWT signature verification prevents header spoofing
- ✅ Size limits enforced (30MB images, 200MB videos)
- ✅ MIME type validation (whitelist only)
- ✅ No CSRF needed (Cloudflare Tunnel prevents direct origin access)
- ✅ Same validation as production

### Nginx (Upload Size)

```nginx
# nginx.conf or site config
server {
    client_max_body_size 256m;  # Allow large video uploads
    client_body_timeout 300s;
    # ...
}
```

### Environment Variables

None required - all paths derived from `__file__` location.

## Troubleshooting

### FFmpeg Not Found

**Symptom:** Videos uploaded without posters

**Solution:**
```powershell
# Install FFmpeg
choco install ffmpeg  # Windows
brew install ffmpeg   # macOS
apt install ffmpeg    # Linux

# Verify
ffmpeg -version
```

### Sitemap Not Refreshing

**Check:**
1. `scripts/generate-sitemap.mjs` exists
2. Node.js in PATH
3. Check terminal output for errors

**Manual refresh:**
```powershell
$env:SITE_URL="https://leok.dev"; node scripts/generate-sitemap.mjs
```

### Upload Path Issues

**Windows path separators:** Service converts `\` to `/` for URLs

**Verify paths:**
```python
from assistant_api.services.gallery_service import UPLOADS, VIDEOS
print(f"Uploads: {UPLOADS}")
print(f"Videos: {VIDEOS}")
```

## Performance

### Optimization Tips

1. **Large videos:** Consider transcoding to lower bitrate
2. **Poster generation:** Takes ~1-2s per video
3. **Sitemap refresh:** Async, doesn't block response
4. **Media lint:** Fast validation, ~100ms

### Scaling Considerations

- For many uploads: Consider cloud storage (S3, Cloudflare R2)
- For many concurrent uploads: Add job queue (Celery, Redis)
- For large files: Implement chunked uploads

## Future Enhancements

**Potential improvements:**
- Drag & drop interface
- Multiple file uploads
- Progress indicators
- Image optimization (WebP conversion)
- Video transcoding queue
- Gallery item editing/deletion
- Bulk operations
- Advanced filtering

## Summary

**Files Created:**
- `assistant_api/services/gallery_service.py` (190 lines)
- `assistant_api/routers/uploads.py` (105 lines)
- `assistant_api/routers/gallery.py` (75 lines)

**Files Modified:**
- `assistant_api/main.py` (added router registration)

**Features:**
- ✅ File upload with auto-gallery
- ✅ FFmpeg poster generation
- ✅ Agent-callable gallery tools
- ✅ Sitemap auto-refresh
- ✅ Media validation
- ✅ CSP-compliant
- ✅ CSRF-protected

**Ready for:** Chat attachments, agent automation, portfolio showcase management
