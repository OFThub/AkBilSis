import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { FARES, LINES, cumulativeMinutes, findLine } from "../data/lines";
import { colors, radius } from "../theme";
import { formatTL, hhmm } from "../utils/format";
import {
  Header,
  InfoBanner,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import NfcPrompt from "../components/NfcPrompt";
import UserPicker from "../components/UserPicker";
import { NfcError, cancelCardScan, readTagId } from "../nfc/nfcCard";
import { CardUser } from "../types";

type Notice = { tone: "info" | "error" | "success"; text: string } | null;

export default function TripScreen() {
  const app = useApp();
  const nfcOn = app.settings.nfcEnabled;

  const [selectedLineId, setSelectedLineId] = useState(LINES[0].id);
  const [boardingIndex, setBoardingIndex] = useState<number | null>(null);
  const [alightIndex, setAlightIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [scanState, setScanState] = useState<"waiting" | "error">("waiting");
  const [scanError, setScanError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Durak değişince/ekran kapanınca eski okuma sonucunu yok saymak için
  const scanTokenRef = useRef(0);

  // Bant sayfanın üstünde; düğmeler ise listenin altında kalabildiği için
  // sonuç mesajı gösterilirken en üste kaydır — aksi hâlde hata gözden kaçıyor
  function showNotice(next: Exclude<Notice, null>) {
    setNotice(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const onTrip = app.activeTrip !== null;
  const tripLine = onTrip ? findLine(app.activeTrip!.lineId) : undefined;
  const selectedLine = findLine(selectedLineId)!;

  const cumMinutes = useMemo(() => {
    if (onTrip && tripLine) {
      return cumulativeMinutes(tripLine, app.activeTrip!.boardingStopIndex);
    }
    return [];
  }, [onTrip, tripLine, app.activeTrip]);

  // NFC açıkken: iniş durağı seçilir seçilmez okuma başlar. "İn" butonu yoktur,
  // yolculuk yalnızca kart okutulunca biter.
  useEffect(() => {
    if (!nfcOn || !onTrip || alightIndex === null) return;
    const token = ++scanTokenRef.current;
    runAlightScan(alightIndex, token);
    return () => {
      scanTokenRef.current++;
      cancelCardScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfcOn, onTrip, alightIndex]);

  async function runAlightScan(stopIndex: number, token: number) {
    setScanState("waiting");
    setScanError(null);
    try {
      const tagId = await readTagId();
      if (token !== scanTokenRef.current) return;
      const user = app.findUserByTagId(tagId);
      if (!user) {
        setScanState("error");
        setScanError(
          `Bu etiket (${tagId}) hiçbir kullanıcıya bağlı değil. Kart ekranından bu etikete kullanıcı tanımlayın.`
        );
        return;
      }
      await finishAlight(stopIndex, user, token);
    } catch (e) {
      if (token !== scanTokenRef.current) return;
      const err = e as NfcError;
      if (err.code === "cancelled") return;
      setScanState("error");
      setScanError(err.message || "Kart okunamadı.");
    }
  }

  async function finishAlight(stopIndex: number, user: CardUser, token?: number) {
    const result = await app.alight(stopIndex, user.id);
    if (token !== undefined && token !== scanTokenRef.current) return;
    if (!result.ok) {
      if (nfcOn) {
        setScanState("error");
        setScanError(result.error ?? "İniş yapılamadı.");
      } else {
        showNotice({ tone: "error", text: result.error ?? "İniş yapılamadı." });
      }
      return;
    }
    setAlightIndex(null);
    const record = result.record!;
    const base = `${user.name} indi — ${formatTL(record.fare)} düşüldü, kalan bakiye ${formatTL(
      record.balanceAfter ?? 0
    )}.`;
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

  function retryAlightScan() {
    if (alightIndex === null) return;
    const token = ++scanTokenRef.current;
    runAlightScan(alightIndex, token);
  }

  function handleBoard() {
    setNotice(null);
    if (boardingIndex === null) {
      showNotice({ tone: "error", text: "Önce bindiğiniz durağı seçin." });
      return;
    }
    const result = app.board(selectedLineId, boardingIndex);
    if (!result.ok) {
      showNotice({ tone: "error", text: result.error ?? "Biniş yapılamadı." });
      return;
    }
    showNotice({
      tone: "success",
      text: nfcOn
        ? "Biniş kaydedildi — iniş yalnızca kart okutarak yapılır. İyi yolculuklar!"
        : "Biniş kaydedildi — inerken listeden kullanıcı seçin. İyi yolculuklar!",
    });
    setBoardingIndex(null);
    setAlightIndex(null);
  }

  return (
    <View style={styles.root}>
      <Header title="Yolculuk" subtitle="Akbil basma simülasyonu" />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {notice && <InfoBanner tone={notice.tone} text={notice.text} />}

        {!onTrip && (
          <>
            <SectionCard>
              <SectionTitle>Hat seçin</SectionTitle>
              <View style={styles.lineChips}>
                {LINES.map((line) => {
                  const active = line.id === selectedLineId;
                  return (
                    <Pressable
                      key={line.id}
                      onPress={() => {
                        setSelectedLineId(line.id);
                        setBoardingIndex(null);
                      }}
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
              <SectionTitle>Bindiğiniz durak</SectionTitle>
              {selectedLine.stops.map((stop, idx) => {
                const isLast = idx === selectedLine.stops.length - 1;
                return (
                  <StopRow
                    key={stop}
                    name={stop}
                    first={idx === 0}
                    last={isLast}
                    selected={boardingIndex === idx}
                    disabled={isLast}
                    note={isLast ? "Son durak — biniş yok" : undefined}
                    onPress={() => setBoardingIndex(idx)}
                  />
                );
              })}
            </SectionCard>

            <SectionCard>
              <View style={styles.fareRow}>
                <View>
                  <Text style={styles.fareLabel}>Tam bilet</Text>
                  <Text style={styles.fareValue}>{formatTL(FARES.tam)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.fareLabel}>Öğrenci bilet</Text>
                  <Text style={styles.fareValue}>{formatTL(FARES.ogrenci)}</Text>
                </View>
              </View>
              <Text style={styles.fareNote}>
                Ücret inişte, kartı belirlenen kullanıcının tipine göre düşülür.
              </Text>
              <PrimaryButton label="Bin (Yolculuğu Başlat)" onPress={handleBoard} />
            </SectionCard>
          </>
        )}

        {onTrip && tripLine && (
          <>
            <View style={styles.tripBanner}>
              <Text style={styles.tripBannerTitle}>Araçtasınız</Text>
              <Text style={styles.tripBannerLine}>{tripLine.name}</Text>
              <Text style={styles.tripBannerDetail}>
                Biniş: {tripLine.stops[app.activeTrip!.boardingStopIndex]} ·{" "}
                {hhmm(app.activeTrip!.boardTime)}
              </Text>
              <Text style={styles.tripBannerNote}>
                {nfcOn
                  ? "İniş yalnızca kart okutarak yapılır — inmeden yeni biniş yapılamaz."
                  : "İnmek için durağı seçip listeden kullanıcıyı işaretleyin."}
              </Text>
            </View>

            <SectionCard>
              <SectionTitle>İndiğiniz durak</SectionTitle>
              {tripLine.stops.map((stop, idx) => {
                const before = idx <= app.activeTrip!.boardingStopIndex;
                const isBoarding = idx === app.activeTrip!.boardingStopIndex;
                return (
                  <StopRow
                    key={stop}
                    name={stop}
                    first={idx === 0}
                    last={idx === tripLine.stops.length - 1}
                    selected={alightIndex === idx}
                    disabled={before}
                    highlight={isBoarding}
                    note={
                      isBoarding
                        ? "Bindiğiniz durak"
                        : before
                        ? undefined
                        : `+${cumMinutes[idx]} dk`
                    }
                    onPress={() => setAlightIndex(idx)}
                  />
                );
              })}
            </SectionCard>

            {alightIndex !== null && (
              <>
                <SectionCard>
                  <View style={styles.fareRow}>
                    <View>
                      <Text style={styles.fareLabel}>Tahmini iniş saati</Text>
                      <Text style={styles.fareValue}>
                        {hhmm(
                          new Date(
                            new Date(app.activeTrip!.boardTime).getTime() +
                              cumMinutes[alightIndex] * 60000
                          ).toISOString()
                        )}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.fareLabel}>Yolculuk süresi</Text>
                      <Text style={styles.fareValue}>
                        {cumMinutes[alightIndex]} dk
                      </Text>
                    </View>
                  </View>
                </SectionCard>

                {/* NFC açık: "İn" butonu yok, okutma beklenir */}
                {nfcOn && (
                  <NfcPrompt
                    state={scanState}
                    error={scanError ?? undefined}
                    onRetry={retryAlightScan}
                  />
                )}

                {/* NFC kapalı: okutma yok, kullanıcı listeden seçilir */}
                {!nfcOn && (
                  <SectionCard>
                    <SectionTitle>İnen kullanıcı</SectionTitle>
                    <UserPicker
                      users={app.users}
                      onSelect={(user) => finishAlight(alightIndex, user)}
                    />
                    <Text style={styles.fareNote}>
                      Kullanıcıya dokunduğunuzda iniş tamamlanır ve ücret
                      bakiyesinden düşülür.
                    </Text>
                  </SectionCard>
                )}
              </>
            )}

            {alightIndex === null && (
              <Text style={styles.alightHint}>
                {nfcOn
                  ? "İnmek için önce durağınızı seçin, ardından kartınızı okutun."
                  : "İnmek için önce durağınızı seçin."}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Hat şeması satırı: durak noktası + bağlantı çizgisi */
function StopRow({
  name,
  first,
  last,
  selected,
  disabled,
  highlight,
  note,
  onPress,
}: {
  name: string;
  first?: boolean;
  last?: boolean;
  selected?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  note?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stopRow,
        pressed && !disabled && { backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.stopRail}>
        <View
          style={[styles.railSegment, first && { backgroundColor: "transparent" }]}
        />
        <View
          style={[
            styles.stopDot,
            selected && styles.stopDotSelected,
            highlight && styles.stopDotHighlight,
            disabled && !highlight && styles.stopDotDisabled,
          ]}
        />
        <View
          style={[styles.railSegment, last && { backgroundColor: "transparent" }]}
        />
      </View>
      <Text
        style={[
          styles.stopName,
          selected && styles.stopNameSelected,
          disabled && !highlight && { color: colors.ink3 },
        ]}
      >
        {name}
      </Text>
      {note ? <Text style={styles.stopNote}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28 },
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
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.control,
    paddingRight: 10,
  },
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
  stopDotSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  stopDotHighlight: { borderColor: colors.blue, backgroundColor: colors.blue },
  stopDotDisabled: { borderColor: colors.line },
  stopName: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: "600",
    paddingVertical: 13,
  },
  stopNameSelected: { color: colors.navy900, fontWeight: "800" },
  stopNote: { fontSize: 12, color: colors.ink3, fontWeight: "600" },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  fareLabel: { fontSize: 12, color: colors.ink3, fontWeight: "600" },
  fareValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.navy900,
    marginTop: 2,
  },
  fareNote: {
    fontSize: 12.5,
    color: colors.ink3,
    lineHeight: 17,
    marginTop: 10,
    marginBottom: 2,
  },
  alightHint: {
    textAlign: "center",
    color: colors.ink3,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
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
