// Para birimi biçimlendirici yoktur — uygulamada ücret kavramı kaldırıldı.

import { TranslationKey } from "../i18n";
import { CardType } from "../types";

export function hhmm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Tepe saat etiketi — 8 → "08:00–09:00" */
export function hourRange(hour: number): string {
  const pad = (h: number) => String(h).padStart(2, "0");
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}

/** İki damga arası dakika — sunucu süreyi göndermez, uçlardan hesaplanır */
export function durationMinutes(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
  );
}

/**
 * Kart numarası saklanmaz; kimliğin son 8 hanesi okunaklı biçimde gösterilir.
 * Fiziksel kartta NFC kimliği varsa o kullanılır.
 */
export function cardLabel(id: string, nfcUid: string | null): string {
  const raw = (nfcUid || id.replace(/-/g, "")).toUpperCase();
  const tail = raw.slice(-8);
  return `${tail.slice(0, 4)} ${tail.slice(4)}`;
}

/** Kart tipinin çeviri anahtarı — etiketler i18n sözlüğünde durur */
export function cardTypeKey(cardType: CardType): TranslationKey {
  if (cardType === "student") return "cardTypeStudent";
  if (cardType === "senior") return "cardTypeSenior";
  return "cardTypeNormal";
}
