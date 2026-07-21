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

/** Biniş durağından itibaren kümülatif süreler — durak seçim listesi için */
export function cumulativeMinutes(line: BusLine, fromIndex: number): number[] {
  return line.stops.map((_, idx) =>
    idx <= fromIndex ? 0 : travelMinutes(line, fromIndex, idx)
  );
}
