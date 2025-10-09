(function () {
  const $ = (sel) => document.querySelector(sel);
  const upload = $('[data-testid="analytics-upload"]');
  const ingestBtn = $('[data-testid="analytics-ingest-btn"]');
  const runBtn = $('[data-testid="seo-tune-run-btn"]');
  const artLink = $('[data-testid="seo-tune-artifact-link"]');
  const log = $('#seo-analytics-log');
  const authInput = $('#seo-auth');

  function logLine(msg) {
    if (!log) return;
    const when = new Date().toISOString().replace('T', ' ').replace('Z', '');
    log.textContent += `[${when}] ${msg}\n`;
    log.scrollTop = log.scrollHeight;
  }

  function authHeaders() {
    const token = (authInput && authInput.value || '').trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  upload?.addEventListener('change', () => {
    ingestBtn.disabled = !(upload.files && upload.files[0]);
  });

  ingestBtn?.addEventListener('click', async () => {
    if (!upload.files || !upload.files[0]) return;
    try {
      const file = upload.files[0];
      const text = await file.text();
      let res;

      // Detect CSV by file type or extension
      if (file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv')) {
        // Send raw CSV with text/csv content-type
        logLine(`📤 Ingesting CSV file: ${file.name}...`);
        res = await fetch('/agent/analytics/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv', ...authHeaders() },
          body: text,
          credentials: 'include'
        });
      } else {
        // Try JSON; if it's not valid JSON, send as-is and let backend try CSV fallback
        let data;
        try {
          data = JSON.parse(text);
          if (data.rows && Array.isArray(data.rows)) {
            logLine(`📤 Ingesting ${data.rows.length} rows from ${data.source || 'unknown'}...`);
          } else {
            logLine(`📤 Ingesting JSON data...`);
          }
        } catch {
          // Not valid JSON, might be CSV without proper extension
          logLine(`📤 Ingesting data (format auto-detect)...`);
          data = text;
        }

        res = await fetch('/agent/analytics/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: (typeof data === 'string') ? data : JSON.stringify(data),
          credentials: 'include'
        });
      }

      if (!res.ok) {
        const err = await res.text();
        logLine(`❌ Ingest failed: ${res.status} ${err}`);
        return;
      }
      const json = await res.json();
      logLine(`✅ Ingested ${json.rows} rows (${json.inserted_or_updated} changed) from ${json.source}.`);
    } catch (e) {
      logLine(`❌ Ingest error: ${e}`);
    }
  });

  runBtn?.addEventListener('click', async () => {
    try {
      logLine('🚀 Running seo.tune task...');
      const res = await fetch('/agent/run?task=seo.tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: '{}',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.text();
        logLine(`❌ seo.tune failed: ${res.status} ${err}`);
        return;
      }
      const json = await res.json();
      logLine(`✅ seo.tune ok. Pages tuned: ${json.count}.`);

      // Validate artifact exists; prefer MD, fallback to JSON
      const probe = await fetch('/agent/artifacts/seo-tune.md', { method: 'HEAD', credentials: 'include' });
      if (probe.ok) {
        artLink.href = '/agent/artifacts/seo-tune.md';
        logLine('🔗 Artifact ready → seo-tune.md');
      } else {
        artLink.href = '/agent/artifacts/seo-tune.json';
        logLine('🔗 Artifact ready → seo-tune.json');
      }
    } catch (e) {
      logLine(`❌ Run error: ${e}`);
    }
  });

  // Optional: enable ingest button if browser remembered a file (rare)
  if (upload && upload.files && upload.files[0]) {
    ingestBtn.disabled = false;
  }

  logLine('ℹ️  SEO Analytics panel loaded. Upload JSON → Ingest → Run Tune.');
})();
