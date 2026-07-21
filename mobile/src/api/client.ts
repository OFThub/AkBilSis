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
    const { localId, status, ...payload } = record;
    const res = await fetchWithTimeout(`${normalize(baseUrl)}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
