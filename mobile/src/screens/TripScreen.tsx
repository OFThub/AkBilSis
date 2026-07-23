import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError, api } from "../api/client";
import { usePalette } from "../hooks/useTheme";
import { useT } from "../i18n";
import { Palette, radius } from "../theme";
import { hhmm } from "../utils/format";
import {
  Header,
  InfoBanner,
  LoadingBlock,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import { Direction, Line, LineDetail, LiveBus, Trip } from "../types";

/** Araç konumları sunucuda hesaplandığı için düzenli aralıkla tazelenir */
const POLL_MS = 2000;

type Notice = { tone: "info" | "error" | "success"; text: string } | null;

/**
 * Yolculuk akışı iki durumludur:
 *  1. Araçta değil → hat ve yoldaki araçlar listelenir. Biniş durağı seçilmez;
 *     sunucu, aracın o anki konumundan belirler.
 *  2. Araçta → yalnızca "Otobüsten İn". Başka araca binmek için arayüzde yol
 *     yoktur; sunucu da inmeden binişi "bırakılmış yolculuk" sayar.
 */
export default function TripScreen() {
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lineDetail, setLineDetail] = useState<LineDetail | null>(null);
  // Şemada gösterilen yön — araçlar gidiş ve dönüşü tek döngüde yapar
  const [direction, setDirection] = useState<Direction>("forward");
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Araçtayken o yolculuğun hattı, değilken seçili hat izlenir
  const watchedLineId = trip ? trip.line.id : selectedLineId;

  const showNotice = useCallback((next: Exclude<Notice, null>) => {
    setNotice(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Açılış: hatlar ve varsa süren yolculuk
  useEffect(() => {
    (async () => {
      try {
        const [allLines, active] = await Promise.all([api.lines(), api.activeTrip()]);
        setLines(allLines);
        setTrip(active);
        setSelectedLineId(active ? active.line.id : allLines[0]?.id ?? null);
      } catch (err) {
        setNotice({
          tone: "error",
          text: err instanceof ApiError ? err.message : "Hatlar yüklenemedi.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Hat şeması — hat değişince bir kez çekilir
  useEffect(() => {
    if (!watchedLineId) return;
    let cancelled = false;
    api
      .lineDetail(watchedLineId, direction)
      .then((detail) => {
        if (!cancelled) setLineDetail(detail);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [watchedLineId, direction]);

  // Canlı araç konumları — sunucudan düzenli aralıkla
  useEffect(() => {
    if (!watchedLineId) return;
    let cancelled = false;

    async function poll(lineId: string) {
      try {
        const live = await api.liveBuses(lineId);
        if (!cancelled) setBuses(live);
      } catch {
        // Geçici ağ hatası ekranı bozmasın; bir sonraki tur yeniden dener
      }
    }

    poll(watchedLineId);
    const timer = setInterval(() => poll(watchedLineId), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watchedLineId]);

  // Son durakta otomatik iniş sunucuda olur; ekran bunu yolculuğu tazeleyerek
  // öğrenir, yoksa kullanıcı sonsuza dek "araçtasınız" görürdü
  useEffect(() => {
    if (!trip) return;
    const timer = setInterval(() => {
      api
        .activeTrip()
        .then(setTrip)
        .catch(() => {});
    }, POLL_MS * 3);
    return () => clearInterval(timer);
  }, [trip]);

  /** Biniş ve iniş aynı uca gider — hangisi olduğunu sunucu söyler */
  async function handleValidate(busId: string) {
    if (working) return;
    setWorking(true);
    try {
      const result = await api.validate(busId);
      setTrip(await api.activeTrip());
      showNotice({
        tone: "success",
        text:
          result.action === "boarded"
            ? `${result.stop_name} durağında ${result.line_code} hattına bindiniz.`
            : `${result.stop_name} durağında indiniz. İyi günler!`,
      });
    } catch (err) {
      showNotice({
        tone: "error",
        text: err instanceof ApiError ? err.message : "İşlem yapılamadı.",
      });
    } finally {
      setWorking(false);
    }
  }

  const selectedLine = lines.find((l) => l.id === selectedLineId) ?? null;
  const tripBus = trip ? buses.find((bus) => bus.id === trip.bus_id) : undefined;

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={t("tripTitle")} />
        <LoadingBlock label={t("loading")} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header
        title={t("tripTitle")}
        subtitle={trip ? trip.line.name : selectedLine?.name}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {notice && <InfoBanner tone={notice.tone} text={notice.text} />}

        {/* ── ARAÇTA: yalnızca iniş ── */}
        {trip ? (
          <>
            <View style={styles.tripBanner}>
              <Text style={styles.tripBannerTitle}>{t("onboard")}</Text>
              <Text style={styles.tripBannerLine}>{trip.line.name}</Text>
              <Text style={styles.tripBannerDetail}>
                {trip.board_stop.name} · {hhmm(trip.boarded_at)}
              </Text>
            </View>

            <SectionCard>
              <SectionTitle>{t("alightAction")}</SectionTitle>
              <Text style={styles.alightStop}>
                {tripBus?.at_stop
                  ? tripBus.current_stop?.name ?? "—"
                  : tripBus?.next_stop?.name ?? "—"}
              </Text>
              <PrimaryButton
                label={
                  working
                    ? t("pleaseWait")
                    : tripBus?.at_stop
                    ? t("alightAction")
                    : t("waitingForStop")
                }
                onPress={() => tripBus && handleValidate(tripBus.id)}
                disabled={working || !tripBus?.at_stop}
              />
              <Text style={styles.hint}>{t("alightHint")}</Text>
            </SectionCard>
          </>
        ) : (
          <>
            <SectionCard>
              <SectionTitle>{t("selectLine")}</SectionTitle>
              <View style={styles.lineChips}>
                {lines.map((line) => {
                  const active = line.id === selectedLineId;
                  return (
                    <Pressable
                      key={line.id}
                      onPress={() => setSelectedLineId(line.id)}
                      style={[styles.lineChip, active && styles.lineChipActive]}
                    >
                      <Text
                        style={[styles.lineChipCode, active && styles.lineChipCodeActive]}
                      >
                        {line.code}
                      </Text>
                      <Text
                        style={[styles.lineChipName, active && styles.lineChipNameActive]}
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
              <SectionTitle>{t("busesOnRoute")}</SectionTitle>
              {buses.length === 0 ? (
                <Text style={styles.hint}>{t("noBuses")}</Text>
              ) : (
                buses.map((bus) => (
                  <BusCard
                    key={bus.id}
                    bus={bus}
                    styles={styles}
                    disabled={working}
                    onBoard={() => handleValidate(bus.id)}
                  />
                ))
              )}
              <Text style={styles.hint}>{t("tripHint")}</Text>
            </SectionCard>
          </>
        )}

        {lineDetail && (
          <SectionCard>
            <View style={styles.diagramHeader}>
              <SectionTitle>
                {lineDetail.code} {t("lineDiagram")} ·{" "}
                {direction === "forward" ? t("directionForward") : t("directionBackward")}
              </SectionTitle>
              <Pressable
                onPress={() =>
                  setDirection((prev) => (prev === "forward" ? "backward" : "forward"))
                }
                accessibilityRole="button"
                accessibilityLabel={t("toggleDirection")}
                hitSlop={8}
                style={styles.directionButton}
              >
                <Text style={styles.directionButtonLabel}>⇅ {t("toggleDirection")}</Text>
              </Pressable>
            </View>
            <StopRail
              detail={lineDetail}
              direction={direction}
              buses={trip ? (tripBus ? [tripBus] : []) : buses}
              boardingStopId={trip?.board_stop.id}
              styles={styles}
            />
          </SectionCard>
        )}
      </ScrollView>
    </View>
  );
}

/** Yoldaki tek araç — plaka, canlı konum, yolcu sayısı ve biniş düğmesi */
function BusCard({
  bus,
  styles,
  disabled,
  onBoard,
}: {
  bus: LiveBus;
  styles: ReturnType<typeof makeStyles>;
  disabled: boolean;
  onBoard: () => void;
}) {
  const t = useT();

  const location = bus.layover
    ? `${t("layoverLabel")} — ${bus.minutes_to_next} ${t("minutesShort")}`
    : bus.at_stop
    ? `${bus.current_stop?.name ?? "—"} ${t("atStopSuffix")}`
    : `${bus.current_stop?.name ?? "—"} → ${bus.next_stop?.name ?? "—"} · ${
        bus.minutes_to_next
      } ${t("minutesShort")}`;

  return (
    <View style={[styles.busCard, !bus.at_stop && styles.busCardIdle]}>
      <View style={styles.busTop}>
        <Text style={styles.busPlate}>🚌 {bus.plate}</Text>
        <View style={styles.occChip}>
          <Text style={styles.occText}>
            {bus.passenger_count === 0
              ? t("emptyBus")
              : `${bus.passenger_count} ${t("passengersAboard")}`}
          </Text>
        </View>
      </View>
      <Text style={styles.busWhere}>{location}</Text>
      {/* Biniş yalnızca araç durakta beklerken açıktır */}
      <PrimaryButton
        label={
          bus.layover
            ? t("layoverLabel")
            : bus.at_stop
            ? t("boardAction")
            : `${bus.minutes_to_next} ${t("minutesShort")} · ${bus.next_stop?.name ?? ""}`
        }
        onPress={onBoard}
        disabled={disabled || !bus.at_stop}
      />
    </View>
  );
}

/** Hat şeması: duraklar + araçların canlı konum işaretleri */
function StopRail({
  detail,
  direction,
  buses,
  boardingStopId,
  styles,
}: {
  detail: LineDetail;
  direction: Direction;
  buses: LiveBus[];
  boardingStopId?: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const stops = detail.line_stops
    .filter((entry) => entry.direction === direction)
    .sort((a, b) => a.sequence - b.sequence);

  // Duraklar iki yönde ortaktır: ters yöndeki araç filtrelenmezse bu şemada
  // aynadaki yanlış konumda görünürdü
  const shown = buses.filter((bus) => bus.direction === direction);

  return (
    <View>
      {stops.map((entry, index) => {
        const atStop = shown.filter(
          (bus) => bus.at_stop && bus.current_stop?.id === entry.stop.id
        );
        const onSegment = shown.filter(
          (bus) => !bus.at_stop && !bus.layover && bus.current_stop?.id === entry.stop.id
        );
        const isBoarding = boardingStopId === entry.stop.id;

        return (
          <View key={entry.stop.id}>
            <View style={styles.stopRow}>
              <View style={styles.stopRail}>
                <View
                  style={[
                    styles.railSegment,
                    index === 0 && { backgroundColor: "transparent" },
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
                    index === stops.length - 1 && { backgroundColor: "transparent" },
                  ]}
                />
              </View>
              <Text style={[styles.stopName, isBoarding && styles.stopNameSelected]}>
                {entry.stop.name}
              </Text>
              {isBoarding ? (
                <Text style={styles.stopNote}>{t("boardingStop")}</Text>
              ) : null}
            </View>
            {atStop.map((bus) => (
              <BusMarker
                key={bus.id}
                text={`${bus.plate} · ${t("atStopSuffix")}`}
                styles={styles}
              />
            ))}
            {onSegment.map((bus) => (
              <BusMarker
                key={bus.id}
                text={`${bus.plate} · ${bus.minutes_to_next} ${t("minutesShort")} → ${
                  bus.next_stop?.name ?? ""
                }`}
                styles={styles}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function BusMarker({
  text,
  styles,
}: {
  text: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.busMarkerRow}>
      <View style={styles.busMarkerRail}>
        <Text style={styles.busMarkerIcon}>🚌</Text>
      </View>
      <Text style={styles.busMarkerText}>{text}</Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.surface },
    content: { padding: 16, paddingBottom: 28 },
    lineChips: { gap: 8 },
    lineChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: radius.control,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    lineChipActive: { borderColor: palette.blue, backgroundColor: palette.chipBlueBg },
    lineChipCode: {
      fontWeight: "800",
      fontSize: 13,
      color: palette.ink2,
      backgroundColor: palette.surface,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    lineChipCodeActive: { backgroundColor: palette.blue, color: "#ffffff" },
    lineChipName: { flex: 1, fontSize: 14, color: palette.ink2, fontWeight: "600" },
    lineChipNameActive: { color: palette.ink, fontWeight: "700" },
    busCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: radius.control,
      padding: 12,
      marginBottom: 10,
      gap: 8,
    },
    busCardIdle: { backgroundColor: palette.surface, opacity: 0.75 },
    busTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    busPlate: {
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
      letterSpacing: 0.5,
    },
    busWhere: { fontSize: 13.5, color: palette.ink2, fontWeight: "600" },
    occChip: {
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      backgroundColor: palette.chipBlueBg,
    },
    occText: { fontSize: 11.5, fontWeight: "800", color: palette.blue },
    diagramHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    directionButton: {
      borderWidth: 1,
      borderColor: palette.blue,
      borderRadius: radius.control,
      backgroundColor: palette.chipBlueBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    directionButtonLabel: { fontSize: 12.5, fontWeight: "700", color: palette.blue },
    stopRow: { flexDirection: "row", alignItems: "center", paddingRight: 10 },
    stopRail: { width: 34, alignItems: "center", alignSelf: "stretch" },
    railSegment: { flex: 1, width: 2, backgroundColor: palette.line },
    stopDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 3,
      borderColor: palette.ink3,
      backgroundColor: palette.card,
      marginVertical: 2,
    },
    stopDotBus: { borderColor: palette.accent, backgroundColor: palette.accent },
    stopDotHighlight: { borderColor: palette.blue, backgroundColor: palette.blue },
    stopName: {
      flex: 1,
      fontSize: 15,
      color: palette.ink,
      fontWeight: "600",
      paddingVertical: 11,
    },
    stopNameSelected: { fontWeight: "800" },
    stopNote: { fontSize: 12, color: palette.blue, fontWeight: "700" },
    busMarkerRow: { flexDirection: "row", alignItems: "center" },
    busMarkerRail: { width: 34, alignItems: "center" },
    busMarkerIcon: { fontSize: 15 },
    busMarkerText: {
      flex: 1,
      fontSize: 12.5,
      color: palette.amber,
      fontWeight: "700",
    },
    alightStop: {
      fontSize: 18,
      fontWeight: "800",
      color: palette.ink,
      marginBottom: 12,
    },
    hint: { fontSize: 12.5, color: palette.ink3, lineHeight: 17, marginTop: 10 },
    tripBanner: {
      backgroundColor: palette.navy900,
      borderRadius: radius.card,
      padding: 18,
      marginBottom: 14,
      borderLeftWidth: 4,
      borderLeftColor: palette.accent,
    },
    tripBannerTitle: {
      color: palette.accent,
      fontWeight: "800",
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    tripBannerLine: {
      color: palette.onNavy,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 6,
    },
    tripBannerDetail: { color: palette.onNavyMuted, fontSize: 13.5, marginTop: 4 },
  });
}
