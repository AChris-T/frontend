import os
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["Authentication"])

COOKIE_MAX_AGE = auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
COOKIE_SECURE = os.getenv("ENV", "development") != "development"


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


@router.post("/register", response_model=schemas.Token)
def register(user_data: schemas.UserRegister, response: Response, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=auth.hash_password(user_data.password),
        role="user"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = auth.create_access_token({"sub": new_user.email, "role": new_user.role, "full_name": new_user.full_name})
    set_session_cookie(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }


@router.post("/login", response_model=schemas.Token)
def login(user_data: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if not user or not auth.verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = auth.create_access_token({"sub": user.email, "role": user.role, "full_name": user.full_name})
    set_session_cookie(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="token", path="/")
    return {"message": "Logged out"}


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
