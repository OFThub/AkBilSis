import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core import CardMedium, CardType, Direction, TripStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    card_type: CardType = CardType.NORMAL

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError("Parola en fazla 72 bayt olabilir")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PassengerRead(ORMModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    is_admin: bool
    created_at: datetime


class PassengerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)


class CardRead(ORMModel):
    id: uuid.UUID
    nfc_uid: str | None
    medium: CardMedium
    card_type: CardType
    is_active: bool
    passenger_id: uuid.UUID | None
    created_at: datetime


class CardCreate(BaseModel):
    card_type: CardType = CardType.NORMAL
    medium: CardMedium = CardMedium.MOBILE
    nfc_uid: str | None = Field(default=None, max_length=32)
    passenger_id: uuid.UUID | None = None


class CardLinkRequest(BaseModel):
    nfc_uid: str = Field(min_length=4, max_length=32)


class CardTypeUpdate(BaseModel):

    card_type: CardType


class StopRead(ORMModel):
    id: uuid.UUID
    name: str
    latitude: float | None
    longitude: float | None


class LineStopRead(ORMModel):
    sequence: int
    direction: Direction
    minutes_from_previous: int | None
    stop: StopRead


class LineRead(ORMModel):
    id: uuid.UUID
    code: str
    name: str
    is_active: bool
    hourly_profile: list[int] = []
    peak_hours: list[int] = []


class LineDetail(LineRead):
    line_stops: list[LineStopRead] = []


class BusRead(ORMModel):
    id: uuid.UUID
    plate: str
    line_id: uuid.UUID
    direction: Direction
    is_active: bool


class BusCreate(BaseModel):
    plate: str = Field(min_length=5, max_length=16)
    line_id: uuid.UUID
    direction: Direction = Direction.FORWARD


class TripRead(ORMModel):
    id: uuid.UUID
    card_id: uuid.UUID
    bus_id: uuid.UUID
    line_id: uuid.UUID
    board_stop_id: uuid.UUID
    alight_stop_id: uuid.UUID | None
    boarded_at: datetime
    alighted_at: datetime | None
    status: TripStatus


class TripDetail(TripRead):
    line: LineRead
    board_stop: StopRead
    alight_stop: StopRead | None


class FavoriteCreate(BaseModel):
    line_id: uuid.UUID


class FavoriteRead(ORMModel):
    id: uuid.UUID
    line_id: uuid.UUID
    line: LineRead
    created_at: datetime


class LineLiveStatus(BaseModel):
    line_id: uuid.UUID
    line_code: str
    active_bus_count: int
    total_passengers: int


class BusLive(BaseModel):

    id: uuid.UUID
    plate: str
    line_id: uuid.UUID
    at_stop: bool
    layover: bool
    current_stop: StopRead | None
    next_stop: StopRead | None
    minutes_to_next: int
    passenger_count: int


class ValidateRequest(BaseModel):

    bus_id: uuid.UUID


class ValidateResponse(BaseModel):
    action: str
    trip_id: uuid.UUID
    passenger_name: str | None
    line_code: str
    stop_name: str
    occurred_at: datetime


class BusOccupancy(BaseModel):
    bus_id: uuid.UUID
    plate: str
    line_code: str
    passenger_count: int


class OccupancyPassenger(BaseModel):
    trip_id: uuid.UUID
    passenger_id: uuid.UUID | None
    passenger_name: str | None
    card_type: CardType
    board_stop_name: str
    boarded_at: datetime


class BusOccupancyDetail(BusOccupancy):
    passengers: list[OccupancyPassenger] = []


class HourlyBoarding(BaseModel):
    hour: int
    count: int


class StopBoarding(BaseModel):
    stop_id: uuid.UUID
    stop_name: str
    count: int


class StatsSummary(BaseModel):
    total_trips: int
    open_trips: int
    abandoned_trips: int
    active_buses: int
    hourly: list[HourlyBoarding] = []
    top_stops: list[StopBoarding] = []




class AnalyticsOverview(BaseModel):
    total_trips: int
    open_trips: int
    completed_trips: int
    abandoned_trips: int
    active_buses: int
    onboard_passengers: int
    busiest_hour: int | None
    hourly: list[HourlyBoarding] = []


class LineAnalytics(BaseModel):
    line_id: uuid.UUID
    code: str
    name: str
    total_trips: int
    peak_hour: int | None
    peak_hour_trips: int
    active_buses: int
    peak_per_bus: float
    load_level: str
    recommendation: str


class StopAnalytics(BaseModel):
    stop_id: uuid.UUID
    name: str
    boardings: int
    alightings: int
    total: int
    load_level: str


class StopPair(BaseModel):
    board_stop: str
    alight_stop: str
    count: int


class CardTypeShare(BaseModel):
    card_type: CardType
    label: str
    count: int


class RecentTrip(BaseModel):
    id: uuid.UUID
    passenger_name: str | None
    card_type: CardType
    line_code: str
    line_name: str
    bus_plate: str
    board_stop: str
    alight_stop: str | None
    boarded_at: datetime
    alighted_at: datetime | None
    duration_min: int | None
    status: TripStatus
