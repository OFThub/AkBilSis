/**
 * Ortam değişkenleri — tek okuma noktası.
 *
 * Değerler `mobile/.env` dosyasından gelir ve Expo tarafından paket derlenirken
 * satır içine gömülür. Bu yüzden `process.env.EXPO_PUBLIC_X` ifadesi birebir
 * böyle yazılmalıdır; değişkene alınıp parçalanırsa (destructure) Metro değeri
 * gömemez ve undefined kalır. `.env` değişince Metro önbelleği temizlenmeli:
 * `npx expo start -c`.
 */

/**
 * Backend adresi — uygulama arayüzünde hiçbir yerde gösterilmez ve
 * değiştirilemez. Telefonla test ederken bilgisayarın ağ adresi yazılmalıdır;
 * telefondaki "localhost" telefonun kendisidir.
 *
 * Otobüs simülasyonu artık sunucuda çalışır (backend/app/simulation.py), bu
 * yüzden uygulamada hız çarpanı gibi bir ayar yoktur.
 */
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "http://localhost:8000";
