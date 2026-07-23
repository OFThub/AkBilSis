/**
 * Backend adresinin belirlenmesi.
 *
 * Telefon ile backend ayrı cihazlardadır: telefondaki "localhost" telefonun
 * kendisidir, bilgisayara ulaşmaz. Adresi elle yazmak ise DHCP her yeni adres
 * verdiğinde bozulur.
 *
 * Bu yüzden adres **Metro paketleyicinin adresinden türetilir**: uygulama zaten
 * geliştirme bilgisayarından indirildiğine göre o bilgisayarın IP'si bilinir ve
 * doğrudur. Yalnızca port değiştirilir (8081 → 8000).
 *
 * Öncelik sırası:
 *   1. `EXPO_PUBLIC_BACKEND_URL` doluysa o kullanılır (üretim / özel kurulum)
 *   2. Metro sunucusunun adresi + BACKEND_PORT  ← olağan geliştirme hâli
 *   3. localhost (tarayıcı ve emülatör)
 */

import { NativeModules, Platform } from "react-native";

/** Backend'in uvicorn ile dinlediği port */
const BACKEND_PORT = 8000;

function normalize(url: string): string {
  let value = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) value = "http://" + value;
  return value;
}

/**
 * Metro paketleyicinin sunulduğu makinenin adresi.
 *
 * `scriptURL` örneği: "http://10.5.24.156:8081/index.bundle?platform=android"
 * Buradan yalnızca sunucu adı alınır; port backend'inkiyle değiştirilir.
 */
function hostFromBundler(): string | null {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) return null;

  // Ayrıştırma elle yapılır: React Native'in URL desteği sürümden sürüme değişir
  const match = /^https?:\/\/([^/:]+)(?::\d+)?/i.exec(scriptURL);
  const host = match?.[1];
  if (!host) return null;

  // Yayımlanmış pakette scriptURL yerel dosyayı gösterir — oradan adres çıkmaz
  if (host === "localhost" || host === "127.0.0.1") return null;

  return `http://${host}:${BACKEND_PORT}`;
}

/** Adres telefonun kendisini mi gösteriyor — fiziksel cihazda daima hatalı */
function pointsAtSelf(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

function resolveBackendUrl(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  const onDevice = Platform.OS !== "web";
  const discovered = onDevice ? hostFromBundler() : null;

  if (configured) {
    const explicit = normalize(configured);
    // Telefonda "localhost" telefonun kendisidir; bilgisayarın adresi
    // bilindiğinde bu yazım sessizce düzeltilir, yoksa uygulama hiç
    // bağlanamaz ve sebebi de görünmez olurdu.
    if (onDevice && pointsAtSelf(explicit) && discovered) {
      if (__DEV__) {
        console.warn(
          `[akbil] .env içindeki ${explicit} telefondan erişilemez; ` +
            `Expo sunucusunun adresi kullanılıyor: ${discovered}`
        );
      }
      return discovered;
    }
    return explicit;
  }

  return discovered ?? `http://localhost:${BACKEND_PORT}`;
}

/** Backend adresi — arayüzde hiçbir yerde gösterilmez ve değiştirilemez */
export const BACKEND_URL = resolveBackendUrl();

/**
 * Bağlantı sorunlarını ayıklamak için: uygulama açılırken hangi adrese
 * konuşacağı Metro günlüğüne yazılır. Telefon "sunucuya ulaşılamadı" derse
 * ilk bakılacak yer burasıdır.
 */
if (__DEV__) {
  console.log(`[akbil] backend adresi: ${BACKEND_URL}`);
}
