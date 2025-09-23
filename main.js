// -----------------------------
// UTIL: THEME TOGGLE + STORAGE
// -----------------------------
(function themeInit(){
  const saved = localStorage.getItem('theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', initial);
  const switchEl = document.getElementById('themeSwitch');
  if (switchEl) {
    switchEl.checked = (initial === 'light');
    document.getElementById('themeToggle').setAttribute('aria-pressed', (initial === 'light'));
    switchEl.addEventListener('change', () => {
      const mode = switchEl.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', mode);
      document.getElementById('themeToggle').setAttribute('aria-pressed', (mode === 'light'));
      localStorage.setItem('theme', mode);
    });
  }
})();

// -----------------------------
// FOOTER YEAR
// -----------------------------
document.getElementById('year').textContent = new Date().getFullYear();

// -----------------------------
// LAZY-LOAD IMAGES/VIDEOS OUT OF VIEW (extra safety beyond native)
// -----------------------------
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if (e.isIntersecting) {
      const el = e.target;
      if (el.dataset.src) { el.src = el.dataset.src; }
      if (el.dataset.poster) { el.poster = el.dataset.poster; }
      io.unobserve(el);
    }
  });
}, { rootMargin: '200px' });
document.querySelectorAll('img[loading="lazy"], video[preload="metadata"]').forEach(el=> io.observe(el));

// -----------------------------
// PROJECT FILTERING
// -----------------------------
const chips = document.querySelectorAll('.chip');
const cards = document.querySelectorAll('.card');

// Announce filter changes to screen readers
function announceFilterChange(filterName) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = `Showing ${filterName === 'all' ? 'all' : filterName} projects`;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

chips.forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chips.forEach(c=>c.setAttribute('aria-pressed','false'));
    chip.setAttribute('aria-pressed','true');
    const f = chip.dataset.filter;
    const filterName = chip.textContent.trim();

    cards.forEach(card=>{
      const cats = card.dataset.cats.split(' ');
      const show = (f === 'all') || cats.includes(f);
      card.style.display = show ? '' : 'none';
    });

    // Announce the change
    announceFilterChange(filterName);
  });
});

// -----------------------------
// KEYBOARD NAVIGATION ENHANCEMENTS
// -----------------------------
document.addEventListener('keydown', (e) => {
  // ESC key handling for modals
  if (e.key === 'Escape') {
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) openDialog.close();
  }

  // Arrow key navigation for filter chips
  if (e.target.classList.contains('chip')) {
    const chips = Array.from(document.querySelectorAll('.chip'));
    const currentIndex = chips.indexOf(e.target);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % chips.length;
      chips[nextIndex].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex === 0 ? chips.length - 1 : currentIndex - 1;
      chips[prevIndex].focus();
    }
  }
});

// -----------------------------
// PROJECT DATA LOADING
// -----------------------------
let PROJECT_DETAILS = {};

// Load project data from JSON file
async function loadProjectData() {
  try {
    const response = await fetch('projects.json');
    PROJECT_DETAILS = await response.json();
  } catch (error) {
    console.error('Failed to load project data:', error);
  }
}

// Generate project detail HTML from data
function generateProjectHTML(project) {
  let html = '<div>';

  // Add images
  if (project.images && project.images.length > 0) {
    project.images.forEach(img => {
      if (img.caption) {
        html += `<figure>
          <img src="${img.src}" alt="${img.alt}"/>
          <figcaption class="muted">${img.caption}</figcaption>
        </figure>`;
      } else {
        html += `<img src="${img.src}" alt="${img.alt}" />`;
      }
    });
  }

  // Add videos
  if (project.videos && project.videos.length > 0) {
    project.videos.forEach(video => {
      html += `<video controls preload="metadata"${video.poster ? ` poster="${video.poster}"` : ''}>`;
      video.sources.forEach(source => {
        html += `<source src="${source.src}" type="${source.type}"/>`;
      });
      if (video.captions) {
        html += `<track label="English" kind="captions" srclang="en" src="${video.captions}" default>`;
      }
      html += '</video>';
    });
  }

  html += '</div><aside>';

  // Goals section
  if (project.goals) {
    html += `<h4>Goals</h4><p>${project.goals}</p>`;
  }

  // Stack section
  if (project.stack && project.stack.length > 0) {
    html += '<h4>Tools / Stack</h4><ul>';
    project.stack.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += '</ul>';
  }

  // Outcomes section
  if (project.outcomes && project.outcomes.length > 0) {
    html += '<h4>Outcomes</h4><ul>';
    project.outcomes.forEach(outcome => {
      html += `<li>${outcome}</li>`;
    });
    html += '</ul>';
  }

  // Downloads section
  if (project.downloads && project.downloads.length > 0) {
    html += '<div class="downloads">';
    project.downloads.forEach(download => {
      html += `<a href="${download.href}" download>${download.label}</a>`;
    });
    html += '</div>';
  }

  html += '</aside>';
  return html;
}

// -----------------------------
// PROJECT DETAIL CONTENT (modal)
// -----------------------------

// Initialize project modal functionality
function initializeProjectModals() {
  const dialogEl = document.getElementById('detailDialog');
  const contentEl = document.getElementById('detailContent');

  document.querySelectorAll('[data-detail]').forEach(btn => {
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const key = btn.getAttribute('data-detail');
      const data = PROJECT_DETAILS[key];
      if (!data) return;
      document.getElementById('detailTitle').textContent = data.title;
      contentEl.innerHTML = generateProjectHTML(data);
      if (typeof dialogEl.showModal === 'function') dialogEl.showModal();
      else dialogEl.setAttribute('open','');
    });
  });

  document.getElementById('detailClose').addEventListener('click', ()=> dialogEl.close());

  // -----------------------------
  // ACCESSIBILITY ENHANCEMENTS
  // -----------------------------
  // Keyboard ESC closes the dialog
  dialogEl.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') dialogEl.close(); });
  // Focus trap for dialog (very light)
  dialogEl.addEventListener('close', ()=>{ contentEl.innerHTML = ''; });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
  await loadProjectData();
  initializeProjectModals();
});

// -------------------------------------
// NOTE: Dedicated detail pages (optional)
// -------------------------------------
// Later, create /projects/<slug>.html pages using the same content structure.
// For now, the modal shows a full case‑study experience without leaving the page.
