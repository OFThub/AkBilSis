const express = require("express");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// Şimdilik veritabanı yok: tüm kayıtlar bellekte tutulur (ileride DB eklenecek).
const trips = [];
let nextId = 1;

// SSE: panel tarayıcıları buradan dinler; yeni kayıt anında push edilir.
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(msg);
}

// Ara katmanların (proxy vb.) boşta kalan bağlantıyı kapatmaması için nabız
setInterval(() => {
  for (const client of sseClients) client.write(": hb\n\n");
}, 30000).unref();

app.use(express.json());

// Mobil uygulama farklı origin'den istek atar (Expo) — CORS'a izin ver.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

const REQUIRED_FIELDS = [
  "cardNo",
  "cardType",
  "line",
  "boardingStop",
  "alightingStop",
  "boardTime",
  "alightTime",
  "durationMin",
];

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "akbil-backend", trips: trips.length });
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 3000\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

app.post("/api/trips", (req, res) => {
  const body = req.body || {};
  const missing = REQUIRED_FIELDS.filter(
    (f) => body[f] === undefined || body[f] === null || body[f] === ""
  );
  if (missing.length > 0) {
    return res
      .status(400)
      .json({ error: "Eksik alanlar: " + missing.join(", ") });
  }
  if (body.cardType !== "tam" && body.cardType !== "ogrenci") {
    return res
      .status(400)
      .json({ error: "cardType 'tam' veya 'ogrenci' olmalı" });
  }

  const trip = {
    id: nextId++,
    cardNo: String(body.cardNo),
    cardType: body.cardType,
    line: String(body.line),
    boardingStop: String(body.boardingStop),
    alightingStop: String(body.alightingStop),
    boardTime: body.boardTime,
    alightTime: body.alightTime,
    durationMin: Number(body.durationMin),
    receivedAt: new Date().toISOString(),
  };
  trips.push(trip);
  broadcast("trip", trip);
  res.status(201).json(trip);
});

app.get("/api/trips", (req, res) => {
  const limit = Number(req.query.limit) || trips.length;
  // "Son yolculuklar" = sunucuya en son ulaşan kayıtlar; id geliş sırasını verir.
  // boardTime'a göre sıralamak, gün geneline yayılmış seed verisinin taze
  // mobil kayıtları ilk 12'nin dışına itmesine yol açıyordu.
  const sorted = [...trips].sort((a, b) => b.id - a.id);
  res.json(sorted.slice(0, limit));
});

// Demo verisini sıfırlamak için
app.delete("/api/trips", (req, res) => {
  trips.length = 0;
  broadcast("reset", { trips: 0 });
  res.json({ ok: true, trips: 0 });
});

app.get("/api/stats", (req, res) => {
  const hourly = Array.from({ length: 24 }, () => 0);
  const byLine = {};
  const byStop = {};
  const byCardType = { tam: 0, ogrenci: 0 };
  let totalDuration = 0;

  for (const t of trips) {
    const hour = new Date(t.boardTime).getHours();
    if (!Number.isNaN(hour)) hourly[hour]++;
    byLine[t.line] = (byLine[t.line] || 0) + 1;
    // Durak kullanımı = biniş + iniş toplamı
    byStop[t.boardingStop] = (byStop[t.boardingStop] || 0) + 1;
    byStop[t.alightingStop] = (byStop[t.alightingStop] || 0) + 1;
    if (byCardType[t.cardType] !== undefined) byCardType[t.cardType]++;
    totalDuration += t.durationMin;
  }

  const topStops = Object.entries(byStop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([stop, count]) => ({ stop, count }));

  const lines = Object.entries(byLine)
    .sort((a, b) => b[1] - a[1])
    .map(([line, count]) => ({ line, count }));

  res.json({
    totalTrips: trips.length,
    avgDurationMin:
      trips.length > 0 ? Math.round(totalDuration / trips.length) : 0,
    hourly,
    lines,
    topStops,
    byCardType,
  });
});

function lanAddresses() {
  const result = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === "IPv4" && !iface.internal) result.push(iface.address);
    }
  }
  return result;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log("Akbil İzleme Merkezi çalışıyor:");
  console.log(`  Panel     : http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(
      `  Ağ (mobil): http://${ip}:${PORT}  <- mobil uygulamanın Ayarlar ekranına bu adresi girin`
    );
  }
});
