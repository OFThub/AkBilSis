/**
 * Backend adresinin hesaplanması — saf mantık, React Native'e bağımlı değildir.
 *
 * Adresi belirleyen girdiler (`.env` değeri, Metro'nun paket adresi, platform)
 * `env.ts` tarafından toplanır ve buraya verilir. Ayrı durmasının sebebi bu
 * kuralların cihaz olmadan sınanabilmesidir: adres yanlış hesaplandığında
 * uygulama "Sunucuya ulaşılamadı" der ve sebebi görünmez olur.
 */

/** Backend'in uvicorn ile dinlediği port */
export const BACKEND_PORT = 8000;

export interface BackendUrlInput {
  /** `.env` içindeki EXPO_PUBLIC_BACKEND_URL — boş olabilir */
  configured?: string;
  /** Metro'nun sunduğu paketin adresi; yayımlanmış pakette yoktur */
  scriptURL?: string | null;
  /** Fiziksel cihaz ya da emülatör (web değil) */
  onDevice: boolean;
}

export function normalize(url: string): string {
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
export function hostFromBundler(scriptURL?: string | null): string | null {
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
export function pointsAtSelf(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

/**
 * Öncelik sırası:
 *   1. `EXPO_PUBLIC_BACKEND_URL` doluysa o kullanılır (üretim / özel kurulum)
 *   2. Metro sunucusunun adresi + BACKEND_PORT  ← olağan geliştirme hâli
 *   3. localhost (tarayıcı ve emülatör)
 */
export function resolveBackendUrl(input: BackendUrlInput): string {
  const { configured, scriptURL, onDevice } = input;
  const discovered = onDevice ? hostFromBundler(scriptURL) : null;

  const explicit = configured?.trim() ? normalize(configured) : null;
  if (explicit) {
    // Telefonda "localhost" telefonun kendisidir; bilgisayarın adresi
    // bilindiğinde bu yazım sessizce düzeltilir, yoksa uygulama hiç
    // bağlanamaz ve sebebi de görünmez olurdu.
    if (onDevice && pointsAtSelf(explicit) && discovered) return discovered;
    return explicit;
  }

  return discovered ?? `http://localhost:${BACKEND_PORT}`;
}
