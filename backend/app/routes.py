import uuid

from fastapi import APIRouter, Depends, Query, Response, status

from app.config import settings
from app.core import Direction
from app.deps import ACCESS_COOKIE, CurrentPassenger, DbSession, get_current_admin
from app.schemas import (
    AnalyticsOverview,
    BusCreate,
    BusLive,
    BusOccupancy,
    BusOccupancyDetail,
    BusRead,
    CardCreate,
    CardLinkRequest,
    CardRead,
    CardTypeShare,
    CardTypeUpdate,
    FavoriteCreate,
    FavoriteRead,
    LineAnalytics,
    LineDetail,
    LineLiveStatus,
    LineRead,
    LoginRequest,
    PassengerRead,
    PassengerUpdate,
    RecentTrip,
    RefreshRequest,
    RegisterRequest,
    StatsSummary,
    StopAnalytics,
    StopPair,
    StopRead,
    TokenPair,
    TripDetail,
    TripRead,
    ValidateRequest,
    ValidateResponse,
)
from app.services import (
    AuthService,
    CardService,
    FavoriteService,
    PassengerService,
    StatsService,
    TransitService,
    TripService,
    ValidationService,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])
passenger_router = APIRouter(prefix="/passengers", tags=["passengers"])
card_router = APIRouter(prefix="/cards", tags=["cards"])
transit_router = APIRouter(prefix="/transit", tags=["transit"])
favorite_router = APIRouter(prefix="/favorites", tags=["favorites"])
trip_router = APIRouter(prefix="/trips", tags=["trips"])
validation_router = APIRouter(prefix="/validate", tags=["validation"])
admin_router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)]
)


@auth_router.post("/register", response_model=PassengerRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession):
    return AuthService(db).register(
        payload.full_name, payload.email, payload.password, payload.card_type
    )


@auth_router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, db: DbSession, response: Response):
    access, refresh = AuthService(db).login(payload.email, payload.password)
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access,
        httponly=True,
        samesite="lax",
        secure=not settings.debug,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(ACCESS_COOKIE, path="/")


@auth_router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: DbSession):
    access, refresh_token = AuthService(db).refresh(payload.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token)


@passenger_router.get("/me", response_model=PassengerRead)
def read_me(passenger: CurrentPassenger):
    return passenger


@passenger_router.patch("/me", response_model=PassengerRead)
def update_me(payload: PassengerUpdate, passenger: CurrentPassenger, db: DbSession):
    return PassengerService(db).update(passenger, payload.full_name)


@card_router.get("", response_model=list[CardRead])
def my_cards(passenger: CurrentPassenger, db: DbSession):
    return CardService(db).list_for_passenger(passenger.id)


@card_router.post("/link", response_model=CardRead)
def link_card(payload: CardLinkRequest, passenger: CurrentPassenger, db: DbSession):
    return CardService(db).link(passenger, payload.nfc_uid)


@transit_router.get("/lines", response_model=list[LineRead])
def list_lines(db: DbSession, skip: int = 0, limit: int = Query(default=100, le=200)):
    return TransitService(db).list_lines(skip, limit)


@transit_router.get("/lines/{line_id}", response_model=LineDetail)
def get_line(
    line_id: uuid.UUID,
    db: DbSession,
    direction: Direction = Direction.FORWARD,
):
    return TransitService(db).get_line(line_id, direction)


@transit_router.get("/lines/{line_id}/buses", response_model=list[BusLive])
def line_buses(line_id: uuid.UUID, db: DbSession):
    """Hattın canlı araç konumları — konum sunucuda hesaplanır."""
    return TransitService(db).live_buses(line_id)


@transit_router.get("/lines/{line_id}/live", response_model=LineLiveStatus)
def line_live(line_id: uuid.UUID, db: DbSession):
    return TransitService(db).line_live_status(line_id)


@transit_router.get("/stops", response_model=list[StopRead])
def search_stops(db: DbSession, q: str = Query(min_length=2)):
    return TransitService(db).search_stops(q)


@favorite_router.get("", response_model=list[FavoriteRead])
def list_favorites(passenger: CurrentPassenger, db: DbSession):
    return FavoriteService(db).list(passenger.id)


@favorite_router.post("", response_model=FavoriteRead, status_code=status.HTTP_201_CREATED)
def add_favorite(payload: FavoriteCreate, passenger: CurrentPassenger, db: DbSession):
    return FavoriteService(db).add(passenger.id, payload.line_id)


