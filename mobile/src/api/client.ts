import { TripRecord } from "../types";

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

/** Yolculuk kaydını backend'e gönderir; başarıysa true */
export async function postTrip(
  baseUrl: string,
  record: TripRecord
): Promise<boolean> {
  try {
    // NFC'den okunan güncel bakiye "balance" adıyla gider
    const { localId, status, balanceAfter, ...payload } = record;
    const body =
      balanceAfter === undefined
        ? payload
        : { ...payload, balance: balanceAfter };
    const res = await fetchWithTimeout(`${normalize(baseUrl)}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Ayarlar ekranındaki bağlantı testi */
export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${normalize(baseUrl)}/api/health`,
      {},
      4000
    );
    return res.ok;
  } catch {
    return false;
  }
}
