"""Canlı otobüs simülasyonu.

Araç konumu duvar saatinden **deterministik** hesaplanır: hiçbir durum saklanmaz,
sunucu yeniden başlasa da aynı anda aynı sonucu verir. Böylece "şu an yolda olan
otobüs" kavramı ek bir zamanlayıcı ya da kalıcı state olmadan çalışır — biniş ve
iniş durağı bu konumdan türetilir.

Tek doğruluk kaynağı burasıdır: mobil uygulama da web sitesi de konumu bu
hesaptan okur, kendisi hesaplamaz. Tarife verisi `LineStop.minutes_from_previous`
alanından gelir, burada çoğaltılmaz.

Zaman ölçeği `settings.sim_speed` ile hızlandırılır (10 → gerçek 30 sn ≈ 5 dk yol).
"""

import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.config import settings

#: Hat başına sefer hâlindeki araç sayısı — seed bu kadar Bus satırı üretir
BUSES_PER_LINE = 3
#: Son durak molası (sim-dakika) — araç sefere hazırlanır, biniş kapalıdır
LAYOVER_MIN = 6
#: Araç her durakta bu kadar bekler (sim-dakika). Biniş/iniş yalnızca bu
#: pencerede yapılabildiği için kullanıcının düğmeye yetişeceği kadar uzun
#: tutulur: sim_speed=10'da 3 sim-dakika ≈ gerçek 18 saniye.
DWELL_MIN = 3


@dataclass(frozen=True)
class LivePosition:
    """Bir aracın belirli bir andaki durumu."""

    #: Araç duraktaysa bulunduğu durak; yoldaysa en son ayrıldığı durak
    from_index: int
    #: Yaklaştığı durak (molada son durağın kendisi)
    to_index: int
    #: Durakta bekliyor — biniş ve iniş yalnızca bu sırada yapılabilir
    at_stop: bool
    #: Sıradaki olaya kalan sim-dakika: duraktayken kalkışa, yoldayken varışa
    minutes_to_next: int
    #: Son durağa kalan sim-dakika — yuvarlanmaz, otomatik iniş anı bundan çıkar
    minutes_to_terminus: float
    #: Son durakta bekliyor — sefer bitti, yolcu alınmaz
    layover: bool


def stop_schedule(minutes_between: list[int]) -> list[int]:
    """arrival[i] = sefer başından o durağa varışa kadar geçen sim-dakika.

    Her durakta DWELL_MIN kadar beklendiği için duraklama süresi yola eklenir —
    "durakta olma" hâli buradan doğar, mesafeden türetilmez.

    `minutes_between[i]` = stops[i] → stops[i+1] arası dakika.
    """
    arrival = [0]
    for gap in minutes_between:
        arrival.append(arrival[-1] + DWELL_MIN + gap)
    return arrival


def sim_minutes(now: datetime) -> float:
    """Hızlandırılmış simülasyon saati (sim-dakika)."""
    return (now.timestamp() / 60.0) * settings.sim_speed


def bus_position(bus_index: int, arrival: list[int], now: datetime) -> LivePosition:
    """`bus_index` numaralı aracın o anki konumu.

    Araçlar sefer döngüsüne eşit aralıklarla dağıtılır: aynı hattaki üç araç
    birbirini takip eder, hepsi aynı anda aynı durakta olmaz.
    """
    last_index = len(arrival) - 1
    if last_index < 1:
        # Tek duraklı (bozuk) hat — hareket edecek bir güzergâh yok
        return LivePosition(0, 0, True, 1, 0.0, False)

    # Sefer son durağa varışla biter; ardından mola gelir
    route_min = arrival[last_index]
    cycle_min = route_min + LAYOVER_MIN

    offset = (bus_index * cycle_min) / BUSES_PER_LINE
    pos = (sim_minutes(now) - offset) % cycle_min

    # Son durak molası: sefer bitti, başa dönmeyi bekliyor
    if pos >= route_min:
        return LivePosition(
            from_index=last_index,
            to_index=last_index,
            at_stop=False,
            minutes_to_next=max(1, math.ceil(cycle_min - pos)),
            minutes_to_terminus=0.0,
            layover=True,
        )

    # Hangi durakta/dilimde: arrival[i] <= pos < arrival[i+1].
    # pos < arrival[last_index] olduğundan döngü last_index'e ulaşamaz.
    from_index = 0
    while from_index < last_index and arrival[from_index + 1] <= pos:
        from_index += 1

    departure = arrival[from_index] + DWELL_MIN
    at_stop = pos < departure
    to_index = from_index + 1
    next_event = departure if at_stop else arrival[to_index]

    return LivePosition(
        from_index=from_index,
        to_index=to_index,
        at_stop=at_stop,
        minutes_to_next=max(1, math.ceil(next_event - pos)),
        minutes_to_terminus=route_min - pos,
        layover=False,
    )


def terminus_moment(now: datetime, minutes_to_terminus: float) -> datetime:
    """Aracın son durağa varacağı **gerçek** an.

    Sim-dakika gerçek süreye çevrilir; biniş anında damgalanıp Trip üzerinde
    saklanır (`auto_alight_at`), otomatik iniş bu damgadan işler.
    """
    return now + timedelta(minutes=minutes_to_terminus / settings.sim_speed)


def peak_hours(hourly: list[int], count: int = 2) -> list[int]:
    """En yoğun `count` saat.

    Komşu saatler (±1) aynı tepenin parçası sayılır — böylece iki ayrı zirve
    gösterilir, aynı tepenin iki yanı değil. Sonuç artan saat sırasındadır.
    """
    if not hourly or not any(hourly):
        return []

    by_busiest = sorted(range(len(hourly)), key=lambda h: hourly[h], reverse=True)

    peaks: list[int] = []
    for hour in by_busiest:
        if len(peaks) >= count:
            break
        if any(abs(picked - hour) <= 1 for picked in peaks):
            continue
        peaks.append(hour)
    return sorted(peaks)


def load_level(ratio: float, low: float, high: float) -> str:
    """Oranı renk koduna çevirir — web sadece boyar, eşik burada tanımlıdır."""
    if ratio < low:
        return "low"
    if ratio > high:
        return "high"
    return "normal"
