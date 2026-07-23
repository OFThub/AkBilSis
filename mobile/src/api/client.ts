/**
 * Backend istemcisi — sunucuyla tek konuşma noktası.
 *
 * Erişim token'ı kısa ömürlüdür. 401 alındığında yenileme token'ıyla bir kez
 * tazelenip istek tekrarlanır; o da başarısızsa oturum düşer ve uygulama giriş
 * ekranına döner (`onSessionExpired`).
 */

import { BACKEND_URL } from "../config/env";
import {
  Card,
  CardType,
  Direction,
  Favorite,
  Line,
  LineDetail,
  LiveBus,
  Passenger,
  Trip,
  ValidateResult,
} from "../types";

const API_PREFIX = "/api/v1";

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

/** Sunucunun Türkçe hata mesajını taşıyan hata tipi */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function normalize(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = "http://" + url;
  return url;
}

const BASE = normalize(BACKEND_URL) + API_PREFIX;

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;

/** AuthContext açılışta ve girişte token'ları buraya verir */
export function setTokens(next: Tokens | null): void {
  tokens = next;
}

export function getTokens(): Tokens | null {
  return tokens;
}

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  const detail = (data as any)?.detail;
  if (typeof detail === "string") return detail;
  // Şema doğrulama hataları dizi olarak gelir
  if (Array.isArray(detail) && detail.length) {
    return detail[0]?.msg ?? "Geçersiz istek.";
  }
  return "Sunucuya ulaşılamadı.";
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (tokens) headers.Authorization = `Bearer ${tokens.access_token}`;

  try {
    return await fetchWithTimeout(BASE + path, { ...options, headers });
  } catch {
    throw new ApiError(
      "Sunucuya ulaşılamadı. Ağ bağlantınızı ve sunucu adresini kontrol edin.",
      0
    );
  }
}

/** Erişim token'ını yenileme token'ıyla tazeler; başarısızsa false döner */
async function refreshSession(): Promise<boolean> {
  if (!tokens) return false;
  try {
    const res = await fetchWithTimeout(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
    if (!res.ok) return false;
    tokens = (await res.json()) as Tokens;
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await send(path, options);

  // Erişim token'ının süresi dolduysa bir kez tazeleyip tekrar dene
  if (res.status === 401 && tokens) {
    if (await refreshSession()) {
      res = await send(path, options);
    }
    if (res.status === 401) {
      tokens = null;
      onSessionExpired?.();
      throw new ApiError("Oturumunuz sona erdi, tekrar giriş yapın.", 401);
    }
  }

  if (res.status === 204) return null as T;
  if (!res.ok) throw new ApiError(await readError(res), res.status);

  return (await res.json()) as T;
}

export const api = {
  // ── Kimlik ──────────────────────────────────────────────────────────────
  register: (
    full_name: string,
    email: string,
    password: string,
    card_type: CardType = "normal"
  ) =>
    request<Passenger>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password, card_type }),
    }),

  login: (email: string, password: string) =>
    request<Tokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<Passenger>("/passengers/me"),

  // ── Kart ────────────────────────────────────────────────────────────────
  cards: () => request<Card[]>("/cards"),

  // ── Hat ve araçlar ──────────────────────────────────────────────────────
  lines: () => request<Line[]>("/transit/lines"),
  lineDetail: (lineId: string, direction: Direction = "forward") =>
    request<LineDetail>(`/transit/lines/${lineId}?direction=${direction}`),
  liveBuses: (lineId: string) => request<LiveBus[]>(`/transit/lines/${lineId}/buses`),

  // ── Favoriler ───────────────────────────────────────────────────────────
  favorites: () => request<Favorite[]>("/favorites"),
  addFavorite: (line_id: string) =>
    request<Favorite>("/favorites", {
      method: "POST",
      body: JSON.stringify({ line_id }),
    }),
  removeFavorite: (lineId: string) =>
    request<null>(`/favorites/${lineId}`, { method: "DELETE" }),

  // ── Yolculuk ────────────────────────────────────────────────────────────
  trips: (limit = 50) => request<Trip[]>(`/trips?limit=${limit}`),
  activeTrip: () => request<Trip | null>("/trips/active"),

  /** Kart bas: açık yolculuk yoksa biniş, varsa iniş. Durağı sunucu belirler. */
  validate: (bus_id: string) =>
    request<ValidateResult>("/validate", {
      method: "POST",
      body: JSON.stringify({ bus_id }),
    }),
};
