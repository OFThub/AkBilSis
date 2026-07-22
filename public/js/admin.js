/* Yönetim paneli.
 *
 * Tüm veriler mobil uygulamadan gelen gerçek yolculuk kayıtlarından hesaplanır.
 * Renk kararı (`load_level`) sunucudan gelir; burada yalnızca boyanır ve
 * yanına metin etiketi konur — renk tek başına anlam taşımaz.
 */

const REFRESH_MS = 15000;
const CARD_TYPE_LABELS = { normal: "Tam", student: "Öğrenci", senior: "65+" };

let charts = {};

function renderOverview(overview) {
  document.getElementById("tileTrips").textContent = overview.total_trips;
  document.getElementById("tileOnboard").textContent = overview.onboard_passengers;
  document.getElementById("tileBuses").textContent = overview.active_buses;
  document.getElementById("tileBusyHour").textContent =
    overview.busiest_hour === null ? "—" : hourRange(overview.busiest_hour);

  setHourly(charts.hourly, overview.hourly);
}

/** Hat kartı: zirve saat, araç başına yük ve sefer önerisi */
function renderLines(lines) {
  const holder = document.getElementById("lineCards");
  const empty = document.getElementById("lineEmpty");
  holder.replaceChildren();

  const withData = lines.filter((line) => line.total_trips > 0);
  if (!withData.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const line of withData) {
    const card = document.createElement("article");
    card.className = `load-card is-${line.load_level}`;

    const head = document.createElement("div");
    head.className = "load-card-head";

    const code = document.createElement("span");
    code.className = "line-badge";
    code.textContent = line.code;

    const name = document.createElement("span");
    name.className = "load-card-name";
    name.textContent = line.name.replace(`${line.code} `, "");

    const badge = document.createElement("span");
    badge.className = `load-badge is-${line.load_level}`;
    badge.textContent = LOAD_LABELS[line.load_level];

    head.append(code, name, badge);

    const stats = document.createElement("dl");
    stats.className = "load-stats";
    const rows = [
      ["Toplam yolculuk", String(line.total_trips)],
      ["En yoğun saat", line.peak_hour === null ? "—" : hourRange(line.peak_hour)],
      ["Zirvede biniş", String(line.peak_hour_trips)],
      ["Aktif otobüs", String(line.active_buses)],
      ["Araç başına", `${line.peak_per_bus} yolcu`],
    ];
    for (const [label, value] of rows) {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      wrap.append(dt, dd);
      stats.append(wrap);
    }

    const advice = document.createElement("p");
    advice.className = "load-advice";
    advice.textContent = line.recommendation;

    card.append(head, stats, advice);
    holder.append(card);
  }
}

function renderStops(stops) {
  const top = stops.slice(0, 8);
  charts.stops.data.labels = top.map((s) => s.name);
  charts.stops.data.datasets[0].data = top.map((s) => s.total);
  charts.stops.data.datasets[0].backgroundColor = top.map(
    (s) => LOAD_COLORS[s.load_level]
  );
  charts.stops.update();

  // Grafik rengi tek başına yeterli değil — sıkıntılı duraklar yazıyla da verilir
  const legend = document.getElementById("stopLegend");
  legend.replaceChildren();
  const busy = top.filter((s) => s.load_level === "high");
  if (busy.length) {
    const note = document.createElement("p");
    note.className = "load-note is-high";
    note.textContent = `Sıkışık duraklar: ${busy
      .map((s) => `${s.name} (${s.total})`)
      .join(", ")}`;
    legend.append(note);
  }
}

function renderPairs(pairs) {
  const body = document.getElementById("pairBody");
  const empty = document.getElementById("pairEmpty");
  body.replaceChildren();

  if (!pairs.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const pair of pairs) {
    const row = document.createElement("tr");
    for (const value of [pair.board_stop, pair.alight_stop, String(pair.count)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    row.lastChild.className = "fare-cell";
    body.append(row);
  }
}

function renderCardTypes(shares) {
  const used = shares.filter((s) => s.count > 0);
  charts.cardTypes.data.labels = used.map((s) => s.label);
  charts.cardTypes.data.datasets[0].data = used.map((s) => s.count);
  charts.cardTypes.update();
}

function renderRecent(trips) {
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

    const passenger = document.createElement("td");
    passenger.textContent = trip.passenger_name || "—";

    const line = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "line-badge";
    badge.textContent = trip.line_code;
    line.append(badge);

    const route = document.createElement("td");
    route.className = "route-cell";
    if (trip.alight_stop) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";
      route.append(trip.board_stop, arrow, trip.alight_stop);
    } else {
      route.textContent = `${trip.board_stop} · yolculuk sürüyor`;
    }

    const duration = document.createElement("td");
    duration.className = "fare-cell";
    duration.textContent = trip.duration_min ? `${trip.duration_min} dk` : "—";

    const card = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = `card-chip ${trip.card_type === "student" ? "ogrenci" : "tam"}`;
    chip.textContent = CARD_TYPE_LABELS[trip.card_type] || trip.card_type;
    card.append(chip);

    row.append(time, passenger, line, route, duration, card);
    body.append(row);
  }
}

async function refresh() {
  const [overview, lines, stops, pairs, cardTypes, recent] = await Promise.all([
    api.admin.overview(),
    api.admin.lines(),
    api.admin.stops(),
    api.admin.pairs(),
    api.admin.cardTypes(),
    api.admin.recentTrips(20),
  ]);

  renderOverview(overview);
  renderLines(lines);
  renderStops(stops);
  renderPairs(pairs);
  renderCardTypes(cardTypes);
  renderRecent(recent);

  document.getElementById("refreshedAt").textContent =
    `Son güncelleme ${hhmm(new Date().toISOString())}`;
}

async function main() {
  await initPage();

  charts = {
    hourly: hourlyChart(document.getElementById("hourlyChart")),
    stops: horizontalBar(document.getElementById("stopsChart"), "kullanım"),
    cardTypes: donutChart(document.getElementById("cardTypeChart")),
  };

  await refresh();
  // Yenileme hatası döngüyü durdurmasın: ağ kesilse de bir sonraki tur dener
  setInterval(
    () => refresh().catch((err) => console.error("Yenilenemedi:", err)),
    REFRESH_MS
  );
}

main().catch((err) => console.error("Yönetim paneli yüklenemedi:", err));
