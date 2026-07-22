// Demo veri üretici: dashboard'u boş ekranda test etmemek için
// rastgele ama gerçekçi yolculuk kayıtları POST eder.
// Kullanım: backend çalışırken `npm run seed`

const BASE = process.env.API_URL || "http://localhost:4000";

const LINES = [
  {
    name: "448 Arnavutköy – Mecidiyeköy",
    stops: [
      "Arnavutköy Meydan",
      "Fatih Caddesi",
      "Taşoluk",
      "Haraççı",
      "Hadımköy Sanayi",
      "Mecidiyeköy",
    ],
  },
  {
    name: "H-1 Haraççı – Arnavutköy Merkez",
    stops: [
      "Haraççı Merkez",
      "Adnan Menderes Bulvarı",
      "Devlet Hastanesi",
      "Arnavutköy Meydan",
    ],
  },
  {
    name: "AR-2 Taşoluk – Devlet Hastanesi",
    stops: [
      "Taşoluk Konutları",
      "Taşoluk Merkez",
      "Yavuz Selim Caddesi",
      "Belediye",
      "Devlet Hastanesi",
    ],
  },
  {
    name: "AR-3 Hadımköy – Arnavutköy",
    stops: [
      "Hadımköy Sanayi",
      "Ömerli",
      "Deliklikaya",
      "Arnavutköy Meydan",
    ],
  },
];


function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// Sabah (07-09) ve akşam (17-19) yoğunluğu ağırlıklı saat seçimi
function busyHour() {
  const roll = Math.random();
  if (roll < 0.35) return randInt(7, 9);
  if (roll < 0.65) return randInt(17, 19);
  return randInt(6, 23);
}

function makeTrip() {
  const line = pick(LINES);
  const boardIdx = randInt(0, line.stops.length - 2);
  const alightIdx = randInt(boardIdx + 1, line.stops.length - 1);
  const cardType = Math.random() < 0.6 ? "tam" : "ogrenci";
  const durationMin = (alightIdx - boardIdx) * randInt(4, 8);

  const board = new Date();
  board.setHours(busyHour(), randInt(0, 59), 0, 0);
  const alight = new Date(board.getTime() + durationMin * 60000);

  return {
    cardNo: `${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
    cardType,
    line: line.name,
    boardingStop: line.stops[boardIdx],
    alightingStop: line.stops[alightIdx],
    boardTime: board.toISOString(),
    alightTime: alight.toISOString(),
    durationMin,
  };
}

async function main() {
  const count = Number(process.argv[2]) || 60;
  let ok = 0;
  for (let i = 0; i < count; i++) {
    const res = await fetch(`${BASE}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeTrip()),
    });
    if (res.ok) ok++;
    else console.error("Hata:", res.status, await res.text());
  }
  console.log(`${ok}/${count} demo yolculuk gönderildi -> ${BASE}`);
}

main().catch((err) => {
  console.error("Backend'e ulaşılamadı:", err.message);
  process.exit(1);
});
