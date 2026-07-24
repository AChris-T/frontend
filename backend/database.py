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

def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Database connected successfully")
        return True, None
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, str(e)