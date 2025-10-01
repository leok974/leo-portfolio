from pathlib import Path

path = Path("generate-projects.js")
text = path.read_text(encoding="utf-8")
old_base = "  const baseSoftware = /** @type {Record<string, any>} */ ({\n    '@type': 'SoftwareSourceCode',\n      name: project.title,\n      description: project.description,\n      url,\n      codeRepository: project.repo || undefined,\n      programmingLanguage: project.stack && project.stack.length ? project.stack.join(', ') : undefined,\n      image,\n      dateModified: (lastmodStore[slug] && lastmodStore[slug].lastmod) ? lastmodStore[slug].lastmod : new Date().toISOString().split('T')[0],\n    datePublished: (lastmodStore[slug] && lastmodStore[slug].datePublished) ? lastmodStore[slug].datePublished : undefined,\n      author: { '@type': 'Person', name: 'Leo Klemet' },\n      keywords: project.tags ? project.tags.join(', ') : undefined\n  });"
new_base = "  const baseSoftware = /** @type {Record<string, any>} */ ({\n    '@type': 'SoftwareSourceCode',\n    name: project.title,\n    description: project.description,\n    url,\n    codeRepository: project.repo || undefined,\n    programmingLanguage: project.stack && project.stack.length ? project.stack.join(', ') : undefined,\n    image,\n    dateModified: (lastmodStore[slug] && lastmodStore[slug].lastmod) ? lastmodStore[slug].lastmod : new Date().toISOString().split('T')[0],\n    datePublished: (lastmodStore[slug] && lastmodStore[slug].datePublished) ? lastmodStore[slug].datePublished : undefined,\n    author: { '@type': 'Person', name: 'Leo Klemet' },\n    keywords: project.tags ? project.tags.join(', ') : undefined\n  });"
if old_base not in text:
    raise SystemExit('baseSoftware block pattern not found')
text = text.replace(old_base, new_base)
old_creative = "  const creative = /** @type {Record<string, any>} */ ({\n    '@type': 'CreativeWork',\n    name: project.title,\n    description: project.description,\n    url,\n    dateModified: baseSoftware.dateModified,\n    datePublished: baseSoftware.datePublished,\n    lastReviewed: baseSoftware.dateModified,\n    creator: { '@type': 'Person', name: 'Leo Klemet' },\n    keywords: project.tags ? project.tags.join(', ') : undefined,\n    about: project.problem || undefined,\n    thumbnailUrl: image || undefined\n  });"
new_creative = "  const creative = /** @type {Record<string, any>} */ ({\n    '@type': 'CreativeWork',\n    name: project.title,\n    description: project.description,\n    url,\n    dateModified: baseSoftware.dateModified,\n    datePublished: baseSoftware.datePublished,\n    lastReviewed: baseSoftware.dateModified,\n    creator: { '@type': 'Person', name: 'Leo Klemet' },\n    keywords: project.tags ? project.tags.join(', ') : undefined,\n    about: project.problem || undefined,\n    thumbnailUrl: image || undefined\n  });"
if old_creative not in text:
    raise SystemExit('creative block pattern not found')
text = text.replace(old_creative, new_creative)
Path("generate-projects.js").write_text(text, encoding="utf-8")
