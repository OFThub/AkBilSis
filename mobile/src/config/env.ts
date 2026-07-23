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
 * Kuralların kendisi `backendUrl.ts` içindedir; burada yalnızca girdiler
 * toplanır.
 */

import { NativeModules, Platform } from "react-native";
import { resolveBackendUrl } from "./backendUrl";

/**
 * Metro'nun sunduğu paketin adresi.
 *
 * Yeni mimaride (Expo SDK 54+/RN 0.76+) yerel modüller TurboModule'dür ve
 * sabitleri **artık modülün üstünde özellik olarak durmaz**; yalnızca
 * `getConstants()` ile okunur. `NativeModules.SourceCode.scriptURL` bu yüzden
 * sessizce `undefined` döner — React Native ve Expo da kendi içlerinde
 * `getConstants().scriptURL` kullanır. Eski mimari için doğrudan özellik
 * yedekte tutulur.
 */
function bundlerScriptURL(): string | null {
  const sourceCode = NativeModules?.SourceCode as
    | { getConstants?: () => { scriptURL?: string }; scriptURL?: string }
    | undefined;
  if (!sourceCode) return null;

  try {
    return sourceCode.getConstants?.().scriptURL ?? sourceCode.scriptURL ?? null;
  } catch {
    // Modül bu platformda yoksa adres bulunamaz; çağıran localhost'a düşer
    return null;
  }
}

const onDevice = Platform.OS !== "web";

/** Backend adresi — arayüzde hiçbir yerde gösterilmez ve değiştirilemez */
export const BACKEND_URL = resolveBackendUrl({
  configured: process.env.EXPO_PUBLIC_BACKEND_URL,
  scriptURL: onDevice ? bundlerScriptURL() : null,
  onDevice,
});

/**
 * Bağlantı sorunlarını ayıklamak için: uygulama açılırken hangi adrese
 * konuşacağı Metro günlüğüne yazılır. Telefon "sunucuya ulaşılamadı" derse
 * ilk bakılacak yer burasıdır.
 */
if (__DEV__) {
  console.log(`[akbil] backend adresi: ${BACKEND_URL}`);
  if (onDevice && BACKEND_URL.includes("localhost")) {
    console.warn(
      "[akbil] Backend adresi localhost'a düştü — telefonda bu adres telefonun " +
        "kendisidir ve sunucuya ulaşılamaz. Metro'nun adresi okunamadı; " +
        "mobile/.env içine EXPO_PUBLIC_BACKEND_URL=http://<bilgisayar-ip>:8000 yazın."
    );
  }
}
