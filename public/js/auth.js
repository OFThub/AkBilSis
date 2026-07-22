/* Oturum ve üst bant.
 *
 * "Yönetim" bağlantısı yalnızca is_admin doğruysa basılır. Bu sadece görsel
 * bir kolaylıktır — asıl koruma sunucudadır: /admin sayfası çerezi doğrular,
 * /api/v1/admin/* uçları get_current_admin ile 403 döner.
 */

/** Giriş yapmış kullanıcıyı getirir; oturum yoksa giriş ekranına yollar. */
async function requireSession() {
  try {
    return await api.me();
  } catch (err) {
    location.href = "/";
    throw err;
  }
}

/** Üst banttaki kullanıcı bloğunu kurar. */
function renderSession(passenger) {
  const nameEl = document.getElementById("sessionName");
  if (nameEl) nameEl.textContent = passenger.full_name;

  const adminLink = document.getElementById("adminLink");
  if (adminLink && passenger.is_admin) adminLink.hidden = false;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await api.logout();
      } finally {
        location.href = "/";
      }
    });
  }
}

/** Sayfa iskeletini oturumla birlikte hazırlar. */
async function initPage() {
  const passenger = await requireSession();
  renderSession(passenger);
  startClock();
  return passenger;
}

function startClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  };
  tick();
  setInterval(tick, 30000);
}
