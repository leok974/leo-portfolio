const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read the projects data
const projectsData = JSON.parse(fs.readFileSync('projects.json', 'utf8'));

// Read the main index.html to extract the base template structure
const indexHTML = fs.readFileSync('index.html', 'utf8');

// Determine ordering of projects (stable by key order in JSON)
const orderedSlugs = Object.keys(projectsData);

// Load last modification metadata store
const lastmodPath = path.join(__dirname, '.lastmod.json');
let lastmodStore = {};
try { if (fs.existsSync(lastmodPath)) lastmodStore = JSON.parse(fs.readFileSync(lastmodPath,'utf8')); } catch(e){ console.warn('Could not read lastmod store', e); }

function formatDisplayDate(iso) {
  try {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch(_) {
    return iso;
  }
}

function hashProject(project){
  const relevant = {
    title: project.title,
    description: project.description,
    problem: project.problem,
    solution: project.solution,
    stack: project.stack,
    outcomes: project.outcomes,
    tags: project.tags,
    images: project.images?.map(i=>({src:i.src,alt:i.alt,caption:i.caption})) || [],
    videos: project.videos?.map(v=>({poster:v.poster,sources:v.sources?.map(s=>s.src)})) || []
  };
  const str = JSON.stringify(relevant);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0,16);
}

// Ensure each slug has stable lastmod unless changed and record datePublished
orderedSlugs.forEach(slug=>{
  const proj = projectsData[slug];
  const hash = hashProject(proj);
  if (!lastmodStore[slug]) {
    lastmodStore[slug] = { hash, lastmod: new Date().toISOString().split('T')[0], datePublished: new Date().toISOString().split('T')[0] };
  } else if (lastmodStore[slug].hash !== hash) {
    // update lastmod only
    lastmodStore[slug].hash = hash;
    lastmodStore[slug].lastmod = new Date().toISOString().split('T')[0];
    // preserve existing datePublished
  }
  // Add datePublished fallback if older store missing it
  if (!lastmodStore[slug].datePublished) lastmodStore[slug].datePublished = lastmodStore[slug].lastmod;
});

// Build JSON-LD structured data for a project
function buildJsonLd(project, slug) {
  const url = `https://leok974.github.io/leo-portfolio/projects/${slug}.html`;
  const image = project.images && project.images.length ? `https://leok974.github.io/leo-portfolio/${project.images[0].src}` : undefined;
  const baseSoftware = {
      '@type': 'SoftwareSourceCode',
      name: project.title,
      description: project.description,
      url,
      codeRepository: project.repo || undefined,
      programmingLanguage: project.stack && project.stack.length ? project.stack.join(', ') : undefined,
      image,
      dateModified: (lastmodStore[slug] && lastmodStore[slug].lastmod) ? lastmodStore[slug].lastmod : new Date().toISOString().split('T')[0],
    datePublished: (lastmodStore[slug] && lastmodStore[slug].datePublished) ? lastmodStore[slug].datePublished : undefined,
      author: { '@type': 'Person', name: 'Leo Klemet' },
      keywords: project.tags ? project.tags.join(', ') : undefined
  };
  Object.keys(baseSoftware).forEach(k => baseSoftware[k] === undefined && delete baseSoftware[k]);

  // BreadcrumbList
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://leok974.github.io/leo-portfolio/' },
      { '@type': 'ListItem', position: 2, name: 'Projects', item: 'https://leok974.github.io/leo-portfolio/#projects' },
      { '@type': 'ListItem', position: 3, name: project.title, item: url }
    ]
  };

  // CreativeWork / Project representation
  const creative = {
    '@type': 'CreativeWork',
    name: project.title,
    description: project.description,
    url,
    dateModified: baseSoftware.dateModified,
    datePublished: baseSoftware.datePublished,
    lastReviewed: baseSoftware.dateModified,
    creator: { '@type': 'Person', name: 'Leo Klemet' },
    keywords: project.tags ? project.tags.join(', ') : undefined,
    about: project.problem || undefined,
    thumbnailUrl: image || undefined
  };
  Object.keys(creative).forEach(k => creative[k] === undefined && delete creative[k]);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [ baseSoftware, creative, breadcrumb ] }, null, 2);
}

