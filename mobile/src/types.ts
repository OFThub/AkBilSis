export type CardType = "tam" | "ogrenci";

export interface CardInfo {
  cardNo: string;
  cardType: CardType;
  balance: number;
}

export interface ActiveTrip {
  lineId: string;
  boardingStopIndex: number;
  boardTime: string; // ISO 8601
  fare: number;
}

export interface TripRecord {
  localId: string;
  cardNo: string;
  cardType: CardType;
  line: string;
  boardingStop: string;
  alightingStop: string;
  boardTime: string; // ISO 8601
  alightTime: string; // ISO 8601
  durationMin: number;
  fare: number;
  status: "sent" | "pending";
}

export interface Settings {
  backendUrl: string;
  demoMode: boolean; // biniş saatini elle seçme (grafik demoları için)
  demoHour: number; // 0-23
}
