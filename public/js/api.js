/* Backend ile tek konuşma noktası.
 *
 * Oturum httpOnly çerezde taşınır (POST /auth/login basar) — token JS'te
 * tutulmaz, bu yüzden her istek `credentials: "same-origin"` ile gider.
 * 401 gelirse oturum bitmiştir: kullanıcı giriş ekranına düşer.
 */

const API = "/api/v1";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function onLoginPage() {
  const path = location.pathname;
  return path === "/" || path.endsWith("index.html");
}

async function request(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    ...options,
  });

  if (res.status === 401) {
    // Giriş ekranındayken yönlendirme yapılmaz: hatalı parola da 401 döner ve
    // kullanıcı formu görmeye devam etmeli
    if (!onLoginPage()) location.href = "/";
    throw new ApiError("E-posta veya şifre hatalı.", 401);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Backend Türkçe mesajı `detail` alanında döner (AppError handler);
    // şema doğrulama hatalarında ise detail bir listedir
    const detail = data && data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail.length
        ? detail[0].msg
        : "Beklenmeyen bir hata oluştu.";
    throw new ApiError(message, res.status);
  }

  return data;
}

const api = {
  register: (full_name, email, password, card_type = "normal") =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password, card_type }),
    }),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  me: () => request("/passengers/me"),
  cards: () => request("/cards"),
  lines: () => request("/transit/lines"),
  trips: (limit = 20) => request(`/trips?limit=${limit}`),
  activeTrip: () => request("/trips/active"),
  favorites: () => request("/favorites"),

  admin: {
    overview: () => request("/admin/analytics/overview"),
    lines: () => request("/admin/analytics/lines"),
    stops: () => request("/admin/analytics/stops"),
    pairs: () => request("/admin/analytics/pairs"),
    cardTypes: () => request("/admin/analytics/card-types"),
    daily: () => request("/admin/analytics/daily"),
    recentTrips: (limit = 20) => request(`/admin/trips?limit=${limit}`),
  },
};
