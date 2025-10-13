"""SEO JSON-LD Router - Generate, validate, and report on JSON-LD structured data."""
from __future__ import annotations

from datetime import UTC, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl, ValidationError
from starlette.responses import JSONResponse

# --- Settings hook (add fields below to your settings.py) ---
try:
    from assistant_api.settings import settings
except Exception:
    # Fallback minimal settings if tests import module in isolation
    class _S:
        SEO_LD_ENABLED: int = 1
        SEO_LD_VALIDATE_STRICT: int = 1
        SEO_LD_TYPES: str = (
            "WebSite,WebPage,BreadcrumbList,Person,Organization,CreativeWork,Article,VideoObject,ImageObject"
        )
        ARTIFACTS_ROOT: str = "agent/artifacts"
        ALLOW_DEV_ROUTES: int = 1
        BRAND_NAME: str = "Leo Klemet — SiteAgent"
        BRAND_URL: str = "https://assistant.ledger-mind.org"
        BRAND_LOGO: str = "https://assistant.ledger-mind.org/assets/logo.png"
        PERSON_NAME: str = "Leo Klemet"
        PERSON_SAME_AS: str = "https://www.linkedin.com/in/leo-klemet/"
    settings = _S()

ARTIFACTS_DIR = Path(settings.ARTIFACTS_ROOT).joinpath("seo-ld")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/agent/seo/ld", tags=["seo-ld"])

# ---------- Pydantic models (minimal, extend as needed) ----------
class LDImageObject(BaseModel):
    model_config = {"populate_by_name": True}
    type: str = Field("ImageObject", alias="@type")
    url: HttpUrl
    width: int | None = None
    height: int | None = None

class LDVideoObject(BaseModel):
    model_config = {"populate_by_name": True}
    type: str = Field("VideoObject", alias="@type")
    name: str
    description: str | None = None
    thumbnailUrl: list[HttpUrl]
    uploadDate: str | None = None
    contentUrl: HttpUrl | None = None
    embedUrl: HttpUrl | None = None

class LDBreadcrumbItem(BaseModel):
    model_config = {"populate_by_name": True}
    type: str = Field("ListItem", alias="@type")
    position: int
    name: str
    item: HttpUrl | None = None

