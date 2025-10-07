/**
 * Gallery JSON-LD Schema Injector
 *
 * Injects structured data (CollectionPage + BreadcrumbList) from gallery.json
 * for enhanced SEO and rich results in search engines.
 *
 * No inline scripts - CSP-friendly.
 */
(function () {
  const ORIGIN = location.origin;
  const PAGE_URL = ORIGIN + "/gallery.html";
  const PERSON = { "@type": "Person", "name": "Leo Klemet" };

  const abs = (u) => /^https?:\/\//i.test(u) ? u : (u?.startsWith("/") ? ORIGIN + u : (ORIGIN + "/" + (u || "")));

  function toImageObject(it) {
    const url = abs(it.src);
    return {
      "@type": "ImageObject",
      "@id": it.id ? `${PAGE_URL}#${encodeURIComponent(it.id)}` : undefined,
      "name": it.title || "Image",
      "caption": it.description || undefined,
      "contentUrl": url,
      "thumbnailUrl": url,
      "datePublished": it.date || undefined,
      "creator": PERSON,
      "keywords": [...new Set([...(it.tools||[]), ...(it.tags||[])])].join(", ") || undefined
    };
  }

  function toVideoObjectLocal(it) {
    return {
      "@type": "VideoObject",
      "@id": it.id ? `${PAGE_URL}#${encodeURIComponent(it.id)}` : undefined,
      "name": it.title || "Video",
      "description": it.description || "Video",
      "thumbnailUrl": abs(it.poster || ""),
      "contentUrl": abs(it.src || ""),
      "uploadDate": it.publication_date || it.date || undefined,
      "duration": Number.isInteger(it.duration) ? `PT${it.duration}S` : undefined,
      "encodingFormat": it.mime || undefined,
      "isFamilyFriendly": typeof it.family_friendly === "boolean" ? (it.family_friendly ? "true" : "false") : undefined,
      "keywords": [...new Set([...(it.tools||[]), ...(it.tags||[])])].join(", ") || undefined
    };
  }

  function toVideoObjectEmbed(it) {
    return {
      "@type": "VideoObject",
      "@id": it.id ? `${PAGE_URL}#${encodeURIComponent(it.id)}` : undefined,
      "name": it.title || "Video",
      "description": it.description || "Video",
      "thumbnailUrl": abs(it.poster || ""),
      "embedUrl": it.src,               // youtube/vimeo iframe URL
      "uploadDate": it.publication_date || it.date || undefined,
      "isFamilyFriendly": typeof it.family_friendly === "boolean" ? (it.family_friendly ? "true" : "false") : undefined,
      "keywords": [...new Set([...(it.tools||[]), ...(it.tags||[])])].join(", ") || undefined
    };
  }

  function toPart(it) {
    if (it.type === "image" && it.src) return toImageObject(it);
    if (it.type === "video-local" && it.src && it.poster) return toVideoObjectLocal(it);
    if ((it.type === "youtube" || it.type === "vimeo") && it.src && it.poster) return toVideoObjectEmbed(it);
    return null; // skipped if missing required fields
  }

  function inject(json) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.text = JSON.stringify(json);
    document.head.appendChild(s);
  }

  async function run() {
    try {
      const res = await fetch("/gallery.json", { cache: "no-store" });
      if (!res.ok) throw new Error("gallery.json missing");
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const parts = items.map(toPart).filter(Boolean);

      // Breadcrumbs
      inject({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": ORIGIN + "/" },
          { "@type": "ListItem", "position": 2, "name": "Gallery", "item": PAGE_URL }
        ]
      });

      // CollectionPage with parts
      inject({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": PAGE_URL + "#page",
        "url": PAGE_URL,
        "name": "Gallery · Creative Workflows",
        "inLanguage": "en",
        "isPartOf": { "@type": "WebSite", "url": ORIGIN + "/" },
        "hasPart": parts
      });
    } catch (e) {
      // Non-fatal: schema is progressive
      // console.warn('[schema]', e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
