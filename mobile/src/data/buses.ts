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
import { BusLine, cumulativeMinutes, findLine } from "./lines";

/** Hat başına sefer hâlindeki araç sayısı */
const BUSES_PER_LINE = 3;
/** Son durak molası — araç bu sırada sefere hazırlanır, biniş kapalıdır */
const LAYOVER_MIN = 6;
/** Duraklar arası mesafenin ilk %15'i "durakta bekliyor" sayılır */
const AT_STOP_FRACTION = 0.15;

const PLATE_LETTERS = ["AKB", "ARN", "BLD", "TSK", "HRC", "MDK"];

export interface LiveBus {
  /** Simülasyon kimliği — ör. "448-2" */
  id: string;
  plate: string;
  lineId: string;
  /** En son geçtiği durak */
  fromIndex: number;
  /** Yaklaştığı durak (molada son durağın kendisi) */
  toIndex: number;
  /** Biniş/iniş durağı bundan belirlenir — aracın o an en yakın olduğu durak */
  nearestStopIndex: number;
  atStop: boolean;
  /** Sıradaki durağa kalan dakika; molada sefere kalan süre */
  minutesToNext: number;
  /** Son durakta bekliyor — yolcu binemez, ama araçtaki yolcu inebilir */
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

/** Hattın o anda yolda olan araçları — sefer sırasına göre */
export function busesForLine(line: BusLine, now: Date): LiveBus[] {
  const cum = cumulativeMinutes(line, 0);
  const lastIndex = line.stops.length - 1;
  const routeMin = cum[lastIndex];
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
        nearestStopIndex: lastIndex,
        atStop: true,
        minutesToNext: Math.max(1, Math.ceil(cycleMin - pos)),
        layover: true,
      };
    }

    // Hangi iki durak arasında: cum[i] <= pos < cum[i+1]
    let fromIndex = 0;
    while (fromIndex < lastIndex - 1 && cum[fromIndex + 1] <= pos) fromIndex++;
    const toIndex = fromIndex + 1;
    const segmentMin = cum[toIndex] - cum[fromIndex];
    const progress = segmentMin > 0 ? (pos - cum[fromIndex]) / segmentMin : 0;

    return {
      ...base,
      fromIndex,
      toIndex,
      nearestStopIndex: progress < 0.5 ? fromIndex : toIndex,
      atStop: progress < AT_STOP_FRACTION,
      minutesToNext: Math.max(1, Math.ceil(cum[toIndex] - pos)),
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
  if (bus.atStop) return `${line.stops[bus.fromIndex]} durağında`;
  return `${line.stops[bus.fromIndex]} → ${line.stops[bus.toIndex]} · ${
    bus.minutesToNext
  } dk`;
}
