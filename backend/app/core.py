import enum
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class CardType(str, enum.Enum):
    NORMAL = "normal"
    STUDENT = "student"
    SENIOR = "senior"


class CardMedium(str, enum.Enum):
    PHYSICAL = "physical"
    MOBILE = "mobile"


class TripStatus(str, enum.Enum):
    OPEN = "open"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Direction(str, enum.Enum):
    FORWARD = "forward"
    BACKWARD = "backward"


class TokenType(str, enum.Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    CARD = "card"


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class AuthError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403


#: bcrypt parolanın yalnızca ilk 72 baytını kullanır; kayıt şeması
#: (RegisterRequest) bu sınırı zaten zorluyor, burada güvenlik ağı olarak durur.
_BCRYPT_MAX_BYTES = 72


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode()[:_BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode()[:_BCRYPT_MAX_BYTES], hashed.encode())
    except ValueError:
        # Bozuk/eski biçimli hash — hata fırlatmadan reddet
        return False


def _encode(payload: dict, secret: str, expires_in: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = payload | {
        "iat": now,
        "exp": now + expires_in,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, secret: str, expected_type: TokenType) -> dict:
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise AuthError("Geçersiz veya süresi dolmuş token")

    if payload.get("type") != expected_type.value:
        raise AuthError("Beklenmeyen token tipi")

    return payload


def create_access_token(user_id: uuid.UUID, is_admin: bool) -> str:
    return _encode(
        {"sub": str(user_id), "admin": is_admin, "type": TokenType.ACCESS.value},
        settings.secret_key,
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _encode(
        {"sub": str(user_id), "type": TokenType.REFRESH.value},
        settings.secret_key,
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> dict:
    return _decode(token, settings.secret_key, TokenType.ACCESS)


def decode_refresh_token(token: str) -> dict:
    return _decode(token, settings.secret_key, TokenType.REFRESH)


def create_card_token(card_id: uuid.UUID) -> str:
    return _encode(
        {"sub": str(card_id), "type": TokenType.CARD.value},
        settings.card_token_secret,
        timedelta(seconds=settings.card_token_expire_seconds),
    )


def decode_card_token(token: str) -> dict:
    return _decode(token, settings.card_token_secret, TokenType.CARD)


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
