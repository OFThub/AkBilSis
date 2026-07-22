import uuid
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core import AppError, AuthError, decode_access_token
from app.database import get_db
from app.models import Device, Passenger
from app.repositories import PassengerRepository
from app.services import DeviceService

#: Web oturumu bu httpOnly çerezde taşınır. Mobil Authorization başlığı
#: kullanır; iki yol da aynı erişim token'ını taşır, doğrulama tektir.
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
    # Önce Authorization başlığı (mobil), yoksa çerez (web)
    token = credentials.credentials if credentials else akbil_access
    if not token:
        raise _unauthorized("Kimlik bilgisi gerekli")

    try:
        payload = decode_access_token(token)
    except AuthError as exc:
        raise _unauthorized(exc.message)

    passenger = PassengerRepository(db).get(uuid.UUID(payload["sub"]))
    if passenger is None:
        raise _unauthorized("Kullanıcı bulunamadı")

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


def get_current_device(
    db: DbSession,
    x_device_key: Annotated[str | None, Header(alias="X-Device-Key")] = None,
) -> Device:
    if not x_device_key:
        raise _unauthorized("Cihaz anahtarı gerekli")

    try:
        return DeviceService(db).authenticate(x_device_key)
    except AppError as exc:
        raise _unauthorized(exc.message)


CurrentPassenger = Annotated[Passenger, Depends(get_current_passenger)]
CurrentAdmin = Annotated[Passenger, Depends(get_current_admin)]
CurrentDevice = Annotated[Device, Depends(get_current_device)]
