from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE fault_reports ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(150)"
    ))
    conn.commit()
    print("Migration complete: fault_reports.reporter_email added")
