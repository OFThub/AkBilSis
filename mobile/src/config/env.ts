/**
 * Ortam değişkenleri — tek okuma noktası.
 *
 * Değerler `mobile/.env` dosyasından gelir ve Expo tarafından paket derlenirken
 * satır içine gömülür. Bu yüzden `process.env.EXPO_PUBLIC_X` ifadesi birebir
 * böyle yazılmalıdır; değişkene alınıp parçalanırsa (destructure) Metro değeri
 * gömemez ve undefined kalır. `.env` değişince Metro önbelleği temizlenmeli:
 * `npx expo start -c`.
 */

/** İzleme merkezi (backend) adresi — uygulama arayüzünde hiçbir yerde gösterilmez */
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "http://localhost:4000";

/**
 * Otobüs simülasyonu hız çarpanı: 10 → gerçek 30 sn ≈ 5 dk yolculuk.
 * Geçersiz/0 değerde 10'a düşer, aksi hâlde otobüsler hiç hareket etmez.
 */
const rawSimSpeed = Number(process.env.EXPO_PUBLIC_SIM_SPEED);
export const SIM_SPEED =
  Number.isFinite(rawSimSpeed) && rawSimSpeed > 0 ? rawSimSpeed : 10;
