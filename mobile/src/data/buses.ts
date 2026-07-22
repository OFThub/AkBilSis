/**
 * Canlı otobüs simülasyonu.
 *
 * Araç konumu duvar saatinden **deterministik** hesaplanır: hiçbir durum
 * saklanmaz, uygulama kapanıp açılsa da aynı anda aynı sonucu verir. Böylece
 * "şu an yolda olan otobüs" kavramı ek sunucu ya da kalıcı state olmadan
 * çalışır — biniş/iniş durağı bu konumdan türetilir.
 *
 * Zaman ölçeği config/env.ts içindeki SIM_SPEED ile hızlandırılır (10 →
 * gerçek 30 sn ≈ 5 dk yol). Tarife verisi lines.ts'ten gelir, burada
 * çoğaltılmaz.
 */

import { SIM_SPEED } from "../config/env";
import { BusLine, findLine } from "./lines";

/** Hat başına sefer hâlindeki araç sayısı */
const BUSES_PER_LINE = 3;
/** Son durak molası — araç bu sırada sefere hazırlanır, biniş kapalıdır */
const LAYOVER_MIN = 6;
/**
 * Araç her durakta bu kadar bekler (sim-dakika). Biniş ve iniş yalnızca bu
 * pencerede yapılabildiği için süre kullanıcının düğmeye yetişeceği kadar
 * uzun tutulur: SIM_SPEED=10'da 3 sim-dakika ≈ gerçek 18 saniye.
 */
const DWELL_MIN = 3;

const PLATE_LETTERS = ["AKB", "ARN", "BLD", "TSK", "HRC", "MDK"];

export interface LiveBus {
  /** Simülasyon kimliği — ör. "448-2" */
  id: string;
  plate: string;
  lineId: string;
  /** Araç duraktaysa bulunduğu durak; yoldaysa en son ayrıldığı durak */
  fromIndex: number;
  /** Yaklaştığı durak (molada son durağın kendisi) */
  toIndex: number;
  /** Durakta bekliyor — biniş ve iniş yalnızca bu sırada yapılabilir */
  atStop: boolean;
  /** Sıradaki olaya kalan dakika: duraktayken kalkışa, yoldayken varışa, molada sefere */
  minutesToNext: number;
  /** Son durağa kalan sim-dakika — yuvarlanmaz, otomatik iniş anı bundan hesaplanır */
  minutesToTerminus: number;
  /** Son durakta bekliyor — sefer bitti, yolcu alınmaz */
  layover: boolean;
}

/**
 * Araç başına o an içeride olan yolcu sayısı. Doluluk tahmin edilmez: binen
 * herkes için açık bir yolculuk kaydı tutulduğundan gerçek sayı bilinir.
 */
export function passengerCounts(
  activeTrips: { busId: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trip of activeTrips) {
    counts[trip.busId] = (counts[trip.busId] ?? 0) + 1;
  }
  return counts;
}

/** Metinden sabit sayı — plaka gibi görsel ayrıntılar her açılışta aynı kalsın */
function seedOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function plateFor(busId: string): string {
  const seed = seedOf(busId);
  const letters = PLATE_LETTERS[seed % PLATE_LETTERS.length];
  return `34 ${letters} ${100 + (seed % 900)}`;
}

/** Hızlandırılmış simülasyon saati (dakika) */
function simMinutes(now: Date): number {
  return (now.getTime() / 60000) * SIM_SPEED;
}

/**
 * Sefer tarifesi: stopArrival[i] = sefer başlangıcından o durağa varışa kadar
 * geçen dakika. Her durakta DWELL_MIN kadar beklendiği için duraklama süresi
 * yol süresine eklenir — "durakta olma" hâli buradan doğar, mesafeden
 * türetilmez.
 */
export function stopSchedule(line: BusLine): number[] {
  const arrival = [0];
  for (let i = 1; i < line.stops.length; i++) {
    arrival.push(arrival[i - 1] + DWELL_MIN + (line.minutesBetween[i - 1] ?? 0));
  }
  return arrival;
}

/** Hattın o anda yolda olan araçları — sefer sırasına göre */
export function busesForLine(line: BusLine, now: Date): LiveBus[] {
  const arrival = stopSchedule(line);
  const lastIndex = line.stops.length - 1;
  // Sefer son durağa varışla biter; ardından mola gelir
  const routeMin = arrival[lastIndex];
  const cycleMin = routeMin + LAYOVER_MIN;
  const clock = simMinutes(now);

  return Array.from({ length: BUSES_PER_LINE }, (_, busIndex) => {
    const offset = (busIndex * cycleMin) / BUSES_PER_LINE;
    const pos = (((clock - offset) % cycleMin) + cycleMin) % cycleMin;
    const id = `${line.id}-${busIndex + 1}`;
    const base = { id, plate: plateFor(id), lineId: line.id };

    // Son durak molası: sefer bitti, başa dönmeyi bekliyor
    if (pos >= routeMin) {
      return {
        ...base,
        fromIndex: lastIndex,
        toIndex: lastIndex,
        atStop: false,
        minutesToNext: Math.max(1, Math.ceil(cycleMin - pos)),
        minutesToTerminus: 0,
        layover: true,
      };
    }

    // Hangi durakta/dilimde: arrival[i] <= pos < arrival[i+1].
    // pos < arrival[lastIndex] olduğundan döngü lastIndex'e ulaşamaz.
    let fromIndex = 0;
    while (fromIndex < lastIndex && arrival[fromIndex + 1] <= pos) fromIndex++;

    const departure = arrival[fromIndex] + DWELL_MIN;
    const atStop = pos < departure;
    const toIndex = fromIndex + 1;

    return {
      ...base,
      fromIndex,
      toIndex,
      atStop,
      minutesToNext: Math.max(
        1,
        Math.ceil((atStop ? departure : arrival[toIndex]) - pos)
      ),
      minutesToTerminus: routeMin - pos,
      layover: false,
    };
  });
}

/** Tek aracın o anki durumu — biniş/iniş anında konumu okumak için */
export function findBus(
  lineId: string,
  busId: string,
  now: Date
): LiveBus | undefined {
  const line = findLine(lineId);
  if (!line) return undefined;
  return busesForLine(line, now).find((bus) => bus.id === busId);
}

/** Araç konumunun okunabilir hâli — hem araç listesinde hem yolculuk panelinde */
export function busLocationText(bus: LiveBus, line: BusLine): string {
  if (bus.layover) {
    return `Son durakta — ${bus.minutesToNext} dk sonra sefere çıkıyor`;
  }
  if (bus.atStop) {
    return `${line.stops[bus.fromIndex]} durağında — ${
      bus.minutesToNext
    } dk sonra kalkıyor`;
  }
  return `${line.stops[bus.fromIndex]} → ${line.stops[bus.toIndex]} · ${
    bus.minutesToNext
  } dk`;
}
