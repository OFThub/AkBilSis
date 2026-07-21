export type CardType = "tam" | "ogrenci";

/**
 * Kayıtlı kullanıcı = sanal akbil kartının sahibi. Kart verisi burada yaşar;
 * NFC etiketi yalnızca tagId ile bu kaydı işaret eder.
 */
export interface CardUser {
  id: string;
  name: string;
  cardNo: string;
  cardType: CardType;
  balance: number;
  /** Bağlı NFC etiketinin donanım ID'si — yalnızca NFC açıkken kullanılır */
  tagId?: string;
}

export interface ActiveTrip {
  lineId: string;
  boardingStopIndex: number;
  boardTime: string; // ISO 8601
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
  /** İniş sonrası kalan bakiye */
  balanceAfter?: number;
  status: "sent" | "pending";
}

export interface Settings {
  backendUrl: string;
  demoMode: boolean; // biniş saatini elle seçme (grafik demoları için)
  demoHour: number; // 0-23
  /**
   * Açık: NFC etiketi okunur, ID'si ile kayıtlı kullanıcı bulunur (liste gizlenir).
   * Kapalı: NFC devre dışı, kullanıcı listeden elle seçilir (okutma arayüzü gizlenir).
   */
  nfcEnabled: boolean;
}