@favorite_router.delete("/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(line_id: uuid.UUID, passenger: CurrentPassenger, db: DbSession):
    FavoriteService(db).remove(passenger.id, line_id)


@trip_router.get("", response_model=list[TripDetail])
def trip_history(
    passenger: CurrentPassenger,
    db: DbSession,
    skip: int = 0,
    limit: int = Query(default=50, le=100),
):
    return TripService(db).history(passenger, skip, limit)


@trip_router.get("/active", response_model=TripDetail | None)
def active_trip(passenger: CurrentPassenger, db: DbSession):
    return TripService(db).active(passenger)


@validation_router.post("", response_model=ValidateResponse)
def validate(payload: ValidateRequest, passenger: CurrentPassenger, db: DbSession):
    return ValidationService(db).validate(passenger, payload.bus_id)


@admin_router.get("/passengers", response_model=list[PassengerRead])
def admin_passengers(
    db: DbSession,
    q: str | None = None,
    skip: int = 0,
    limit: int = Query(default=50, le=200),
):
    return PassengerService(db).search(q, skip, limit)


@admin_router.get("/passengers/{passenger_id}", response_model=PassengerRead)
def admin_passenger_detail(passenger_id: uuid.UUID, db: DbSession):
    return PassengerService(db).get(passenger_id)


@admin_router.post("/cards", response_model=CardRead, status_code=status.HTTP_201_CREATED)
def admin_create_card(payload: CardCreate, db: DbSession):
    return CardService(db).create(
        payload.card_type, payload.medium, payload.nfc_uid, payload.passenger_id
    )


@admin_router.post("/cards/{card_id}/block", response_model=CardRead)
def admin_block_card(card_id: uuid.UUID, db: DbSession):
    return CardService(db).set_active(card_id, False)


@admin_router.post("/cards/{card_id}/unblock", response_model=CardRead)
def admin_unblock_card(card_id: uuid.UUID, db: DbSession):
    return CardService(db).set_active(card_id, True)


@admin_router.post("/buses", response_model=BusRead, status_code=status.HTTP_201_CREATED)
def admin_create_bus(payload: BusCreate, db: DbSession):
    return TransitService(db).create_bus(payload.plate, payload.line_id, payload.direction)


@admin_router.get("/occupancy", response_model=list[BusOccupancy])
def admin_occupancy(db: DbSession):
    return StatsService(db).occupancy()


@admin_router.get("/occupancy/{bus_id}", response_model=BusOccupancyDetail)
def admin_occupancy_detail(bus_id: uuid.UUID, db: DbSession):
    return StatsService(db).occupancy_detail(bus_id)


@admin_router.get("/stats", response_model=StatsSummary)
def admin_stats(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    return StatsService(db).summary(days)


@admin_router.patch("/cards/{card_id}/type", response_model=CardRead)
def admin_set_card_type(card_id: uuid.UUID, payload: CardTypeUpdate, db: DbSession):
    return CardService(db).set_type(card_id, payload.card_type)


@admin_router.get("/analytics/overview", response_model=AnalyticsOverview)
def admin_analytics_overview(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    return StatsService(db).overview(days)


@admin_router.get("/analytics/lines", response_model=list[LineAnalytics])
def admin_analytics_lines(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    """Hat başına yoğunluk ve sefer artır/azalt önerisi."""
    return StatsService(db).line_analytics(days)


@admin_router.get("/analytics/stops", response_model=list[StopAnalytics])
def admin_analytics_stops(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    return StatsService(db).stop_analytics(days)


@admin_router.get("/analytics/pairs", response_model=list[StopPair])
def admin_analytics_pairs(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    """En yoğun güzergâhlar — hangi duraklar arası en çok yolculuk yapılıyor."""
    return StatsService(db).stop_pairs(days)


@admin_router.get("/analytics/card-types", response_model=list[CardTypeShare])
def admin_analytics_card_types(db: DbSession, days: int = Query(default=7, ge=1, le=90)):
    return StatsService(db).card_type_shares(days)


@admin_router.get("/trips", response_model=list[RecentTrip])
def admin_recent_trips(db: DbSession, limit: int = Query(default=20, le=100)):
    return StatsService(db).recent_trips(limit)


@admin_router.post("/trips/{trip_id}/close", response_model=TripRead)
def admin_close_trip(trip_id: uuid.UUID, db: DbSession, stop_id: uuid.UUID | None = None):
    return TripService(db).close_manually(trip_id, stop_id)


routers = [
    auth_router,
    passenger_router,
    card_router,
    transit_router,
    favorite_router,
    trip_router,
    validation_router,
    admin_router,
]
