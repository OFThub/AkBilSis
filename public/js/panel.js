/* Yolcu paneli: kart bilgileri, aktif yolculuk, geçmiş ve hat yoğunlukları.
 *
 * Hat yoğunluğu `Line.hourly_profile` alanından gelir — bu, hattın beklenen
 * gün içi profilidir. Gerçek yolculuk sayıları yönetim panelinde ayrı durur;
 * ikisi bilinçli olarak karıştırılmaz.
 */

const CARD_TYPE_LABELS = { normal: "TAM", student: "ÖĞRENCİ", senior: "65+" };
const TRIP_STATUS_LABELS = {
  open: "Otobüste",
  completed: "Tamamlandı",
  abandoned: "Yarıda kaldı",
};

let hourlyChartInstance = null;
let lines = [];

/** Kart numarası saklanmaz; kimliğin son 8 hanesi okunaklı biçimde gösterilir */
function cardLabel(card) {
  const raw = (card.nfc_uid || card.id.replace(/-/g, "")).toUpperCase();
  const tail = raw.slice(-8);
  return `${tail.slice(0, 4)} ${tail.slice(4)}`;
}

function renderCard(passenger, cards, tripCount) {
  const card = cards[0];
  document.getElementById("cardHolder").textContent = passenger.full_name;
  document.getElementById("cardTripCount").textContent = tripCount;
  document.getElementById("infoName").textContent = passenger.full_name;
  document.getElementById("infoEmail").textContent = passenger.email;

  if (!card) {
    document.getElementById("cardNumber").textContent = "Kart yok";
    document.getElementById("infoCardState").textContent = "Tanımlı kart yok";
    return;
  }

  const badge = document.getElementById("cardTypeBadge");
  badge.textContent = CARD_TYPE_LABELS[card.card_type] || card.card_type;
  badge.classList.toggle("is-student", card.card_type === "student");

  document.getElementById("cardNumber").textContent = cardLabel(card);
  document.getElementById("infoCardState").textContent = card.is_active
    ? "Aktif"
    : "Pasif — belediyeye başvurun";
}

function renderActiveTrip(trip) {
  const box = document.getElementById("activeTrip");
  if (!trip) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  document.getElementById("activeTripLine").textContent = trip.line.name;
  document.getElementById("activeTripDetail").textContent =
    `${trip.board_stop.name} durağından ${hhmm(trip.boarded_at)}'de bindiniz.`;
}

function renderTrips(trips) {
  const body = document.getElementById("tripBody");
  const empty = document.getElementById("tripEmpty");
  body.replaceChildren();

  if (!trips.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const trip of trips) {
    const row = document.createElement("tr");

    const time = document.createElement("td");
    time.className = "time-cell";
    time.textContent = `${hhmm(trip.boarded_at)} – ${
      trip.alighted_at ? hhmm(trip.alighted_at) : "…"
    }`;

    const line = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "line-badge";
    badge.textContent = trip.line.code;
    line.append(badge);

    const route = document.createElement("td");
    route.className = "route-cell";
    if (trip.alight_stop) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";
      route.append(trip.board_stop.name, arrow, trip.alight_stop.name);
    } else {
      route.textContent = `${trip.board_stop.name} durağından bindi`;
    }

    const duration = document.createElement("td");
    duration.className = "fare-cell";
    duration.textContent = trip.alighted_at
      ? `${Math.max(
          1,
          Math.round((new Date(trip.alighted_at) - new Date(trip.boarded_at)) / 60000)
        )} dk`
      : "—";

    const status = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = `state-chip is-${trip.status}`;
    chip.textContent = TRIP_STATUS_LABELS[trip.status] || trip.status;
    status.append(chip);

    row.append(time, line, route, duration, status);
    body.append(row);
  }
}

function selectLine(lineId) {
  const line = lines.find((item) => item.id === lineId);
  if (!line) return;

  for (const chip of document.querySelectorAll(".line-chip")) {
    const active = chip.dataset.id === lineId;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", String(active));
  }

  const peaks = line.peak_hours || [];
  document.getElementById("linePeaks").textContent = peaks.length
    ? `${line.name} — en yoğun saatler: ${peaks.map(hourRange).join(" · ")}`
    : `${line.name} — bu hat için yoğunluk profili tanımlı değil.`;

  setHourlyRaw(hourlyChartInstance, line.hourly_profile);
}

function renderLineChips(favoriteIds) {
  const holder = document.getElementById("lineChips");
  holder.replaceChildren();

  for (const line of lines) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "line-chip";
    chip.dataset.id = line.id;
    chip.setAttribute("aria-pressed", "false");

    const code = document.createElement("span");
    code.className = "line-chip-code";
    code.textContent = line.code;

    const name = document.createElement("span");
    name.textContent = line.name.replace(`${line.code} `, "");

    chip.append(code, name);
    if (favoriteIds.has(line.id)) {
      const star = document.createElement("span");
      star.className = "line-chip-star";
      star.textContent = "★";
      star.title = "Favori hattınız";
      chip.append(star);
    }

    chip.addEventListener("click", () => selectLine(line.id));
    holder.append(chip);
  }
}

async function main() {
  const passenger = await initPage();

  hourlyChartInstance = hourlyChart(document.getElementById("lineHourlyChart"), {
    label: "Yoğunluk",
    unit: "yoğunluk",
  });

  // Bağımsız çağrılar paralel gider — sayfa tek turda dolsun
  const [cards, trips, activeTrip, allLines, favorites] = await Promise.all([
    api.cards(),
    api.trips(20),
    api.activeTrip(),
    api.lines(),
    api.favorites(),
  ]);

  lines = allLines;
  const favoriteIds = new Set(favorites.map((f) => f.line_id));

  renderCard(passenger, cards, trips.length);
  renderActiveTrip(activeTrip);
  renderTrips(trips);

  document.getElementById("infoFavorites").textContent = favorites.length
    ? favorites.map((f) => f.line.code).join(", ")
    : "Henüz favori hat yok (mobil uygulamadan ekleyebilirsiniz)";

  renderLineChips(favoriteIds);
  if (lines.length) {
    // Favori varsa onunla açılır — kullanıcının ilgilendiği hat öne gelsin
    const first = lines.find((l) => favoriteIds.has(l.id)) || lines[0];
    selectLine(first.id);
  }
}

main().catch((err) => console.error("Panel yüklenemedi:", err));
