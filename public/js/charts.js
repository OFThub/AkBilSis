/* Chart.js ortak ayarları ve yoğunluk renk ölçeği.
 *
 * Renk kararı sunucuda verilir (`load_level`: low | normal | high) — burada
 * yalnızca renge çevrilir. Eşikler backend/app/services.py içindedir.
 */

const BLUE = "#2456a6";
const AMBER = "#c47a00";
const GRID = "#e3e7f0";
const INK2 = "#5a6478";

/* Yoğunluk ölçeği: yeşil = rahat, kırmızı = sıkışık.
   Renk tek başına anlam taşımasın diye her yerde metin etiketiyle birlikte
   kullanılır — renk körlüğü olan yönetici de okuyabilmeli. */
const LOAD_COLORS = {
  low: "#1d7a4f",
  normal: "#c47a00",
  high: "#b3362c",
};

const LOAD_LABELS = {
  low: "Düşük yoğunluk",
  normal: "Normal",
  high: "Yüksek yoğunluk",
};

if (window.Chart) {
  Chart.defaults.font.family =
    '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
  Chart.defaults.color = INK2;
  Chart.defaults.animation.duration = 400;
}

/** Eksenler geri planda kalsın — veri öne çıksın */
const recessiveScales = {
  x: { grid: { display: false }, border: { color: GRID } },
  y: {
    beginAtZero: true,
    ticks: { precision: 0 },
    grid: { color: GRID },
    border: { display: false },
  },
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);

/** Saat başına yoğunluk — yolcu panelinde de yönetimde de aynı biçim */
function hourlyChart(canvas, options = {}) {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: HOUR_LABELS,
      datasets: [
        {
          label: options.label || "Biniş",
          data: new Array(24).fill(0),
          backgroundColor: BLUE,
          borderRadius: 4,
          categoryPercentage: 0.74,
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
            label: (item) => ` ${item.parsed.y} ${options.unit || "biniş"}`,
          },
        },
      },
      scales: recessiveScales,
    },
  });
}

/** Günlük trend — talebin dönem içinde artıp azaldığını gösterir */
function dailyTrendChart(canvas) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Biniş",
          data: [],
          borderColor: BLUE,
          backgroundColor: "rgba(36, 86, 166, 0.14)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => ` ${item.parsed.y} biniş` } },
      },
      scales: recessiveScales,
    },
  });
}

/** Gün etiketi: 2026-07-23 -> 23 Tem */
const TR_MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
function dayLabel(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${TR_MONTHS[m - 1]}`;
}

function setDailyTrend(chart, days) {
  chart.data.labels = days.map((row) => dayLabel(row.day));
  chart.data.datasets[0].data = days.map((row) => row.count);
  chart.update();
}

/** Yatay çubuk — durak ve hat adları uzun olduğu için etiketler yanda durur */
function horizontalBar(canvas, unit) {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => ` ${item.parsed.x} ${unit}` } },
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

function donutChart(canvas) {
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [BLUE, AMBER, "#3f9e6e"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { padding: 14, boxWidth: 12 } },
      },
    },
  });
}

/** 24 saatlik diziyi grafiğe basar; boş saatler sıfır olarak yer tutar */
function setHourly(chart, hourly) {
  const values = new Array(24).fill(0);
  for (const row of hourly || []) values[row.hour] = row.count;
  chart.data.datasets[0].data = values;
  chart.update();
}

/** Ham 24'lük sayı dizisi (Line.hourly_profile) için */
function setHourlyRaw(chart, values) {
  chart.data.datasets[0].data = (values && values.length === 24)
    ? values
    : new Array(24).fill(0);
  chart.update();
}

/** 8 → "08:00–09:00" */
function hourRange(hour) {
  const pad = (h) => String(h).padStart(2, "0");
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}

function hhmm(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
