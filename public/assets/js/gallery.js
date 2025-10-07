(function () {
  const GRID = document.getElementById('galleryGrid');
  const SEARCH = document.getElementById('search');
  const TAGBAR = document.getElementById('tagBar');
  const TPL = document.getElementById('card-tpl');

  let items = [], filtered = [], activeTag = null;

  function by(q, root=document){ return root.querySelector(q); }
  function el(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }

  async function loadManifest() {
    const res = await fetch('/gallery.json',{cache:'no-store'});
    if(!res.ok) throw new Error('gallery.json not found');
    const data = await res.json();
    items = Array.isArray(data.items) ? data.items : [];
    filtered = items.slice();
    renderTags();
    render();
    window.__galleryReady = true;
  }

  function renderTags() {
    const tags = [...new Set(items.flatMap(i => (i.tools||[])))].sort();
    TAGBAR.innerHTML = '';
    const allBtn = el('button','tag'); allBtn.textContent = 'All';
    allBtn.dataset.tag = ''; allBtn.ariaPressed = 'true';
    TAGBAR.appendChild(allBtn);
    for(const t of tags){
      const b = el('button','tag'); b.textContent = t; b.dataset.tag = t;
      TAGBAR.appendChild(b);
    }
  }

  function matchesQuery(it, q) {
    if(!q) return true;
    q = q.toLowerCase();
    return (it.title||'').toLowerCase().includes(q)
        || (it.description||'').toLowerCase().includes(q)
        || (it.tools||[]).join(' ').toLowerCase().includes(q)
        || (it.tags||[]).join(' ').toLowerCase().includes(q);
  }

  function applyFilters(){
    const q = SEARCH.value.trim();
    filtered = items.filter(i => matchesQuery(i,q) && (!activeTag || (i.tools||[]).includes(activeTag)));
    render();
  }

  function render() {
    GRID.innerHTML = '';
    for(const it of filtered){
      const card = TPL.content.firstElementChild.cloneNode(true);
      by('.title',card).textContent = it.title || 'Untitled';
      const meta = by('.meta',card);
      meta.innerHTML = `
        <span>${it.date ?? ''}</span>
        ${it.tools?.map(t => `<span class="pill">${t}</span>`).join('') || ''}
      `;

      const media = by('.media',card);
      if(it.type === 'video-local' && it.src){
        const v = el('video','vid'); v.controls = true; v.preload='metadata';
        if(it.poster) v.poster = it.poster;
        const s = el('source'); s.src = it.src; s.type = it.mime || 'video/mp4';
        v.appendChild(s); media.appendChild(v);
      } else if((it.type === 'youtube' || it.type === 'vimeo') && it.src){
        // consent-gated embeds
        const ok = window.consent?.get?.('embeds');
        if(ok){
          const iframe = el('iframe','embed');
          iframe.src = it.src; iframe.title = it.title || 'Video';
          iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
          iframe.setAttribute('allowfullscreen','');
          media.appendChild(iframe);
        } else {
          const ph = el('div','embed-placeholder');
          ph.innerHTML = `
            <div class="ph-body">
              <p>To view this embed, enable <strong>Embeds</strong> in <a href="/privacy.html">Privacy</a>.</p>
              <button class="btn-enable">Enable embeds now</button>
            </div>`;
          ph.querySelector('.btn-enable').addEventListener('click', () => {
            if(window.consent?.set){ window.consent.set('embeds', true); applyFilters(); }
          });
          media.appendChild(ph);
        }
      } else if(it.type === 'image' && it.src){
        const img = el('img','img'); img.loading='lazy'; img.src = it.src; img.alt = it.alt || it.title || '';
        media.appendChild(img);
      }

      const steps = by('.steps',card);
      (it.workflow||[]).forEach(s => {
        const li = el('li'); li.textContent = s; steps.appendChild(li);
      });

      card.setAttribute('data-testid','gallery-card');
      GRID.appendChild(card);
    }
  }

  TAGBAR?.addEventListener('click', (e) => {
    const b = e.target.closest('button.tag'); if(!b) return;
    TAGBAR.querySelectorAll('button').forEach(x => x.ariaPressed='false');
    b.ariaPressed='true'; activeTag = b.dataset.tag || null; applyFilters();
  });

  SEARCH?.addEventListener('input', () => applyFilters());
  window.addEventListener('consent:changed', (e) => {
    if(e.detail.key==='embeds') applyFilters();
  });
  window.addEventListener('consent:ready', applyFilters, { once:true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', loadManifest, { once:true })
    : loadManifest();
})();
