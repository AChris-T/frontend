import logging

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

logger = logging.getLogger(__name__)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

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
    """Enable PostGIS if possible and create tables, degrading gracefully."""
    import models  # noqa: F401 — register models with Base.metadata

    # CREATE EXTENSION must run outside a transaction on some Postgres builds.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            logger.info("PostGIS extension enabled")
        except Exception as exc:
            logger.warning(
                "Could not enable the PostGIS extension (%s). The 'roads' table "
                "uses PostGIS geometry columns and will be skipped — all other "
                "tables will still be created. To enable spatial features, deploy "
                "the PostGIS template (https://railway.com/template/postgis), "
                "point DATABASE_URL at that database, then restart the app so the "
                "roads table can be created.",
                exc,
            )

    try:
        # Fast path: PostGIS is available (or was just enabled above) and every
        # table, including the spatial 'roads' table, can be created in one go.
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready")
    except Exception as exc:
        if "geometry" not in str(exc).lower():
            raise

        # PostGIS isn't actually usable (extension creation appeared to
        # succeed, or its effects aren't visible yet). Fall back to creating
        # every table except the ones that depend on the geometry type, so the
        # rest of the application keeps working.
        logger.warning(
            "PostGIS is not enabled on this database (%s). Skipping creation "
            "of the 'roads' table — spatial features will be unavailable "
            "until PostGIS is enabled and the app is restarted. All other "
            "tables have been created normally.",
            exc,
        )

        non_spatial_tables = [
            table
            for table in Base.metadata.sorted_tables
            if table.name != models.Road.__tablename__
        ]
        Base.metadata.create_all(bind=engine, tables=non_spatial_tables)
        logger.info("Non-spatial database tables ready (roads table skipped)")


def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connected successfully")
        return True, None
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, str(e)