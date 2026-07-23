import uuid
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import AuthError, decode_access_token
from app.database import get_db
from app.models import Passenger
from app.repositories import PassengerRepository


ACCESS_COOKIE = "akbil_access"

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_passenger(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
    akbil_access: Annotated[str | None, Cookie()] = None,
) -> Passenger:
    token = credentials.credentials if credentials else akbil_access
    if not token:
        raise _unauthorized("Kimlik bilgisi gerekli")

    try:
        payload = decode_access_token(token)
        passenger_id = uuid.UUID(payload["sub"])
    except AuthError as exc:
        raise _unauthorized(exc.message)
    except (KeyError, ValueError):
        raise _unauthorized("Geçersiz token")

    passenger = PassengerRepository(db).get(passenger_id)
    if passenger is None:
        raise _unauthorized("Kullanıcı bulunamadı")
    if payload.get("ver") != passenger.token_version:
        raise _unauthorized("Oturum geçersiz kılınmış")

    return passenger


def get_current_admin(
    passenger: Annotated[Passenger, Depends(get_current_passenger)],
) -> Passenger:
    if not passenger.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yönetici yetkisi gerekli",
        )
    return passenger


CurrentPassenger = Annotated[Passenger, Depends(get_current_passenger)]
CurrentAdmin = Annotated[Passenger, Depends(get_current_admin)]
