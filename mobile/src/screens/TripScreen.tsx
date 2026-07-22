import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import {
  LiveBus,
  busLocationText,
  busesForLine,
  findBus,
  passengerCounts,
} from "../data/buses";
import { BusLine, LINES, findLine } from "../data/lines";
import { colors, radius } from "../theme";
import { hhmm } from "../utils/format";
import {
  Header,
  InfoBanner,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import IdentityGate from "../components/IdentityGate";
import { CardUser } from "../types";

type Notice = { tone: "info" | "error" | "success"; text: string } | null;

/**
 * Yolculuk akışı üç durumludur:
 *  1. Kimlik yok  → kullanıcı listeden seçilir, başka hiçbir şey gösterilmez.
 *  2. Kimlik var, araçta değil → hat ve yoldaki araçlar; biniş durağı seçilmez,
 *     seçilen aracın anlık konumundan gelir.
 *  3. Kimlik var, araçta → yalnızca "Otobüsten İn". Başka araca binmek için
 *     arayüzde yol yoktur.
 */
export default function TripScreen() {
  const app = useApp();

  const [user, setUser] = useState<CardUser | null>(null);
  const [selectedLineId, setSelectedLineId] = useState(LINES[0].id);
  const [notice, setNotice] = useState<Notice>(null);
  const [alighting, setAlighting] = useState(false);
  // Araç konumları saatten hesaplandığı için ekranı saniyede bir tazeleriz
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const trip = user ? app.activeTripFor(user.id) : undefined;
  const tripLine = trip ? findLine(trip.lineId) : undefined;
  const tripBus = trip ? findBus(trip.lineId, trip.busId, now) : undefined;
  const selectedLine = findLine(selectedLineId)!;
  const buses = useMemo(
    () => busesForLine(selectedLine, now),
    [selectedLine, now]
  );
  // Doluluk tahmini değil: o an araçta olan yolcuların sayısı
  const counts = useMemo(
    () => passengerCounts(app.activeTrips),
    [app.activeTrips]
  );

  // Bant sayfanın üstünde, düğmeler listenin altında kalabildiği için sonuç
  // mesajı gösterilirken en üste kaydırılır — aksi hâlde hata gözden kaçıyor
  function showNotice(next: Exclude<Notice, null>) {
    setNotice(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleBoard(bus: LiveBus) {
    if (!user) return;
    const result = app.board(user.id, selectedLine.id, bus.id);
    if (!result.ok) {
      showNotice({ tone: "error", text: result.error ?? "Biniş yapılamadı." });
      return;
    }
    showNotice({
      tone: "success",
      text: `${bus.plate} aracına bindiniz — ${selectedLine.name}. İyi yolculuklar!`,
    });
  }

  async function handleAlight() {
    if (!user || alighting) return;
    setAlighting(true);
    const result = await app.alight(user.id);
    setAlighting(false);
    if (!result.ok) {
      showNotice({ tone: "error", text: result.error ?? "İniş yapılamadı." });
      return;
    }
    const record = result.record!;
    const base = `${user.name}, ${record.alightingStop} durağında indi — ${record.durationMin} dk.`;
    showNotice(
      result.sent
        ? {
            tone: "success",
            text: `${base} Kayıt izleme merkezine gönderildi (${hhmm(
              record.boardTime
            )} – ${hhmm(record.alightTime)}).`,
          }
        : {
            tone: "info",
            text: `${base} Sunucuya ulaşılamadı — Geçmiş ekranından tekrar gönderebilirsiniz.`,
          }
    );
  }

  return (
    <View style={styles.root}>
      <Header
        title="Yolculuk"
        subtitle={user ? user.name : "Kullanıcı seçmeden hat seçilemez"}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {notice && <InfoBanner tone={notice.tone} text={notice.text} />}

        {!user && (
          <IdentityGate
            title="Önce kullanıcı seçin"
            hint="Kayıtlı kullanıcı listesinden kendinizi seçin. Hat ve araç listesi seçimden sonra açılır."
            onIdentified={(identified) => {
              setUser(identified);
              setNotice(null);
            }}
          />
        )}

        {user && (
          <IdentityStrip
            user={user}
            onRelease={() => {
              setUser(null);
              setNotice(null);
            }}
          />
        )}

        {/* ── ARAÇTA: yalnızca iniş ── */}
        {user && trip && tripLine && (
          <>
            <View style={styles.tripBanner}>
              <Text style={styles.tripBannerTitle}>Araçtasınız</Text>
              <Text style={styles.tripBannerLine}>{tripLine.name}</Text>
              <Text style={styles.tripBannerDetail}>
                {trip.busPlate} · Biniş:{" "}
                {tripLine.stops[trip.boardingStopIndex]} · {hhmm(trip.boardTime)}
              </Text>
              <Text style={styles.tripBannerNote}>
                {tripBus
                  ? `Şu an: ${busLocationText(tripBus, tripLine)}`
                  : "Araç konumu alınamıyor."}
              </Text>
              <Text style={styles.tripBannerNote}>
                Araçta {counts[trip.busId] ?? 1} yolcu var (siz dâhil).
              </Text>
            </View>

            <SectionCard>
              <SectionTitle>İniş</SectionTitle>
              <Text style={styles.alightInfo}>
                {tripBus?.atStop
                  ? "Otobüs durakta — şimdi inebilirsiniz. İneceğiniz durağı seçmenize gerek yok, kayda bu durak yazılır:"
                  : "Otobüs duraklar arasında. İnmek için bir sonraki durağa varmasını bekleyin:"}
              </Text>
              <Text style={styles.alightStop}>
                {tripBus
                  ? tripLine.stops[
                      tripBus.atStop ? tripBus.fromIndex : tripBus.toIndex
                    ]
                  : "—"}
              </Text>
              <PrimaryButton
                label={
                  alighting
                    ? "İniliyor…"
                    : tripBus?.atStop
                    ? "Otobüsten İn"
                    : "Durak bekleniyor…"
                }
                onPress={handleAlight}
                disabled={alighting || !tripBus?.atStop}
              />
              <Text style={styles.hint}>
                İnmeden başka bir araca binemezsiniz. Yolculuğunuz binerken
                Geçmiş'e "Otobüste" olarak yazıldı; inince tamamlanır. İnmezseniz
                otobüs son durağa varınca ({tripLine.stops[tripLine.stops.length - 1]})
                otomatik indirilirsiniz.
              </Text>
            </SectionCard>

            <SectionCard>
              <SectionTitle>{tripLine.code} hat şeması</SectionTitle>
              <StopRail
                line={tripLine}
                buses={tripBus ? [tripBus] : []}
                highlightIndex={trip.boardingStopIndex}
              />
            </SectionCard>
          </>
        )}

        {/* ── ARAÇTA DEĞİL: hat + yoldaki araçlar ── */}
        {user && !trip && (
          <>
            <SectionCard>
              <SectionTitle>Hat seçin</SectionTitle>
              <View style={styles.lineChips}>
                {LINES.map((line) => {
                  const active = line.id === selectedLineId;
                  return (
                    <Pressable
                      key={line.id}
                      onPress={() => setSelectedLineId(line.id)}
                      style={[styles.lineChip, active && styles.lineChipActive]}
                    >
                      <Text
                        style={[
                          styles.lineChipCode,
                          active && styles.lineChipCodeActive,
                        ]}
                      >
                        {line.code}
                      </Text>
                      <Text
                        style={[
                          styles.lineChipName,
                          active && styles.lineChipNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {line.name.replace(`${line.code} `, "")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>

            <SectionCard>
              <SectionTitle>Yoldaki otobüsler</SectionTitle>
              {buses.map((bus) => (
                <BusCard
                  key={bus.id}
                  bus={bus}
                  line={selectedLine}
                  passengers={counts[bus.id] ?? 0}
                  onBoard={() => handleBoard(bus)}
                />
              ))}
              <Text style={styles.hint}>
                Konumlar canlıdır. Yalnızca durakta bekleyen otobüse
                binebilirsiniz; biniş durağınız o duraktır, ayrıca durak
                seçmezsiniz.
              </Text>
            </SectionCard>

            <SectionCard>
              <SectionTitle>{selectedLine.code} hat şeması</SectionTitle>
              <StopRail line={selectedLine} buses={buses} />
            </SectionCard>

          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Doğrulanmış kimlik şeridi — kimin adına işlem yapıldığı hep görünür */
function IdentityStrip({
  user,
  onRelease,
}: {
  user: CardUser;
  onRelease: () => void;
}) {
  return (
    <View style={styles.identity}>
      <View style={{ flex: 1 }}>
        <Text style={styles.identityName}>{user.name}</Text>
        <Text style={styles.identityCard}>
          {user.cardNo} · {user.cardType === "tam" ? "Tam" : "Öğrenci"}
        </Text>
      </View>
      <Pressable
        onPress={onRelease}
        hitSlop={8}
        style={({ pressed }) => [styles.identityBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.identityBtnText}>Kimliği Bırak</Text>
      </Pressable>
    </View>
  );
}

/** Yoldaki tek araç — plaka, canlı konum, içindeki yolcu sayısı ve biniş düğmesi */
function BusCard({
  bus,
  line,
  passengers,
  onBoard,
}: {
  bus: LiveBus;
  line: BusLine;
  passengers: number;
  onBoard: () => void;
}) {
  // Doluluk, araçtaki açık yolculuk kayıtlarından gelir — tahmin yok
  const occStyle =
    passengers === 0
      ? styles.occLow
      : passengers < 3
      ? styles.occMid
      : styles.occHigh;
  const occTextStyle =
    passengers === 0
      ? styles.occTextLow
      : passengers < 3
      ? styles.occTextMid
      : styles.occTextHigh;

  return (
    <View style={[styles.busCard, !bus.atStop && styles.busCardIdle]}>
      <View style={styles.busTop}>
        <Text style={styles.busPlate}>🚌 {bus.plate}</Text>
        <View style={[styles.occChip, occStyle]}>
          <Text style={[styles.occText, occTextStyle]}>
            {passengers === 0 ? "Boş" : `${passengers} yolcu`}
          </Text>
        </View>
      </View>
      <Text style={styles.busWhere}>{busLocationText(bus, line)}</Text>
      {/* Biniş yalnızca araç durakta beklerken açıktır */}
      <PrimaryButton
        label={
          bus.layover
            ? "Sefer bekliyor"
            : bus.atStop
            ? "Bin"
            : `${bus.minutesToNext} dk sonra ${line.stops[bus.toIndex]}`
        }
        onPress={onBoard}
        disabled={!bus.atStop}
      />
    </View>
  );
}

/** Hat şeması: duraklar + araçların canlı konum işaretleri */
function StopRail({
  line,
  buses,
  highlightIndex,
}: {
  line: BusLine;
  buses: LiveBus[];
  highlightIndex?: number;
}) {
  return (
    <View>
      {line.stops.map((stop, idx) => {
        const atStop = buses.filter(
          (bus) => bus.atStop && bus.fromIndex === idx
        );
        // Duraktan ayrılmış, bir sonrakine gidiyor → iki durak arasına çizilir
        const onSegment = buses.filter(
          (bus) => !bus.atStop && !bus.layover && bus.fromIndex === idx
        );
        const isBoarding = highlightIndex === idx;
        return (
          <View key={stop}>
            <View style={styles.stopRow}>
              <View style={styles.stopRail}>
                <View
                  style={[
                    styles.railSegment,
                    idx === 0 && { backgroundColor: "transparent" },
                  ]}
                />
                <View
                  style={[
                    styles.stopDot,
                    atStop.length > 0 && styles.stopDotBus,
                    isBoarding && styles.stopDotHighlight,
                  ]}
                />
                <View
                  style={[
                    styles.railSegment,
                    idx === line.stops.length - 1 && {
                      backgroundColor: "transparent",
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.stopName, isBoarding && styles.stopNameSelected]}
              >
                {stop}
              </Text>
              {isBoarding ? (
                <Text style={styles.stopNote}>Bindiğiniz durak</Text>
              ) : null}
            </View>
            {atStop.map((bus) => (
              <BusMarker key={bus.id} text={`${bus.plate} · durakta`} />
            ))}
            {onSegment.map((bus) => (
              <BusMarker
                key={bus.id}
                text={`${bus.plate} · ${bus.minutesToNext} dk sonra ${
                  line.stops[bus.toIndex]
                }`}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function BusMarker({ text }: { text: string }) {
  return (
    <View style={styles.busMarkerRow}>
      <View style={styles.busMarkerRail}>
        <Text style={styles.busMarkerIcon}>🚌</Text>
      </View>
      <Text style={styles.busMarkerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.chipBlueBg,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  identityName: { fontSize: 15, fontWeight: "800", color: colors.navy900 },
  identityCard: {
    fontSize: 12.5,
    color: colors.ink2,
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  identityBtn: {
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  identityBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.blue },
  lineChips: { gap: 8 },
  lineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lineChipActive: { borderColor: colors.blue, backgroundColor: colors.chipBlueBg },
  lineChipCode: {
    fontWeight: "800",
    fontSize: 13,
    color: colors.ink2,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  lineChipCodeActive: { backgroundColor: colors.blue, color: "#ffffff" },
  lineChipName: { flex: 1, fontSize: 14, color: colors.ink2, fontWeight: "600" },
  lineChipNameActive: { color: colors.navy900 },
  busCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  busCardIdle: { backgroundColor: colors.surface, opacity: 0.75 },
  busTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  busPlate: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy900,
    letterSpacing: 0.5,
  },
  busWhere: { fontSize: 13.5, color: colors.ink2, fontWeight: "600" },
  occChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  occLow: { backgroundColor: "#e5f3ec" },
  occMid: { backgroundColor: colors.chipBlueBg },
  occHigh: { backgroundColor: colors.chipAmberBg },
  occText: { fontSize: 11.5, fontWeight: "800" },
  occTextLow: { color: colors.success },
  occTextMid: { color: colors.blue },
  occTextHigh: { color: "#8a5600" },
  stopRow: { flexDirection: "row", alignItems: "center", paddingRight: 10 },
  stopRail: { width: 34, alignItems: "center", alignSelf: "stretch" },
  railSegment: { flex: 1, width: 2, backgroundColor: colors.line },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.ink3,
    backgroundColor: "#ffffff",
    marginVertical: 2,
  },
  stopDotBus: { borderColor: colors.accent, backgroundColor: colors.accent },
  stopDotHighlight: { borderColor: colors.blue, backgroundColor: colors.blue },
  stopName: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: "600",
    paddingVertical: 11,
  },
  stopNameSelected: { color: colors.navy900, fontWeight: "800" },
  stopNote: { fontSize: 12, color: colors.blue, fontWeight: "700" },
  busMarkerRow: { flexDirection: "row", alignItems: "center" },
  busMarkerRail: { width: 34, alignItems: "center" },
  busMarkerIcon: { fontSize: 15 },
  busMarkerText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.amber,
    fontWeight: "700",
  },
  alightInfo: { fontSize: 13.5, color: colors.ink2, lineHeight: 19 },
  alightStop: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy900,
    marginTop: 6,
    marginBottom: 12,
  },
  hint: { fontSize: 12.5, color: colors.ink3, lineHeight: 17, marginTop: 10 },
  tripBanner: {
    backgroundColor: colors.navy900,
    borderRadius: radius.card,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  tripBannerTitle: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  tripBannerLine: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 6,
  },
  tripBannerDetail: { color: "#b9c3de", fontSize: 13.5, marginTop: 4 },
  tripBannerNote: { color: colors.accent, fontSize: 12.5, marginTop: 8 },
});
