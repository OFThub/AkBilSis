import asyncio
import contextlib
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.core import AppError, AuthError, decode_access_token
from app.database import SessionLocal, get_db
from app.repositories import PassengerRepository
from app.routes import routers
from app.services import TripService

WEB_ROOT = Path(__file__).resolve().parent.parent.parent / "public"
# Yonetim sayfasi statik kokun DISINDA durur: public/ altinda olsaydi
# /admin.html adresi StaticFiles tarafindan dogrudan servis edilir ve
# asagidaki yetki kontrolu tamamen atlanirdi.
ADMIN_PAGE = Path(__file__).resolve().parent.parent.parent / "private" / "admin.html"


AUTO_CLOSE_INTERVAL = 5


async def _auto_close_loop() -> None:

    while True:
        await asyncio.sleep(AUTO_CLOSE_INTERVAL)
        try:
            db = SessionLocal()
            try:
                await asyncio.to_thread(TripService(db).close_due)
            finally:
                db.close()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_auto_close_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "up"
    except Exception:
        database = "down"

    return {"status": "ok", "app": settings.app_name, "database": database}


@app.get("/admin", tags=["system"], include_in_schema=False)
def admin_page(
    db: Session = Depends(get_db),
    akbil_access: str | None = Cookie(default=None),
):
    fallback = RedirectResponse(url="/", status_code=303)
    if not akbil_access:
        return fallback

    try:
        payload = decode_access_token(akbil_access)
    except AuthError:
        return fallback

    try:
        passenger_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return fallback

    passenger = PassengerRepository(db).get(passenger_id)
    if passenger is None or not passenger.is_admin:
        return fallback
    if payload.get("ver") != passenger.token_version:
        return fallback

    return FileResponse(ADMIN_PAGE)


for router in routers:
    app.include_router(router, prefix=settings.api_prefix)

app.mount("/", StaticFiles(directory=WEB_ROOT, html=True), name="web")
