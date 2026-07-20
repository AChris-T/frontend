import os
from dotenv import load_dotenv
from database import SessionLocal
from auth import hash_password
import models

load_dotenv()

full_name = os.getenv("ADMIN_FULL_NAME")
email = os.getenv("ADMIN_EMAIL")
password = os.getenv("ADMIN_PASSWORD")

if not email or not password:
    raise SystemExit("ADMIN_EMAIL / ADMIN_PASSWORD not set in .env")

db = SessionLocal()
try:
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        user.password_hash = hash_password(password)
        user.role = "admin"
        db.commit()
        print(f"Updated existing user to admin: {email}")
    else:
        user = models.User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role="admin",
            is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"Created admin user: {email}")
finally:
    db.close()
