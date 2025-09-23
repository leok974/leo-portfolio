const fs = require('fs');
const path = require('path');

// Read the projects data
const projectsData = JSON.parse(fs.readFileSync('projects.json', 'utf8'));

// Read the main index.html to extract the base template structure
const indexHTML = fs.readFileSync('index.html', 'utf8');

// Template for individual project pages
function generateProjectPage(project, slug) {
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
        <a href="../#projects" class="back-link">← Back to Projects</a>
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

  <script src="../main.js"></script>
</body>
</html>`;
}

function generateProjectMedia(project) {
  let html = '';

  // Add images
  if (project.images && project.images.length > 0) {
    project.images.forEach(img => {
      if (img.caption) {
        html += `<figure>
          <img src="../${img.src}" alt="${img.alt}"/>
          <figcaption class="muted">${img.caption}</figcaption>
        </figure>`;
      } else {
        html += `<img src="../${img.src}" alt="${img.alt}" />`;
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
