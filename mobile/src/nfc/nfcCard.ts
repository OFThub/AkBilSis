/**
 * NFC katmanı — etiket yalnızca kimlik sağlar.
 *
 * Etiketin donanım ID'si (UID) okunur; kart bilgisi uygulamadaki kayıtlı
 * kullanıcı listesinde tutulduğu için etikete hiçbir şey yazılmaz. Bu sayede
 * yazma korumalı ya da boş etiketler de kart olarak kullanılabilir.
 *
 * Native modül (react-native-nfc-manager) Expo Go'da bulunmaz; bu durumda
 * "unsupported" hatası döner ve kullanıcı NFC'yi kapatıp listeden seçer.
 */

export type NfcErrorCode =
  | "unsupported" // cihazda NFC yok ya da native modül yüklenemedi (Expo Go)
  | "cancelled" // oturum iptal edildi — ekranlar sessizce yutar
  | "io"; // okuma sırasında beklenmeyen hata

export class NfcError extends Error {
  code: NfcErrorCode;
  constructor(code: NfcErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

let NfcManager: any = null;
let NfcTech: any = null;
let nfcLoaded = false;

/**
 * Native modülü ancak ilk NFC kullanımında yükler — Expo Go'da uygulama
 * açılışında ve NFC kapalı modda ona hiç dokunulmaz.
 */
function loadNfcModule(): boolean {
  if (nfcLoaded) return NfcManager !== null;
  nfcLoaded = true;
  try {
    const mod = require("react-native-nfc-manager");
    NfcManager = mod.default ?? mod;
    NfcTech = mod.NfcTech;
  } catch {
    NfcManager = null;
  }
  return NfcManager !== null;
}

const UNSUPPORTED_MSG =
  "Bu cihazda NFC okunamıyor — Expo Go native NFC modülü içermez. " +
  "Ayarlar'dan NFC'yi kapatarak kayıtlı kullanıcı listesinden seçim yapabilirsiniz.";

let nfcStarted = false;

async function nfcReady(): Promise<boolean> {
  if (!loadNfcModule()) return false;
  try {
    if (!(await NfcManager.isSupported())) return false;
    if (!nfcStarted) {
      await NfcManager.start();
      nfcStarted = true;
    }
    return true;
  } catch {
    return false;
  }
}

/** Etiket UID'sini okunabilir hex biçimine indirger */
function normalizeTagId(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) return raw.toUpperCase();
  if (Array.isArray(raw)) {
    return raw
      .map((b: number) => Number(b).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return "";
}

/** Etiketi okutur ve donanım ID'sini döndürür. Etikete yazma yapılmaz. */
export async function readTagId(): Promise<string> {
  if (!(await nfcReady())) throw new NfcError("unsupported", UNSUPPORTED_MSG);
  try {
    // Ndef + NfcA birlikte: NDEF biçimli olmayan etiketler de okunabilsin
    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA], {
      alertMessage: "Akbil kartınızı telefona yaklaştırın",
    });
    const tag = await NfcManager.getTag();
    const id = normalizeTagId(tag?.id);
    if (!id) {
      throw new NfcError(
        "io",
        "Etiket kimliği okunamadı — kartı telefona sabit tutup tekrar deneyin."
      );
    }
    return id;
  } catch (e: any) {
    if (e instanceof NfcError) throw e;
    const msg = String(e?.message ?? e ?? "");
    if (/cancel/i.test(msg)) {
      throw new NfcError("cancelled", "Okuma iptal edildi.");
    }
    throw new NfcError(
      "io",
      "Kart okunurken hata oluştu — kartı telefona sabit tutup tekrar deneyin."
    );
  } finally {
    try {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    } catch {
      // oturum zaten kapalı
    }
  }
}

/** Bekleyen NFC oturumunu iptal eder — ekrandan çıkarken çağrılır */
export function cancelCardScan(): void {
  // Modül hiç yüklenmediyse (Expo Go / NFC kapalı) iptal edilecek oturum da yok
  if (!nfcLoaded || !NfcManager) return;
  try {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  } catch {
    // oturum yoktu
  }
}
