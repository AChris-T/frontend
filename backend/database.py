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
    """Enable PostGIS and create tables if they don't exist.

    PostGIS is not available on Railway's default PostgreSQL instance. Rather
    than blocking the app from starting, we attempt to enable it and, if that
    fails, log a warning and fall back to creating only the non-spatial
    tables (everything except the Road table, which requires the `geometry`
    column type). Users can enable PostGIS later and restart to get the full
    schema, including spatial features.
    """
    import models  # noqa: F401 — register models with Base.metadata

    # CREATE EXTENSION must run outside a transaction on some Postgres builds.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            logger.info("PostGIS extension enabled")
        except Exception as exc:
            logger.warning(
                "Could not enable PostGIS extension (%s). Railway's default "
                "PostgreSQL does not include PostGIS — deploy the PostGIS "
                "template (https://railway.com/template/postgis) and point "
                "DATABASE_URL at that database to enable spatial features. "
                "Continuing startup without PostGIS.",
                exc,
            )

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready")
    except Exception as exc:
        if "geometry" not in str(exc).lower():
            raise

        logger.error(
            "Failed to create tables because the `geometry` column type is "
            "unavailable (PostGIS is not enabled): %s. Falling back to "
            "creating non-spatial tables only, excluding the Road table.",
            exc,
        )

        for table in Base.metadata.sorted_tables:
            if table.name == models.Road.__tablename__:
                logger.warning(
                    "Skipping table '%s' — requires PostGIS.", table.name
                )
                continue
            try:
                table.create(bind=engine, checkfirst=True)
            except Exception as table_exc:
                logger.warning(
                    "Skipping table '%s' — could not be created: %s",
                    table.name,
                    table_exc,
                )

        logger.info("Database tables ready (non-spatial subset)")


def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connected successfully")
        return True, None
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, str(e)