// Template for individual project pages
function generateProjectPage(project, slug) {
  const index = orderedSlugs.indexOf(slug);
  const prevSlug = index > 0 ? orderedSlugs[index - 1] : null;
  const nextSlug = index < orderedSlugs.length - 1 ? orderedSlugs[index + 1] : null;
  const prevProj = prevSlug ? projectsData[prevSlug] : null;
  const nextProj = nextSlug ? projectsData[nextSlug] : null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${project.title} — Leo Klemet Portfolio</title>
  <meta name="description" content="${project.description}" />
  <meta property="og:title" content="${project.title} — Leo Klemet Portfolio" />
  <meta property="og:description" content="${project.description}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="/assets/${slug}-detail.webp" />
  <link rel="canonical" href="https://leok974.github.io/leo-portfolio/projects/${slug}.html" />
  <meta name="theme-color" content="#0f172a" />
  <script type="application/ld+json">${buildJsonLd(project, slug)}</script>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <style>
    .project-header {
      padding: 2rem 0;
      border-bottom: 1px solid var(--border);
    }
    .project-content {
      padding: 3rem 0;
    }
    .meta-dates { margin-top:1rem; font-size:.75rem; letter-spacing:.5px; text-transform:uppercase; color: var(--muted); display:flex; gap:1.25rem; flex-wrap:wrap; }
    .meta-dates time { font-weight:600; color: var(--text); text-transform:none; letter-spacing:0; font-size:.8rem; }
    .meta-dates span.label { font-weight:500; }
    .breadcrumb { font-size:.8rem; display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; margin-bottom:1rem; color:var(--muted); }
    .breadcrumb a { color: var(--muted); }
    .breadcrumb a:hover { color: var(--text); }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      margin-bottom: 1rem;
      color: var(--muted);
      padding: .5rem .75rem;
      border-radius: .6rem;
      border: 1px solid var(--border);
    }
    .back-link:hover {
      color: var(--text);
      background: color-mix(in oklab, var(--card) 80%, transparent);
    }
    .project-nav { border-top:1px solid var(--border); margin-top:3rem; padding-top:2rem; display:flex; justify-content:space-between; gap:1rem; }
    .project-nav a { flex:1; display:flex; flex-direction:column; padding:1rem 1.25rem; border:1px solid var(--border); border-radius:.8rem; background: var(--card); }
    .project-nav a:hover { border-color: color-mix(in oklab, var(--accent) 45%, var(--border)); }
    .project-nav span.label { font-size:.7rem; text-transform:uppercase; letter-spacing:.5px; color: var(--muted); margin-bottom:.25rem; }
    @media (max-width:700px){ .project-nav { flex-direction:column; } }
  /* Gallery */
  .gallery-dialog { border:none; padding:0; background:transparent; max-width: min(90vw,1000px); }
  .gallery-dialog::backdrop { background: rgba(0,0,0,.65); backdrop-filter: blur(4px); }
  .gallery-frame { position:relative; background: var(--card); padding:1.5rem 2.5rem; border:1px solid var(--border); border-radius:1rem; box-shadow: var(--shadow); display:flex; flex-direction:column; align-items:center; }
  .gallery-frame img { max-width:100%; height:auto; border-radius:.5rem; }
  .gallery-close, .gallery-prev, .gallery-next { position:absolute; top: .75rem; background: var(--card); border:1px solid var(--border); width:2.2rem; height:2.2rem; border-radius:.6rem; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.1rem; }
  .gallery-close { right:.75rem; }
  .gallery-prev { left:.75rem; top: 50%; transform: translateY(-50%); }
  .gallery-next { right:.75rem; top: 50%; transform: translateY(-50%); }
  .gallery-close:hover, .gallery-prev:hover, .gallery-next:hover { border-color: color-mix(in oklab, var(--accent) 45%, var(--border)); }
  .gallery-item { cursor: zoom-in; }
  .gallery-thumbs { margin-top:1rem; display:flex; gap:.5rem; flex-wrap:wrap; justify-content:center; }
  .gallery-thumbs button { border:1px solid var(--border); background: var(--card); padding:0; width:60px; height:40px; border-radius:.4rem; overflow:hidden; cursor:pointer; position:relative; }
  .gallery-thumbs button img { width:100%; height:100%; object-fit:cover; }
  .gallery-thumbs button[aria-current="true"] { outline:2px solid var(--accent); outline-offset:2px; }
  .gallery-thumbs button:hover { border-color: color-mix(in oklab, var(--accent) 45%, var(--border)); }
  .gallery-thumbs button:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
  .gallery-thumbs button[aria-current="true"]:focus-visible { outline:3px solid var(--accent); }
  </style>
