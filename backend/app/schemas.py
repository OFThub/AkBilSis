import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core import CardMedium, CardType, Direction, TripStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


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


class CardTokenResponse(BaseModel):
    card_token: str
    expires_in: int


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


class LineDetail(LineRead):
    line_stops: list[LineStopRead] = []


class BusRead(ORMModel):
    id: uuid.UUID
    plate: str
    line_id: uuid.UUID
    direction: Direction
    current_stop_id: uuid.UUID | None
    location_updated_at: datetime | None
    is_active: bool


class BusCreate(BaseModel):
    plate: str = Field(min_length=5, max_length=16)
    line_id: uuid.UUID
    direction: Direction = Direction.FORWARD


class BusLocationUpdate(BaseModel):
    stop_id: uuid.UUID


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


class ValidateRequest(BaseModel):
    card_token: str | None = None
    nfc_uid: str | None = None
    stop_id: uuid.UUID


class ValidateResponse(BaseModel):
    action: str
    trip_id: uuid.UUID
    passenger_name: str | None
    line_code: str
    stop_name: str
    occurred_at: datetime


class DeviceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    bus_id: uuid.UUID | None = None

class DeviceBusAssign(BaseModel):
    bus_id: uuid.UUID

class DeviceRead(ORMModel):
    id: uuid.UUID
    name: str
    bus_id: uuid.UUID | None
    is_active: bool
    created_at: datetime


class DeviceCreated(DeviceRead):
    api_key: str


class BusOccupancy(BaseModel):
    bus_id: uuid.UUID
    plate: str
    line_code: str
    current_stop_name: str | None
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
