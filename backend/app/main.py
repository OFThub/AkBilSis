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

#: Web sitesi backend ile aynı origin'den servis edilir — CORS gerekmez ve
#: /admin sayfası sunucuda korunabilir.
WEB_ROOT = Path(__file__).resolve().parent.parent.parent / "public"

#: Son durakta otomatik iniş taraması sıklığı (saniye)
AUTO_CLOSE_INTERVAL = 5


async def _auto_close_loop() -> None:
    """Son durağa varan yolculukları kapatan arkaplan görevi.

    Yolcu inmeyi unutursa kayıt sonsuza dek açık kalmasın diye gerekir. Okuma
    uçları (TripService.history/active) aynı temizliği ayrıca tetikler; bu
    döngü kimse bakmasa da devrede olması içindir.
    """
    while True:
        await asyncio.sleep(AUTO_CLOSE_INTERVAL)
        try:
            db = SessionLocal()
            try:
                await asyncio.to_thread(TripService(db).close_due)
            finally:
                db.close()
        except Exception:
            # Veritabanı geçici olarak erişilemezse döngü ölmemeli
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
    # Çerezli istek yalnızca aynı origin'deki web sitesinden gelir; mobil
    # Authorization başlığı kullanır. allow_origins="*" ile credentials=True
    # birlikte kullanılamaz — tarayıcı bu kombinasyonu reddeder.
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
    """Yönetim sayfası — HTML yalnızca yöneticiye döner.

    Adres çubuğuna elle yazılsa da çerez doğrulanır: yönetici değilse sayfa hiç
    üretilmez, giriş ekranına yönlendirilir. Veriler ayrıca /admin/* uçlarında
    `get_current_admin` ile korunur, yani iki katmanlı kontrol vardır.
    """
    fallback = RedirectResponse(url="/", status_code=303)
    if not akbil_access:
        return fallback

    try:
        payload = decode_access_token(akbil_access)
    except AuthError:
        return fallback

    passenger = PassengerRepository(db).get(uuid.UUID(payload["sub"]))
    if passenger is None or not passenger.is_admin:
        return fallback

    return FileResponse(WEB_ROOT / "admin.html")


for router in routers:
    app.include_router(router, prefix=settings.api_prefix)

# Statik dosyalar en sona monte edilir: "/" tüm yolları yakaladığı için önce
# eklenirse /api/v1/* ve /admin gölgelenirdi.
app.mount("/", StaticFiles(directory=WEB_ROOT, html=True), name="web")
