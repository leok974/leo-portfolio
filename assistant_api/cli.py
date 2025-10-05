from __future__ import annotations
import argparse, pathlib, os, sqlite3
from .ingest import ingest_direct, smart_extract
from .db import connect, rebuild_fts
from .ingest import smart_extract


def main() -> None:
    ap = argparse.ArgumentParser("assistant_api")
    sub = ap.add_subparsers(dest="cmd", required=True)

    ing = sub.add_parser("ingest", help="Ingest file(s) into chunks")
    ing.add_argument("--project", required=True, help="Project id")
    ing.add_argument("--doc-id", help="Document id (ignored with --batch)")
    ing.add_argument("path", help="Path to a file or folder")
    ing.add_argument("--batch", action="store_true", help="Treat path as a folder and ingest all supported files")

    reb = sub.add_parser("rebuild-index", help="Rebuild chunks_fts from chunks")

    vac = sub.add_parser("vacuum-analyze", help="Run VACUUM and ANALYZE; print table/index counts")

    args = ap.parse_args()
    if args.cmd == "ingest":
        path = pathlib.Path(args.path)
        if args.batch and path.is_dir():
            inserted = 0
            skipped = 0
            unreadable = 0
            for p in path.rglob("*"):
                if p.is_dir():
                    continue
                try:
                    text = smart_extract(str(p))
                except Exception:
                    unreadable += 1
                    continue
                if not text.strip():
                    skipped += 1
                    continue
                doc_id = p.stem
                try:
                    res = ingest_direct(project_id=args.project, doc_id=doc_id, text=text, meta={"path": str(p)})
                    inserted += int(res.get("inserted", 0))
                except Exception:
                    unreadable += 1
            print(f"ingest: batch ok inserted={inserted} skipped={skipped} unreadable={unreadable}")
        else:
            text = smart_extract(str(path))
            if not args.doc_id:
                raise SystemExit("--doc-id is required when not using --batch")
            ingest_direct(project_id=args.project, doc_id=args.doc_id, text=text, meta={"path": str(path)})
            print("ingest: ok")
    elif args.cmd == "rebuild-index":
        con = connect()
        rebuild_fts(con)
        con.close()
        print("rebuild-index: ok")
    elif args.cmd == "vacuum-analyze":
        con = connect()
        try:
            con.execute("VACUUM")
            con.execute("ANALYZE")
            tbls = con.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','index') ORDER BY type, name").fetchall()
            print("objects:", len(tbls))
        finally:
            con.close()


if __name__ == "__main__":
    main()