class LDBreadcrumbList(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("BreadcrumbList", alias="@type")
    itemListElement: list[LDBreadcrumbItem]

class LDOrganization(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("Organization", alias="@type")
    name: str
    url: HttpUrl | None = None
    logo: HttpUrl | None = None
    sameAs: list[HttpUrl] | None = None

class LDPerson(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("Person", alias="@type")
    name: str
    url: HttpUrl | None = None
    image: HttpUrl | None = None
    sameAs: list[HttpUrl] | None = None
    affiliation: LDOrganization | None = None

class LDWebSite(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("WebSite", alias="@type")
    url: HttpUrl
    name: str
    inLanguage: str = "en"
    publisher: LDPerson | LDOrganization | None = None

class LDWebPage(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("WebPage", alias="@type")
    url: HttpUrl
    name: str
    description: str | None = None
    breadcrumb: LDBreadcrumbList | dict[str, Any] | None = None
    primaryImageOfPage: LDImageObject | None = None
    isPartOf: LDWebSite | None = None

class LDCreativeWork(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("CreativeWork", alias="@type")
    name: str
    url: HttpUrl | None = None
    description: str | None = None
    image: HttpUrl | list[HttpUrl] | list[LDImageObject] | None = None
    author: LDPerson | LDOrganization | None = None
    datePublished: str | None = None

class LDArticle(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("Article", alias="@type")
    headline: str
    url: HttpUrl | None = None
    description: str | None = None
    image: HttpUrl | list[HttpUrl] | list[LDImageObject] | None = None
    author: LDPerson | LDOrganization | None = None
    datePublished: str | None = None
    dateModified: str | None = None

class LDFaqItem(BaseModel):
    model_config = {"populate_by_name": True}
    type: str = Field("Question", alias="@type")
    name: str
    acceptedAnswer: dict[str, Any]  # {"@type":"Answer","text":"..."}

class LDFaqPage(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("FAQPage", alias="@type")
    mainEntity: list[LDFaqItem]

class LDHowToStep(BaseModel):
    model_config = {"populate_by_name": True}
    type: str = Field("HowToStep", alias="@type")
    name: str
    text: str | None = None

class LDHowTo(BaseModel):
    model_config = {"populate_by_name": True}
    context: str = Field("https://schema.org", alias="@context")
    type: str = Field("HowTo", alias="@type")
    name: str
    step: list[LDHowToStep]

# Union registry for schema checks
LD_TYPE_REGISTRY = {
    "ImageObject": LDImageObject,
    "VideoObject": LDVideoObject,
    "BreadcrumbList": LDBreadcrumbList,
    "Organization": LDOrganization,
    "Person": LDPerson,
    "WebSite": LDWebSite,
    "WebPage": LDWebPage,
    "CreativeWork": LDCreativeWork,
    "Article": LDArticle,
    "FAQPage": LDFaqPage,
    "HowTo": LDHowTo,
}
ALLOWED_TYPES = {t.strip() for t in settings.SEO_LD_TYPES.split(",") if t.strip()}

# ---------- IO helpers ----------
def _slug_from_url(url: str) -> str:
    """Generate safe filesystem slug from URL."""
    return (
        url.replace("://", "_")
        .replace("/", "_")
        .replace("?", "_")
        .replace("#", "_")
        .strip("_")
    )

def _write_artifacts(slug: str, jsonld: list[dict[str, Any]], report: dict[str, Any]) -> dict[str, str]:
    """Write JSON-LD and validation report to artifacts directory."""
    ts = datetime.now(UTC).strftime("%Y-%m-%dT%H%M%SZ")
    folder = ARTIFACTS_DIR.joinpath(slug)
    folder.mkdir(parents=True, exist_ok=True)
    json_path = folder.joinpath(f"{ts}.jsonld")
    report_path = folder.joinpath(f"{ts}.report.json")
    import json
    json_path.write_text(json.dumps(jsonld, ensure_ascii=False, separators=(",", ":")))
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    # Keep a shorthand "latest" pointer
    folder.joinpath("latest.jsonld").write_text(json_path.read_text())
    folder.joinpath("latest.report.json").write_text(report_path.read_text())
    return {"json": str(json_path), "report": str(report_path)}

def _load_latest(slug: str) -> dict[str, Any]:
    """Load latest JSON-LD and report for a URL slug."""
    import json
    folder = ARTIFACTS_DIR.joinpath(slug)
    latest = folder.joinpath("latest.jsonld")
    latest_report = folder.joinpath("latest.report.json")
    if not latest.exists() or not latest_report.exists():
        raise FileNotFoundError("No artifacts for slug")
    return {
        "jsonld": json.loads(latest.read_text() or "[]"),
        "report": json.loads(latest_report.read_text() or "{}"),
    }

# ---------- Validation core ----------
def _validate_jsonld(jsonld_any: dict[str, Any] | list[dict[str, Any]]) -> dict[str, Any]:
    """
    Validate JSON-LD structure and schema compliance.
    Returns validation result with 'errors' and 'warnings' lists.
    """
    jsonld_list: list[dict[str, Any]]
    if isinstance(jsonld_any, dict):
        jsonld_list = [jsonld_any]
    else:
        jsonld_list = list(jsonld_any)

    errors: list[str] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()

    for i, obj in enumerate(jsonld_list):
        ctx = obj.get("@context")
        typ = obj.get("@type")
        if ctx != "https://schema.org":
            errors.append(f"[{i}] @context must be https://schema.org")
        if not typ or not isinstance(typ, str):
            errors.append(f"[{i}] @type missing or not a string")
            continue
        if ALLOWED_TYPES and typ not in ALLOWED_TYPES:
            warnings.append(f"[{i}] @type '{typ}' not in allowlist; allowed: {sorted(ALLOWED_TYPES)}")

        # duplicate @id guard
        _id = obj.get("@id")
        if _id:
            if _id in seen_ids:
                errors.append(f"[{i}] duplicate @id '{_id}'")
            seen_ids.add(_id)

        # model-based structural check (minimal set; extend registry as needed)
        model = LD_TYPE_REGISTRY.get(typ)
        if model:
            try:
                model.model_validate(obj)
            except ValidationError as ve:
                errors.append(f"[{i}] {typ} validation failed: {ve.errors()}")

        # generic field heuristics
        for date_field in ("datePublished", "dateModified", "uploadDate"):
            if date_field in obj:
                try:
                    # ISO-ish format check; more precise parsing optional
                    datetime.fromisoformat(str(obj[date_field]).replace("Z", "+00:00"))
                except Exception:
                    warnings.append(f"[{i}] {date_field} not ISO-8601 (value={obj[date_field]!r})")

    return {"count": len(jsonld_list), "errors": errors, "warnings": warnings}

# ---------- Metadata collection stub ----------
def _collect_metadata(url: str) -> dict[str, Any]:
    """
    Replace with real page metadata lookup (RAG, scraper, or repo JSON).
    For now, provides a safe baseline derived from settings & URL.
    """
    from urllib.parse import urlparse
    u = urlparse(url)
    origin = f"{u.scheme}://{u.netloc}"
    is_project = "/projects/" in u.path
    slug = u.path.strip("/").split("/")[-1] or "home"
    title = settings.BRAND_NAME if slug == "home" else f"{slug} — {settings.BRAND_NAME}"
    description = "Self-updating portfolio powered by SiteAgent."
    og_image = settings.BRAND_LOGO
    breadcrumbs = [
        {"@type":"ListItem","position":1,"name":"Home","item": origin},
    ]
    if is_project:
        breadcrumbs.append({"@type":"ListItem","position":2,"name":"Projects","item": f"{origin}/projects"})
        breadcrumbs.append({"@type":"ListItem","position":3,"name": slug.title(), "item": url})
    return {
        "origin": origin,
        "url": url,
        "title": title,
        "description": description,
        "image": og_image,
        "breadcrumbs": breadcrumbs if len(breadcrumbs) > 1 else None,
        "is_project": is_project,
        "published_iso": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

# ---------- Request models ----------
class GenerateReq(BaseModel):
    url: HttpUrl
    types: list[str] | None = None
    dry_run: bool = True

class ValidateReq(BaseModel):
    jsonld: dict[str, Any] | list[dict[str, Any]]

# ---------- Router endpoints ----------
@router.post("/generate")
def generate_ld(req: GenerateReq):
    """
    Generate JSON-LD structured data for a URL.

    NOTE: This uses a metadata collection stub. Replace with actual metadata
    extraction from your content (RAG, scraper, or repo JSON).
    """
    if not settings.SEO_LD_ENABLED:
        raise HTTPException(status_code=400, detail="SEO_LD_ENABLED=0")

    meta = _collect_metadata(str(req.url))
    want_types = set(req.types or ["WebPage", "WebSite"]) & (ALLOWED_TYPES or set())

    objs: list[dict[str, Any]] = []

    if "Organization" in want_types:
        objs.append({
            "@context":"https://schema.org","@type":"Organization",
            "name": settings.BRAND_NAME, "url": meta["origin"], "logo": settings.BRAND_LOGO
        })

    if "Person" in want_types:
        person_obj: dict[str, Any] = {
            "@context":"https://schema.org","@type":"Person",
            "name": settings.PERSON_NAME, "url": meta["origin"],
        }
        if settings.PERSON_SAME_AS:
            person_obj["sameAs"] = [settings.PERSON_SAME_AS]
        objs.append(person_obj)

    if "WebSite" in want_types:
        objs.append({
            "@context":"https://schema.org","@type":"WebSite",
            "url": meta["origin"], "name": settings.BRAND_NAME, "inLanguage":"en",
            "publisher": {"@context":"https://schema.org","@type":"Person","name": settings.PERSON_NAME}
        })

    if "BreadcrumbList" in want_types and meta.get("breadcrumbs"):
        objs.append({
            "@context":"https://schema.org","@type":"BreadcrumbList",
            "itemListElement": meta["breadcrumbs"]
        })

    if "WebPage" in want_types:
        page: dict[str, Any] = {
            "@context":"https://schema.org","@type":"WebPage",
            "url": meta["url"], "name": meta["title"], "description": meta["description"],
            "isPartOf": {"@context":"https://schema.org","@type":"WebSite","url": meta["origin"], "name": settings.BRAND_NAME},
        }
        if meta.get("image"):
            page["primaryImageOfPage"] = {"@type":"ImageObject","url": meta["image"]}
        if meta.get("breadcrumbs"):
            page["breadcrumb"] = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement": meta["breadcrumbs"]}
        objs.append(page)

    # Optional page-specific content shapes
    if "CreativeWork" in want_types and meta["is_project"]:
        objs.append({
            "@context":"https://schema.org","@type":"CreativeWork",
            "name": meta["title"], "url": meta["url"], "description": meta["description"],
            "image": [meta["image"]], "author": {"@context":"https://schema.org","@type":"Person","name": settings.PERSON_NAME},
            "datePublished": meta["published_iso"]
        })

    if "Article" in want_types and not meta["is_project"]:
        objs.append({
            "@context":"https://schema.org","@type":"Article",
            "headline": meta["title"], "url": meta["url"], "description": meta["description"],
            "image": [meta["image"]], "author": {"@context":"https://schema.org","@type":"Person","name": settings.PERSON_NAME},
            "datePublished": meta["published_iso"], "dateModified": meta["published_iso"]
        })

    if "FAQPage" in want_types:
        # Generate example FAQ content
        objs.append({
            "@context":"https://schema.org","@type":"FAQPage",
            "mainEntity":[
                {
                    "@type":"Question",
                    "name":"What is SiteAgent?",
                    "acceptedAnswer":{"@type":"Answer","text":"SiteAgent is a self-updating portfolio platform that automates SEO, content management, and deployment workflows."}
                },
                {
                    "@type":"Question",
                    "name":"Do I need to write code?",
                    "acceptedAnswer":{"@type":"Answer","text":"Basic knowledge helps, but SiteAgent automates most technical tasks through FastAPI endpoints and GitHub Actions."}
                },
                {
                    "@type":"Question",
                    "name":"How does SEO monitoring work?",
                    "acceptedAnswer":{"@type":"Answer","text":"SiteAgent fetches daily Google Search Console data, detects CTR anomalies, and files GitHub Issues automatically."}
                }
            ]
        })

    if "HowTo" in want_types and meta["is_project"]:
        # Generate step-by-step guide for project pages
        project_name = meta["title"].split("—")[0].strip() if "—" in meta["title"] else meta["title"]
        objs.append({
            "@context":"https://schema.org","@type":"HowTo",
            "name": f"How to build {project_name}",
            "step":[
                {"@type":"HowToStep","name":"Clone the repository","text": f"Get started by cloning the {project_name} repo from GitHub."},
                {"@type":"HowToStep","name":"Install dependencies","text":"Run npm install or pip install to set up all required packages."},
                {"@type":"HowToStep","name":"Configure environment","text":"Set up your .env file with API keys and configuration values."},
                {"@type":"HowToStep","name":"Run development server","text":"Start the local dev server to test your changes in real-time."},
                {"@type":"HowToStep","name":"Deploy to production","text":"Use GitHub Actions or manual deployment scripts to publish your changes."}
            ]
        })

    report = _validate_jsonld(objs)
    artifacts_paths = {}
    if not req.dry_run:
        slug = _slug_from_url(str(req.url))
        artifacts_paths = _write_artifacts(slug, objs, {"url": str(req.url), **report})

    return JSONResponse({"jsonld": objs, "report": report, "artifacts": artifacts_paths})

@router.post("/validate")
def validate_ld(req: ValidateReq):
    """
    Validate JSON-LD structure and schema compliance.
    Returns errors and warnings. Raises 422 if SEO_LD_VALIDATE_STRICT=1 and errors exist.
    """
    result = _validate_jsonld(req.jsonld)
    strict = bool(getattr(settings, "SEO_LD_VALIDATE_STRICT", 0))
    if strict and result["errors"]:
        raise HTTPException(status_code=422, detail=result)
    return JSONResponse(result)

@router.get("/report")
def ld_report(url: str = Query(..., description="Exact URL used when generating artifacts")):
    """Get the latest JSON-LD and validation report for a URL."""
    slug = _slug_from_url(url)
    try:
        latest = _load_latest(slug)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No report found for URL")
    return JSONResponse({"url": url, **latest})

# ---------- Optional test-only shortcut ----------
if getattr(settings, "ALLOW_DEV_ROUTES", 0):
    @router.post("/mock")
    def mock_commit(url: str = Body(..., embed=True)):
        """Fast artifact generator for E2E/CI (no external fetch)."""
        payload = GenerateReq(url=url, types=[
            "WebSite","WebPage","BreadcrumbList","Person","Organization","CreativeWork","Article"
        ], dry_run=False)
        return generate_ld(payload)