</head>
<body>
  <a class="sr-only" href="#content">Skip to content</a>

  <header>
    <div class="container nav">
      <div class="brand"><a href="../">Leo Klemet</a></div>
      <nav aria-label="Primary">
        <ul>
          <li><a href="../#projects">Projects</a></li>
          <li><a href="../#about">About</a></li>
          <li><a href="../#contact">Contact</a></li>
          <li><a href="../#blog">Blog</a></li>
        </ul>
      </nav>
      <button class="theme-toggle" id="themeToggle" aria-pressed="false" aria-label="Toggle dark/light mode">
        <span aria-hidden="true">🌙</span>
        <input id="themeSwitch" type="checkbox" aria-hidden="true" />
        <span aria-hidden="true">☀️</span>
      </button>
    </div>
  </header>

  <main id="content">
    <section class="project-header">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="../">Home</a>
          <span aria-hidden="true">/</span>
          <a href="../#projects">Projects</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">${project.title}</span>
        </nav>
        <h1>${project.title}</h1>
        <p class="subline">${project.description}</p>
        ${project.repo ? `<p><a class="btn" href="${project.repo}" target="_blank" rel="noopener">GitHub Repo ↗</a></p>` : ''}
        <div class="tags">
          ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="meta-dates" aria-label="Publication and last update dates">
          <div><span class="label">Published:</span> <time datetime="${lastmodStore[slug].datePublished}">${formatDisplayDate(lastmodStore[slug].datePublished)}</time></div>
          <div><span class="label">Updated:</span> <time datetime="${lastmodStore[slug].lastmod}">${formatDisplayDate(lastmodStore[slug].lastmod)}</time></div>
        </div>
      </div>
    </section>

    <section class="project-content">
      <div class="container">
        ${generateStructuredSections(project)}
      </div>
    </section>
    <div class="container">
      <nav class="project-nav" aria-label="Project navigation">
        ${prevProj ? `<a href="${prevSlug}.html" aria-label="Previous project: ${prevProj.title}"><span class="label">Previous</span><strong>${prevProj.title}</strong></a>` : '<div></div>'}
        ${nextProj ? `<a href="${nextSlug}.html" style="text-align:right" aria-label="Next project: ${nextProj.title}"><span class="label">Next</span><strong>${nextProj.title}</strong></a>` : '<div></div>'}
      </nav>
    </div>
  </main>

  <footer>
    <div class="container footer-grid">
      <div>© <span id="year"></span> Leo Klemet</div>
      <div class="muted">AI Engineer · SWE · Generative AI / 3D Artist & Creative Technologist</div>
      <div style="text-align:right">
        <a href="../">Back to portfolio ↑</a>
      </div>
    </div>
  </footer>
  <dialog id="galleryDialog" class="gallery-dialog" aria-label="Image gallery" aria-modal="true" inert>
    <div class="gallery-frame">
      <button class="gallery-close" id="galleryClose" aria-label="Close gallery">×</button>
      <button class="gallery-prev" id="galleryPrev" aria-label="Previous image">‹</button>
      <img id="galleryImage" alt="" />
      <button class="gallery-next" id="galleryNext" aria-label="Next image">›</button>
      <p id="galleryCaption" class="muted" style="margin-top:.75rem"></p>
      <div id="galleryThumbs" class="gallery-thumbs" aria-label="Gallery thumbnails" role="list"></div>
      <div id="galleryAnnouncer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    </div>
  </dialog>
  <script src="../main.js"></script>
