export type CardType = "tam" | "ogrenci";

/**
 * Kayıtlı kullanıcı = sanal akbil kartının sahibi. Kart kimliği burada yaşar;
 * kullanıcı kayıtlı listeden seçilerek doğrulanır. Ücret/bakiye kavramı
 * yoktur: tam ve öğrenci yalnızca statü farkıdır, hiçbir yerde para geçmez.
 */
export interface CardUser {
  id: string;
  name: string;
  cardNo: string;
  cardType: CardType;
}

/**
 * Devam eden yolculuk. Kişiye bağlıdır: bir kullanıcının aynı anda en çok bir
 * aktif yolculuğu olabilir, inmeden başka araca binemez. Farklı kullanıcılar
 * aynı anda yolculuk yapabilir.
 */
export interface ActiveTrip {
  /** Yolculuğun sahibi — listeden seçilerek doğrulanan kullanıcı */
  userId: string;
  /** Binişte açılan geçmiş kaydı (TripRecord.localId) — inişte aynı kayıt tamamlanır */
  recordId: string;
  lineId: string;
  /** Binilen aracın simülasyondaki kimliği (ör. "448-2") */
  busId: string;
  /** Plaka kayıtta ve arayüzde gösterilir — araç kimliği okunaklı olsun diye */
  busPlate: string;
  /** Biniş anında aracın en yakın olduğu durak */
  boardingStopIndex: number;
  boardTime: string; // ISO 8601 — kayda yazılan saat (demo modunda kaydırılmış olabilir)
  /** Kaydırılmamış gerçek biniş anı — yolculuk süresi buradan ölçülür */
  boardRealTime: string; // ISO 8601
}

/**
 * Yolculuk kaydı. Biniş anında oluşturulur ("onboard") — yolcunun o an araçta
 * olduğu buradan bilinir ve araçların doluluğu bu kayıtlardan hesaplanır.
 * İniş yapılınca aynı kayıt tamamlanır ve sunucuya gönderilir.
 */
export interface TripRecord {
  localId: string;
  cardNo: string;
  cardType: CardType;
  line: string;
  boardingStop: string;
  boardTime: string; // ISO 8601
  /** Yolcu hâlâ araçtayken null — iniş yapılınca dolar */
  alightingStop: string | null;
  alightTime: string | null; // ISO 8601
  durationMin: number | null;
  /** Yalnızca uygulama içi gösterim — sunucuya gönderilmez */
  busPlate: string;
  /** onboard: yolcu araçta · pending: indi, gönderilemedi · sent: sunucuda */
  status: "onboard" | "pending" | "sent";
}

/** İnişi tamamlanmış kayıt — sunucuya yalnızca bunlar gönderilebilir */
export type CompletedTrip = TripRecord & {
  alightingStop: string;
  alightTime: string;
  durationMin: number;
};

export function isCompleted(record: TripRecord): record is CompletedTrip {
  return (
    record.alightingStop !== null &&
    record.alightTime !== null &&
    record.durationMin !== null
  );
}

export interface Settings {
  // İzleme merkezi adresi ayarlarda değil, gizli .env dosyasındadır (config/env.ts)
  demoMode: boolean; // biniş saatini elle seçme (grafik demoları için)
  demoHour: number; // 0-23
}
