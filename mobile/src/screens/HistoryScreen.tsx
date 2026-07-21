import React, { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { colors, radius } from "../theme";
import { formatTL, hhmm, maskCardNo } from "../utils/format";
import { Header, InfoBanner, PrimaryButton } from "../components/UI";
import { TripRecord } from "../types";

export default function HistoryScreen() {
  const app = useApp();
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleRetry() {
    setSending(true);
    setNotice(null);
    const sent = await app.retryPending();
    setSending(false);
    setNotice(
      sent > 0
        ? `${sent} bekleyen kayıt izleme merkezine gönderildi.`
        : "Sunucuya ulaşılamadı. Ayarlar ekranından adresi kontrol edin."
    );
  }

  return (
    <View style={styles.root}>
      <Header title="Geçmiş" subtitle="Tamamlanan yolculuklar" />
      <FlatList
        data={app.history}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {notice && <InfoBanner tone="info" text={notice} />}
            {app.pendingCount > 0 && (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingText}>
                  {app.pendingCount} kayıt gönderilmeyi bekliyor.
                </Text>
                <PrimaryButton
                  label={sending ? "Gönderiliyor…" : "Bekleyenleri Gönder"}
                  onPress={handleRetry}
                  disabled={sending}
                  tone="navy"
                />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Henüz yolculuk yok</Text>
            <Text style={styles.emptyText}>
              Yolculuk ekranından kart basarak ilk simülasyonu başlatın.
            </Text>
          </View>
        }
        renderItem={({ item }) => <TripRow record={item} />}
      />
    </View>
  );
}

function TripRow({ record }: { record: TripRecord }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.time}>
          {hhmm(record.boardTime)} – {hhmm(record.alightTime)}
        </Text>
        <View
          style={[
            styles.statusChip,
            record.status === "sent" ? styles.statusSent : styles.statusPending,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              record.status === "sent"
                ? styles.statusTextSent
                : styles.statusTextPending,
            ]}
          >
            {record.status === "sent" ? "Gönderildi" : "Bekliyor"}
          </Text>
        </View>
      </View>
      <Text style={styles.line}>{record.line}</Text>
      <Text style={styles.route}>
        {record.boardingStop} → {record.alightingStop} · {record.durationMin} dk
      </Text>
      <View style={styles.rowFooter}>
        <Text style={styles.card}>
          {record.cardType === "tam" ? "Tam" : "Öğrenci"} ·{" "}
          {maskCardNo(record.cardNo)}
        </Text>
        <Text style={styles.fare}>{formatTL(record.fare)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  pendingBox: {
    backgroundColor: colors.chipAmberBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  pendingText: { color: "#8a5600", fontWeight: "700", fontSize: 13.5 },
  empty: { alignItems: "center", paddingTop: 80, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  emptyText: {
    fontSize: 13.5,
    color: colors.ink2,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 19,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  time: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy900,
    fontVariant: ["tabular-nums"],
  },
  statusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusSent: { backgroundColor: "#e5f3ec" },
  statusPending: { backgroundColor: colors.chipAmberBg },
  statusText: { fontSize: 11.5, fontWeight: "700" },
  statusTextSent: { color: colors.success },
  statusTextPending: { color: "#8a5600" },
  line: { fontSize: 13.5, fontWeight: "700", color: colors.blue, marginTop: 8 },
  route: { fontSize: 13.5, color: colors.ink2, marginTop: 3 },
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  card: { fontSize: 12.5, color: colors.ink3, fontWeight: "600" },
  fare: { fontSize: 14, fontWeight: "800", color: colors.ink },
});