</body>
</html>`;
}

function generateProjectMedia(project) {
  let html = '';

  function findOptimizedVariants(relPath) {
    try {
      const ext = path.extname(relPath).toLowerCase();
      const base = path.basename(relPath, ext);
      const dir = path.dirname(relPath).replace(/^assets/, 'assets/optimized');
      const sizes = [
        { suffix: '-sm', width: 400 },
        { suffix: '-md', width: 800 },
        { suffix: '-lg', width: 1200 },
        { suffix: '-xl', width: 1920 }
      ];
      const webp = [];
      const avif = [];
      sizes.forEach(s => {
        const webpPath = path.join(__dirname, dir, `${base}${s.suffix}.webp`);
        const avifPath = path.join(__dirname, dir, `${base}${s.suffix}.avif`);
        if (fs.existsSync(webpPath)) webp.push({ width: s.width, url: path.posix.join('/', dir, `${base}${s.suffix}.webp`).replace(/\\/g,'/') });
        if (fs.existsSync(avifPath)) avif.push({ width: s.width, url: path.posix.join('/', dir, `${base}${s.suffix}.avif`).replace(/\\/g,'/') });
      });
      return { webp, avif };
    } catch(_) {
      return { webp: [], avif: [] };
    }
  }

  function renderResponsivePicture(relPath, alt, attrs = '', idx) {
    const variants = findOptimizedVariants(relPath);
    const src = `../${relPath}`;
    const sizes = '(max-width: 700px) 100vw, 900px';
    if ((variants.webp && variants.webp.length) || (variants.avif && variants.avif.length)) {
      const webpSrcset = variants.webp.map(v => `${v.url} ${v.width}w`).join(', ');
      const avifSrcset = variants.avif.map(v => `${v.url} ${v.width}w`).join(', ');
      return (
        `<picture>` +
        (avifSrcset ? `<source type="image/avif" srcset="${avifSrcset}" sizes="${sizes}">` : '') +
        (webpSrcset ? `<source type="image/webp" srcset="${webpSrcset}" sizes="${sizes}">` : '') +
        `<img class="gallery-item" ${typeof idx==='number' ? `data-gallery-index="${idx}"` : ''} src="${src}" alt="${alt}" loading="lazy" decoding="async">` +
        `</picture>`
      );
    }
    return `<img class="gallery-item" ${typeof idx==='number' ? `data-gallery-index="${idx}"` : ''} src="${src}" alt="${alt}" loading="lazy" decoding="async" ${attrs} />`;
  }

  // Add images
  if (project.images && project.images.length > 0) {
    project.images.forEach((img, idx) => {
      const picture = renderResponsivePicture(img.src, img.alt || '', '', idx);
      if (img.caption) {
        html += `<figure>${picture}<figcaption class="muted">${img.caption}</figcaption></figure>`;
      } else {
        html += picture;
      }
    });
  }

  // Add videos
  if (project.videos && project.videos.length > 0) {
    project.videos.forEach(video => {
      html += `<video controls preload="metadata"${video.poster ? ` poster="../${video.poster}"` : ''}>`;
      video.sources.forEach(source => {
        html += `<source src="../${source.src}" type="${source.type}"/>`;
      });
      if (video.captions) {
        html += `<track label="English" kind="captions" srclang="en" src="../${video.captions}" default>`;
      }
      html += '</video>';
    });
  }

  return html;
}

function generateProjectDetails(project) {
  let html = '';

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
      html += `<a href="../${download.href}" download>${download.label}</a>`;
    });
    html += '</div>';
  }

  // Repository link (duplicate in details if desired)
  if (project.repo) {
    html += `<p><a class="btn" href="${project.repo}" target="_blank" rel="noopener">GitHub Repo ↗</a></p>`;
  }

  return html;
  }
  function generateStructuredSections(project) {
    let html = '<article class="case-study">';

    // Problem
    if (project.problem) {
      html += `<section><h2>Problem</h2><p>${project.problem}</p></section>`;
    }

    // Solution
    if (project.solution) {
      html += `<section><h2>Solution</h2><p>${project.solution}</p></section>`;
    }

    // Tech Stack
    if (project.stack && project.stack.length) {
      html += '<section><h2>Tech Stack</h2><ul>' + project.stack.map(i=>`<li>${i}</li>`).join('') + '</ul></section>';
    }

    // Screenshots / GIFs (media)
    const media = generateProjectMedia(project);
    if (media.trim()) {
      html += `<section><h2>Screenshots & Media</h2>${media}</section>`;
    }

    // Outcomes
    if (project.outcomes && project.outcomes.length) {
      html += '<section><h2>Outcomes</h2><ul>' + project.outcomes.map(o=>`<li>${o}</li>`).join('') + '</ul></section>';
    }

    // Links
    let links = '';
    if (project.repo) links += `<a class="btn" href="${project.repo}" target="_blank" rel="noopener">GitHub Repo ↗</a>`;
    if (project.demo) links += `<a class="btn" href="${project.demo}" target="_blank" rel="noopener">Live Demo ↗</a>`;
    if (project.downloads && project.downloads.length) {
      project.downloads.forEach(d=>{ links += `<a class="btn" href="../${d.href}" download>${d.label}</a>`; });
    }
    if (links) html += `<section><h2>Links</h2><div class="card-actions">${links}</div></section>`;

    html += '</article>';
    return html;
}

// Create projects directory if it doesn't exist
const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir);
}

// Generate individual project pages
Object.entries(projectsData).forEach(([slug, project]) => {
  const projectHTML = generateProjectPage(project, slug);
  const fileName = path.join(projectsDir, `${slug}.html`);
  fs.writeFileSync(fileName, projectHTML);
  console.log(`Generated: ${fileName}`);
});

// Persist lastmod store (after successful generation)
try { fs.writeFileSync(lastmodPath, JSON.stringify(lastmodStore, null, 2)); } catch(e){ console.error('Failed to write lastmod store', e); }

// Generate sitemap.xml
try {
  const base = 'https://leok974.github.io/leo-portfolio';
  const urls = [
    `${base}/`,
    ...orderedSlugs.map(slug => `${base}/projects/${slug}.html`)
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u=>{
      if (u.endsWith('/')) {
        // index lastmod = newest project lastmod
        const newest = Object.values(lastmodStore).map(v=>v.lastmod).sort().slice(-1)[0] || new Date().toISOString().split('T')[0];
        return `  <url><loc>${u}</loc><lastmod>${newest}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`;
      } else {
        const slug = u.split('/').pop().replace('.html','');
        const lm = (lastmodStore[slug] && lastmodStore[slug].lastmod) ? lastmodStore[slug].lastmod : new Date().toISOString().split('T')[0];
        return `  <url><loc>${u}</loc><lastmod>${lm}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
      }
    }).join('\n') +
    `\n</urlset>`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
  console.log('sitemap.xml generated');
} catch(e) {
  console.error('Failed to generate sitemap:', e);
}

console.log('Project pages generated successfully!');
