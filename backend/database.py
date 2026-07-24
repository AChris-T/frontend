import logging
import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

REQUIRED_TABLES = {
    "users",
    "roads",
    "fault_reports",
    "status_history",
    "notifications",
}

# Defensive fix: some misconfigurations (e.g. a variable set in Railway as
# "DATABASE_URL=postgresql://..." instead of just the value, or a malformed
# .env file) result in the key name being included in the value itself.
# Strip it out so SQLAlchemy can still parse the URL, and warn loudly so the
# underlying misconfiguration gets fixed.
if DATABASE_URL and DATABASE_URL.startswith("DATABASE_URL="):
    logger.warning(
        "DATABASE_URL environment variable is malformed: it contains its own "
        "key name (e.g. 'DATABASE_URL=postgresql://...'). Stripping the "
        "'DATABASE_URL=' prefix to recover the connection string. Please fix "
        "this in Railway's variable settings."
    )
    DATABASE_URL = DATABASE_URL.split("=", 1)[1]

print("DATABASE_URL:", repr(DATABASE_URL))
print("TYPE:", type(DATABASE_URL))

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Enable PostGIS, create tables, and seed road data if needed."""
    import models  # noqa: F401 — register models with Base.metadata

    # CREATE EXTENSION must run outside a transaction on some Postgres builds.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            print("✅ PostGIS extension enabled")
            logger.info("PostGIS extension enabled")
        except Exception as exc:
            raise RuntimeError(
                "PostGIS is required but could not be enabled. Railway's default "
                "PostgreSQL does not include PostGIS — deploy the PostGIS template "
                "instead (https://railway.com/template/postgis) and point "
                "DATABASE_URL at that database."
            ) from exc

    for table in Base.metadata.sorted_tables:
        table.create(bind=engine, checkfirst=True)

    existing_tables = set(inspect(engine).get_table_names())
    missing_tables = REQUIRED_TABLES - existing_tables
    if missing_tables:
        raise RuntimeError(
            f"Database init failed — missing tables: {sorted(missing_tables)}"
        )

    from seed_roads import seed_roads_if_empty

    seed_roads_if_empty()
    print("✅ Database tables ready")
    logger.info("Database tables ready")


def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connected successfully")
        return True, None
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, str(e)
