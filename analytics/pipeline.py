"""
Analytics pipeline orchestrator - ties together all components.

Phase 51.0 — Analytics Loop

Usage:
    python -m analytics.pipeline --window-days 7
    python -m analytics.pipeline --date 2025-10-09 --window-days 14
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime, timezone
import sys

from analytics.collectors.nightly_loader import load_nightly
from analytics.collectors.kpi_extractor import extract_kpis
from analytics.collectors.trend_detector import detect_trends
from analytics.rag.embedder_local import ensure_embedder
from analytics.rag.query_engine import VectorStore
from analytics.summarizers.insight_llm import generate_insight
from analytics.summarizers.report_builder import write_markdown_report

# Directories
DATA_DIR = Path("data/nightly")
OUT_DIR = Path("analytics/outputs")
RAG_DIR = Path("analytics/rag")


def run(date_str: str | None = None, window_days: int = 7):
    """
    Run the complete analytics pipeline.

    Args:
        date_str: Date in YYYY-MM-DD format (defaults to today UTC)
        window_days: Number of days to analyze for trends
    """
    print("🚀 Phase 51.0 — Analytics Pipeline Starting...")

    # Ensure directories exist
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAG_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Parse or use current date
    if date_str:
        date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        date = datetime.now(timezone.utc).date()

    print(f"📅 Processing date: {date.isoformat()}")

    # Step 1: Load nightly data
    print("📦 Loading nightly reports...")
    try:
        merged = load_nightly(date)
        print(f"   ✓ Loaded {len(merged.get('_sources', []))} source files")
    except Exception as e:
        print(f"   ✗ Failed to load nightly data: {e}")
        sys.exit(1)

    # Step 2: Extract KPIs
    print("📊 Extracting KPIs...")
    try:
        kpis = extract_kpis(merged)
        print(f"   ✓ Extracted {len(kpis)} KPIs")
        for k, v in kpis.items():
            print(f"      - {k}: {v}")
    except Exception as e:
        print(f"   ✗ Failed to extract KPIs: {e}")
        sys.exit(1)

    # Step 3: Detect trends
    print(f"📈 Detecting trends (window: {window_days} days)...")
    try:
        trend = detect_trends(DATA_DIR, window_days=window_days)
        print(f"   ✓ Analyzed {len(trend.series)} data points")
        if trend.anomalies:
            print(f"   ⚠️  Found {len(trend.anomalies)} anomalies:")
            for a in trend.anomalies:
                print(f"      - {a['field']}: z={a['z']} on {a['date']}")
        else:
            print("   ✓ No anomalies detected")
    except Exception as e:
        print(f"   ✗ Failed to detect trends: {e}")
        sys.exit(1)

    # Step 4: Initialize RAG
    print("🧠 Initializing RAG embeddings...")
    try:
        embedder = ensure_embedder(model_name="intfloat/e5-base-v2")
        vs = VectorStore(RAG_DIR / "vector_store.sqlite")
        vs.create()
        vs.index_daily_snippets(DATA_DIR, embedder, lookback_days=window_days)
        print("   ✓ RAG index updated")
    except Exception as e:
        print(f"   ⚠️  RAG initialization warning: {e}")
        # Continue without RAG
        def dummy_retriever(q, k=6):
            return []
        retriever = dummy_retriever
    else:
        retriever = lambda q, k=6: vs.search(embedder, q, k=k)

    # Step 5: Generate insight
    print("💡 Generating AI insight...")
    try:
        insight_md = generate_insight(kpis=kpis, trend=trend, retriever=retriever)
        print("   ✓ Insight generated")
    except Exception as e:
        print(f"   ⚠️  Insight generation warning: {e}")
        insight_md = f"(Insight generation failed: {e})"

    # Step 6: Write reports
    print("📝 Writing reports...")
    try:
        report_path = OUT_DIR / "insight-summary.md"
        write_markdown_report(report_path, kpis=kpis, trend=trend, insight_md=insight_md)
        print(f"   ✓ Wrote {report_path}")

        # Save machine-readable trend snapshot
        trend_json_path = OUT_DIR / "trend-report.json"
        trend_json_path.write_text(trend.model_dump_json(indent=2), encoding="utf-8")
        print(f"   ✓ Wrote {trend_json_path}")
    except Exception as e:
        print(f"   ✗ Failed to write reports: {e}")
        sys.exit(1)

    print("✅ Analytics pipeline completed successfully!")
    print(f"\n📄 Reports:")
    print(f"   - {OUT_DIR / 'insight-summary.md'}")
    print(f"   - {OUT_DIR / 'trend-report.json'}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Phase 51.0 Analytics Pipeline — Nightly Insights & RAG"
    )
    parser.add_argument(
        "--date",
        help="Date to process in YYYY-MM-DD format (defaults to today UTC)",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=7,
        help="Number of days to analyze for trends (default: 7)",
    )

    args = parser.parse_args()

    try:
        run(args.date, args.window_days)
    except KeyboardInterrupt:
        print("\n⚠️  Pipeline interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
