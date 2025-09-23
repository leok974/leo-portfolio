const fs = require('fs');
const path = require('path');

// Read the projects data
const projectsData = JSON.parse(fs.readFileSync('projects.json', 'utf8'));

// Read the main index.html to extract the base template structure
const indexHTML = fs.readFileSync('index.html', 'utf8');

// Determine ordering of projects (stable by key order in JSON)
const orderedSlugs = Object.keys(projectsData);

// Build JSON-LD structured data for a project
function buildJsonLd(project, slug) {
  const url = `https://leok974.github.io/leo-portfolio/projects/${slug}.html`;
  const image = project.images && project.images.length ? `https://leok974.github.io/leo-portfolio/${project.images[0].src}` : undefined;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    'name': project.title,
    'description': project.description,
    'url': url,
    'codeRepository': project.repo || undefined,
    'programmingLanguage': project.stack && project.stack.length ? project.stack.join(', ') : undefined,
    'image': image,
    'dateModified': new Date().toISOString(),
    'author': {
      '@type': 'Person',
      'name': 'Leo Klemet'
    },
    'keywords': project.tags ? project.tags.join(', ') : undefined
  };
  // Remove undefined fields
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  return JSON.stringify(data, null, 2);
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
  </style>
</head>
<body>
  <a class="sr-only" href="#content">Skip to content</a>

  <header>
    <div class="container nav" role="navigation" aria-label="Primary">
      <div class="brand"><a href="../">Leo Klemet</a></div>
      <nav>
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
  <dialog id="galleryDialog" class="gallery-dialog" aria-label="Image gallery" inert>
    <div class="gallery-frame">
      <button class="gallery-close" id="galleryClose" aria-label="Close gallery">×</button>
      <button class="gallery-prev" id="galleryPrev" aria-label="Previous image">‹</button>
      <img id="galleryImage" alt="" />
      <button class="gallery-next" id="galleryNext" aria-label="Next image">›</button>
      <p id="galleryCaption" class="muted" style="margin-top:.75rem"></p>
    </div>
  </dialog>
  <script src="../main.js"></script>
</body>
</html>`;
}

function generateProjectMedia(project) {
  let html = '';

  // Add images
  if (project.images && project.images.length > 0) {
    project.images.forEach((img, idx) => {
      const base = `<img class=\"gallery-item\" data-gallery-index=\"${idx}\" src=\"../${img.src}\" alt=\"${img.alt}\" loading=\"lazy\" />`;
      if (img.caption) {
        html += `<figure>${base}<figcaption class="muted">${img.caption}</figcaption></figure>`;
      } else {
        html += base;
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

console.log('Project pages generated successfully!');
