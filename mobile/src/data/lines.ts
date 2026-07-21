import { CardType } from "../types";

// Bilet ücretleri (simülasyon değerleri) — tek yerden yönetilir
export const FARES: Record<CardType, number> = {
  tam: 20.0,
  ogrenci: 9.76,
};

export interface BusLine {
  id: string;
  name: string;
  /** Kısa rozet etiketi (ör. "448") */
  code: string;
  stops: string[];
  /** minutesBetween[i] = stops[i] -> stops[i+1] arası dakika */
  minutesBetween: number[];
  /** Saat başına göreli yoğunluk (0-100), index = saat (0-23) */
  hourly: number[];
}

export const LINES: BusLine[] = [
  {
    id: "448",
    code: "448",
    name: "448 Arnavutköy – Mecidiyeköy",
    stops: [
      "Arnavutköy Meydan",
      "Fatih Caddesi",
      "Taşoluk",
      "Haraççı",
      "Hadımköy Sanayi",
      "Basın Ekspres",
      "Mecidiyeköy",
    ],
    minutesBetween: [6, 7, 5, 9, 14, 18],
    // Banliyö hattı — sert sabah ve akşam zirvesi
    hourly: [
      2, 1, 1, 1, 3, 12, 38, 82, 100, 71, 42, 35, 33, 34, 38, 46, 63, 88, 95,
      70, 44, 26, 14, 6,
    ],
  },
  {
    id: "h1",
    code: "H-1",
    name: "H-1 Haraççı – Arnavutköy Merkez",
    stops: [
      "Haraççı Merkez",
      "Mustafa Kemal Paşa",
      "Adnan Menderes Bulvarı",
      "Devlet Hastanesi",
      "Belediye",
      "Arnavutköy Meydan",
    ],
    minutesBetween: [4, 5, 6, 3, 4],
    // Merkez içi hat — gün boyu yayvan, öğlen de canlı
    hourly: [
      3, 2, 1, 1, 2, 8, 24, 52, 68, 61, 55, 58, 62, 60, 57, 59, 66, 74, 70, 52,
      38, 25, 14, 7,
    ],
  },
  {
    id: "ar2",
    code: "AR-2",
    name: "AR-2 Taşoluk – Devlet Hastanesi",
    stops: [
      "Taşoluk Konutları",
      "Taşoluk Merkez",
      "Yavuz Selim Caddesi",
      "İmam Hatip Lisesi",
      "Belediye",
      "Devlet Hastanesi",
    ],
    minutesBetween: [3, 4, 5, 4, 3],
    // Hastane hattı — gündüz ağırlıklı, poliklinik saatlerinde tepe
    hourly: [
      1, 1, 0, 0, 1, 4, 14, 34, 56, 78, 85, 80, 62, 68, 76, 72, 58, 46, 34, 24,
      16, 10, 5, 2,
    ],
  },
  {
    id: "ar3",
    code: "AR-3",
    name: "AR-3 Hadımköy – Arnavutköy",
    stops: [
      "Hadımköy Sanayi",
      "Ömerli",
      "Deliklikaya",
      "Dursunköy",
      "Arnavutköy Meydan",
    ],
    minutesBetween: [7, 6, 8, 9],
    // Sanayi hattı — erken vardiya girişi ve akşam çıkışı
    hourly: [
      4, 2, 2, 3, 10, 32, 74, 92, 66, 44, 32, 28, 30, 34, 40, 52, 86, 78, 50,
      30, 20, 12, 7, 4,
    ],
  },
];

export function findLine(lineId: string): BusLine | undefined {
  return LINES.find((l) => l.id === lineId);
}

/** İki durak arasındaki toplam seyahat süresi (dk) */
export function travelMinutes(
  line: BusLine,
  fromIndex: number,
  toIndex: number
): number {
  let total = 0;
  for (let i = fromIndex; i < toIndex; i++) {
    total += line.minutesBetween[i] ?? 0;
  }
  return total;
}

/**
 * En yoğun `count` saati döndürür. Komşu saatler (±1) aynı tepenin parçası
 * sayılır — böylece iki ayrı zirve gösterilir, aynı tepenin iki yanı değil.
 * Sonuç artan saat sırasındadır.
 */
export function peakHours(line: BusLine, count = 2): number[] {
  const byBusiest = line.hourly
    .map((value, hour) => ({ value, hour }))
    .sort((a, b) => b.value - a.value);

  const peaks: number[] = [];
  for (const { hour } of byBusiest) {
    if (peaks.length >= count) break;
    if (peaks.some((picked) => Math.abs(picked - hour) <= 1)) continue;
    peaks.push(hour);
  }
  return peaks.sort((a, b) => a - b);
}

/** Biniş durağından itibaren kümülatif süreler — durak seçim listesi için */
export function cumulativeMinutes(line: BusLine, fromIndex: number): number[] {
  return line.stops.map((_, idx) =>
    idx <= fromIndex ? 0 : travelMinutes(line, fromIndex, idx)
  );
}
