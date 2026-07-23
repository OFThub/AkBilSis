/**
 * Backend sözleşmesinin mobil karşılığı.
 *
 * Hat, durak, otobüs ve yolculuk verisi yalnızca sunucudan gelir — uygulamada
 * kopyası tutulmaz. Ücret/bakiye kavramı yoktur: tam ve öğrenci yalnızca statü
 * farkıdır, hiçbir yerde para geçmez.
 */

export type CardType = "normal" | "student" | "senior";
export type CardMedium = "physical" | "mobile";
export type TripStatus = "open" | "completed" | "abandoned";

export interface Passenger {
  id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Card {
  id: string;
  nfc_uid: string | null;
  medium: CardMedium;
  card_type: CardType;
  is_active: boolean;
  passenger_id: string | null;
  created_at: string;
}

export interface Stop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LineStop {
  sequence: number;
  direction: "forward" | "backward";
  minutes_from_previous: number | null;
  stop: Stop;
}

export type Direction = "forward" | "backward";

export interface Line {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  /** Saat başına beklenen yoğunluk (24 eleman) */
  hourly_profile: number[];
  /** hourly_profile'dan sunucuda türetilen tepe saatler */
  peak_hours: number[];
}

export interface LineDetail extends Line {
  line_stops: LineStop[];
}

/**
 * Aracın canlı konumu. Konum sunucuda, duvar saatinden deterministik
 * hesaplanır; telefon kendi hesabını yapmaz.
 */
export interface LiveBus {
  id: string;
  plate: string;
  line_id: string;
  /** Aracın o anki yönü — gidiş bacağında forward, dönüşte backward */
  direction: Direction;
  /** Durakta bekliyor — biniş ve iniş yalnızca bu sırada yapılabilir */
  at_stop: boolean;
  /** Son durakta sefer bekliyor — yolcu alınmaz */
  layover: boolean;
  current_stop: Stop | null;
  next_stop: Stop | null;
  minutes_to_next: number;
  passenger_count: number;
}

export interface Trip {
  id: string;
  /** Yolculuğun yapıldığı araç — süren yolculukta iniş bu araca yapılır */
  bus_id: string;
  line: Line;
  board_stop: Stop;
  alight_stop: Stop | null;
  boarded_at: string;
  alighted_at: string | null;
  status: TripStatus;
}

export interface Favorite {
  id: string;
  line_id: string;
  line: Line;
  created_at: string;
}

/** Kart bas sonucu — biniş mi iniş mi olduğunu sunucu söyler */
export interface ValidateResult {
  action: "boarded" | "alighted";
  trip_id: string;
  passenger_name: string | null;
  line_code: string;
  stop_name: string;
  occurred_at: string;
}

export type ThemeMode = "light" | "dark";
export type Language = "tr" | "en";

/** Ayarlar tamamen yereldir — hiçbiri sunucuya gönderilmez. */
export interface Settings {
  theme: ThemeMode;
  language: Language;
}
