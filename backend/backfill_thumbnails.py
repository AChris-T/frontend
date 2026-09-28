"""One-off: create thumbnails for existing report photos that don't have one.

Usage: python backfill_thumbnails.py
"""
from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal, init_db  # noqa: E402
import models  # noqa: E402
import storage  # noqa: E402
from rescan_service import _local_copy, _suffix  # noqa: E402


def main():
    init_db()
    db = SessionLocal()
    try:
        reports = db.query(models.FaultReport).filter(
            models.FaultReport.photo_url.isnot(None), models.FaultReport.thumb_url.is_(None)
        ).order_by(models.FaultReport.id).all()
        print(f"{len(reports)} report(s) need a thumbnail")
        for report in reports:
            path, is_temp = None, False
            try:
                path, is_temp = _local_copy(report.photo_url, _suffix(report.photo_url, ".jpg"))
                if not path:
                    print(f"  #{report.id}: photo not found, skipped")
                    continue
                report.thumb_url = storage.make_thumbnail(path, report.photo_url)
                db.commit()
                print(f"  #{report.id}: {report.thumb_url}")
            except Exception as e:
                db.rollback()
                print(f"  #{report.id}: failed - {e}")
            finally:
                if is_temp and path:
                    import os
                    os.remove(path)
    finally:
        db.close()


if __name__ == "__main__":
    main()
