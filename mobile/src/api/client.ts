import { BACKEND_URL } from "../config/env";
import { CompletedTrip } from "../types";

function normalize(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  return url;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tamamlanmış yolculuk kaydını backend'e gönderir; başarıysa true.
 * Tip gereği yalnızca inişi bitmiş kayıt geçebilir — araçtaki (onboard) kayıt
 * gönderilemez, çünkü iniş bilgisi henüz yoktur.
 */
export async function postTrip(record: CompletedTrip): Promise<boolean> {
  try {
    // Yerel alanlar (localId, status, busPlate) sunucuya gitmez
    const { localId, status, busPlate, ...payload } = record;
    const res = await fetchWithTimeout(`${normalize(BACKEND_URL)}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Ayarlar ekranındaki bağlantı testi — adres .env'den gelir, arayüzde gösterilmez */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${normalize(BACKEND_URL)}/api/health`,
      {},
      4000
    );
    return res.ok;
  } catch {
    return false;
  }
}
