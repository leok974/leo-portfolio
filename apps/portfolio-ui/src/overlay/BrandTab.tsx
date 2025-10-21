import { useState } from 'preact/hooks';

interface BrandTabProps {
  apiBaseUrl?: string;
}

interface CardExport {
  png?: string[];
  pdf?: string[];
}

interface CardResponse {
  ok: boolean;
  file_key: string;
  export: CardExport;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function BrandTab({ apiBaseUrl = '/api' }: BrandTabProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setStatus('loading');
    setError(null);

    try {
      // Step 1: Fetch site metadata (name, role, email, domain)
      // TODO: Replace with actual metadata endpoint or pass from parent
      const meta = {
        name: 'Leo Klemet',
        role: 'Full Stack Developer',
        email: 'leo@leoklemet.com',
        domain: 'leoklemet.com',
        qr_url: 'https://leoklemet.com'
      };

      // Step 2: Generate business card
      const res = await fetch(`${apiBaseUrl}/agent/brand/card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add admin authentication header if required
          // 'x-admin-key': getAdminKey(),
        },
        body: JSON.stringify(meta),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Card generation failed');
      }

      const data: CardResponse = await res.json();

      // Step 3: Set preview image and file key
      if (data.export?.png?.[0]) {
        setPreview(data.export.png[0]);
      }
      if (data.file_key) {
        setFileKey(data.file_key);
      }

      setStatus('done');
    } catch (e) {
      console.error('Card generation error:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }

  const figmaUrl = fileKey
    ? `https://www.figma.com/file/${fileKey}`
    : null;

  return (
    <div class="space-y-4 p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Brand Assets</h3>
        <span class="text-xs opacity-50">Phase 51 MVP</span>
      </div>

      <div class="space-y-2">
        <p class="text-sm opacity-70">
          Generate branded business cards from your site metadata and design tokens.
        </p>

        <div class="flex gap-2 flex-wrap">
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={onGenerate}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Generating...' : 'Generate Business Card'}
          </button>

          {figmaUrl && (
            <a
              class="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors inline-flex items-center gap-2"
              href={figmaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.332 8.668a3.333 3.333 0 0 0 0-6.663H8.668a3.333 3.333 0 0 0 0 6.663 3.333 3.333 0 0 0 0 6.665 3.333 3.333 0 0 0 0 6.664A3.334 3.334 0 0 0 12 18.664V8.668h3.332z" />
                <circle cx="15.332" cy="12" r="3.332" />
              </svg>
              Open in Figma
            </a>
          )}

          <a
            class="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            href="/agent/artifacts/cards/"
            target="_blank"
          >
            View Artifacts
          </a>
        </div>
      </div>

      {status === 'error' && error && (
        <div class="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p class="text-sm text-red-400">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {preview && (
        <div class="space-y-2">
          <h4 class="text-sm font-medium">Preview</h4>
          <div class="border border-gray-700 rounded-xl overflow-hidden shadow-lg">
            <img
              src={preview}
              alt="Business card preview"
              class="w-full h-auto"
              loading="lazy"
            />
          </div>
          <div class="flex gap-2 text-xs">
            <a
              href={preview}
              download="business-card.png"
              class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Download PNG
            </a>
            {/* TODO: Add PDF download link when available */}
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div class="flex items-center gap-2 text-sm opacity-70">
          <div class="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span>Duplicating template and injecting metadata...</span>
        </div>
      )}
    </div>
  );
}
