/* Akbil İzleme Merkezi — canlı grafikler
   Renkler dataviz doğrulayıcısından geçmiş palet: #2456a6 / #c47a00 */

const BLUE = "#2456a6";
const AMBER = "#c47a00";
const GRID = "#e3e7f0";
const INK2 = "#5a6478";

// Yeni kayıtlar SSE ile anında gelir; polling yalnızca yedek güvenlik ağıdır
const REFRESH_MS = 15000;
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);

Chart.defaults.font.family =
  '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
Chart.defaults.color = INK2;

const recessiveScales = {
  x: { grid: { display: false }, border: { color: GRID } },
  y: {
    beginAtZero: true,
    ticks: { precision: 0 },
    grid: { color: GRID },
    border: { display: false },
  },
};

const hourlyChart = new Chart(document.getElementById("hourlyChart"), {
  type: "bar",
  data: {
    labels: HOUR_LABELS,
    datasets: [
      {
        label: "Biniş",
        data: new Array(24).fill(0),
        backgroundColor: BLUE,
        borderRadius: 4,
        categoryPercentage: 0.72,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Saat ${items[0].label}:00`,
          label: (item) => ` ${item.parsed.y} biniş`,
        },
      },
    },
    scales: recessiveScales,
  },
});

function horizontalBar(canvasId, tooltipUnit) {
  return new Chart(document.getElementById(canvasId), {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: tooltipUnit,
          data: [],
          backgroundColor: BLUE,
          borderRadius: 4,
          categoryPercentage: 0.68,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (item) => ` ${item.parsed.x} ${tooltipUnit}` },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: GRID },
          border: { display: false },
        },
        y: { grid: { display: false }, border: { color: GRID } },
      },
    },
  });
}

const linesChart = horizontalBar("linesChart", "yolculuk");
const stopsChart = horizontalBar("stopsChart", "kullanım");

const cardTypeChart = new Chart(document.getElementById("cardTypeChart"), {
  type: "doughnut",
  data: {
    labels: ["Tam", "Öğrenci"],
    datasets: [
      {
        data: [0, 0],
        backgroundColor: [BLUE, AMBER],
        borderColor: "#ffffff",
        borderWidth: 2, // dilimler arası 2px yüzey boşluğu
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "right",
        labels: { usePointStyle: true, pointStyleWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (item) => {
            const total = item.dataset.data.reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((item.parsed / total) * 100);
            return ` ${item.parsed} basış (%${pct})`;
          },
        },
      },
    },
  },
});

const fmtTL = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function hhmm(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function updateStats(stats) {
  document.getElementById("tileTrips").textContent = stats.totalTrips;
  document.getElementById("tileRevenue").textContent = fmtTL.format(
    stats.revenue
  );
  document.getElementById("tileDuration").textContent =
    stats.avgDurationMin + " dk";

  const max = Math.max(...stats.hourly);
  document.getElementById("tileBusyHour").textContent =
    max > 0 ? `${String(stats.hourly.indexOf(max)).padStart(2, "0")}:00` : "—";

  hourlyChart.data.datasets[0].data = stats.hourly;
  hourlyChart.update("none");

  linesChart.data.labels = stats.lines.map((l) => l.line);
  linesChart.data.datasets[0].data = stats.lines.map((l) => l.count);
  linesChart.update("none");

  stopsChart.data.labels = stats.topStops.map((s) => s.stop);
  stopsChart.data.datasets[0].data = stats.topStops.map((s) => s.count);
  stopsChart.update("none");

  cardTypeChart.data.datasets[0].data = [
    stats.byCardType.tam,
    stats.byCardType.ogrenci,
  ];
  cardTypeChart.update("none");

  renderTypeSummary(stats);
}

function renderTypeSummary(stats) {
  const total = stats.byCardType.tam + stats.byCardType.ogrenci;
  const rev = stats.revenueByCardType || { tam: 0, ogrenci: 0 };
  const rows = [
    { key: "tam", name: "Tam", count: stats.byCardType.tam, revenue: rev.tam },
    {
      key: "ogrenci",
      name: "Öğrenci",
      count: stats.byCardType.ogrenci,
      revenue: rev.ogrenci,
    },
  ];
  document.getElementById("typeSummary").innerHTML = rows
    .map((r) => {
      const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
      return `
      <div class="type-row">
        <div class="type-head">
          <span class="type-dot ${r.key}" aria-hidden="true"></span>
          <span class="type-name">${r.name}</span>
          <span class="type-nums"><strong>${r.count}</strong> basış · ${fmtTL.format(
            r.revenue
          )} · %${pct}</span>
        </div>
        <div class="type-bar"><div class="type-bar-fill ${r.key}" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");
}

function maskCard(cardNo) {
  const digits = String(cardNo).replace(/\s/g, "");
  return "•••• " + digits.slice(-4);
}

// Kayıtlar mobilden (dış kaynak) geldiği için HTML'e basmadan önce kaçır
function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateTable(trips) {
  const body = document.getElementById("tripBody");
  const empty = document.getElementById("emptyState");
  empty.style.display = trips.length === 0 ? "block" : "none";

  body.innerHTML = trips
    .map(
      (t) => `
      <tr>
        <td class="time-cell">${hhmm(t.boardTime)} – ${hhmm(t.alightTime)}</td>
        <td><span class="line-badge">${esc(t.line)}</span></td>
        <td class="route-cell">${esc(t.boardingStop)}<span class="arrow">→</span>${esc(t.alightingStop)}</td>
        <td><span class="card-chip ${t.cardType === "tam" ? "tam" : "ogrenci"}">${
          t.cardType === "tam" ? "Tam" : "Öğrenci"
        }</span> <span title="Kart no">${esc(maskCard(t.cardNo))}</span></td>
        <td class="fare-cell">${fmtTL.format(t.fare)}</td>
      </tr>`
    )
    .join("");
}

async function refresh() {
  try {
    const [statsRes, tripsRes] = await Promise.all([
      fetch("/api/stats"),
      fetch("/api/trips?limit=12"),
    ]);
    updateStats(await statsRes.json());
    updateTable(await tripsRes.json());
  } catch (err) {
    // Sunucu geçici olarak ulaşılamazsa bir sonraki turda tekrar dene
    console.warn("Veri alınamadı:", err.message);
  }
}

function tickClock() {
  const now = new Date();
  document.getElementById("clock").textContent = `${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

document.getElementById("clearBtn").addEventListener("click", async () => {
  if (!confirm("Tüm yolculuk kayıtları silinsin mi?")) return;
  await fetch("/api/trips", { method: "DELETE" });
  refresh();
});

// Canlı akış: mobilden iniş kaydı düştüğü anda panel yenilenir
const liveBadge = document.getElementById("liveBadge");
const liveText = document.getElementById("liveText");

function setLive(on) {
  liveBadge.classList.toggle("offline", !on);
  liveText.textContent = on ? "Canlı" : "Bağlanıyor…";
}

const events = new EventSource("/api/events");
// Kopukluk sonrası yeniden bağlanınca da tetiklenir; kaçan kayıtları toparlar
events.addEventListener("open", () => {
  setLive(true);
  refresh();
});
events.addEventListener("error", () => setLive(false));
events.addEventListener("trip", refresh);
events.addEventListener("reset", refresh);

tickClock();
setInterval(tickClock, 15000);
refresh();
setInterval(refresh, REFRESH_MS);
