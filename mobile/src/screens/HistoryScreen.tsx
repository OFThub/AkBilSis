import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useApp } from "../context/AppContext";
import { colors, radius } from "../theme";
import { hhmm, maskCardNo } from "../utils/format";
import { Header, InfoBanner, PrimaryButton } from "../components/UI";
import IdentityGate from "../components/IdentityGate";
import { CardUser, TripRecord } from "../types";

/**
 * Geçmiş yalnızca kartını seçen kişiye açıktır: kimlik doğrulanmadan liste
 * hiç render edilmez, doğrulandıktan sonra da yalnızca o karta ait kayıtlar
 * gösterilir. Sekmeden çıkınca ekran unmount olduğu için kimlik düşer.
 */
export default function HistoryScreen() {
  const app = useApp();
  const [user, setUser] = useState<CardUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const records = useMemo(
    () => (user ? app.history.filter((r) => r.cardNo === user.cardNo) : []),
    [app.history, user]
  );
  const pendingCount = records.filter((r) => r.status === "pending").length;

  async function handleRetry() {
    if (!user) return;
    setSending(true);
    setNotice(null);
    const sent = await app.retryPending(user.cardNo);
    setSending(false);
    setNotice(
      sent > 0
        ? `${sent} bekleyen kayıt izleme merkezine gönderildi.`
        : "Sunucuya ulaşılamadı. Backend'in çalıştığını ve .env dosyasındaki adresi kontrol edin."
    );
  }

  if (!user) {
    return (
      <View style={styles.root}>
        <Header title="Geçmiş" subtitle="Kullanıcı seçmeden görüntülenemez" />
        <ScrollView contentContainerStyle={styles.content}>
          <IdentityGate
            title="Geçmişi görmek için kullanıcı seçin"
            hint="Listeden kendinizi seçin. Yalnızca seçtiğiniz karta ait yolculuklar listelenir."
            onIdentified={(identified) => {
              setUser(identified);
              setNotice(null);
            }}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title="Geçmiş" subtitle={user.name} />
      <FlatList
        data={records}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.identity}>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityName}>{user.name}</Text>
                <Text style={styles.identityCard}>
                  {maskCardNo(user.cardNo)} ·{" "}
                  {user.cardType === "tam" ? "Tam" : "Öğrenci"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setUser(null);
                  setNotice(null);
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.identityBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.identityBtnText}>Kimliği Bırak</Text>
              </Pressable>
            </View>
            {notice && <InfoBanner tone="info" text={notice} />}
            {pendingCount > 0 && (
              <View style={styles.pendingBox}>
                <Text style={styles.pendingText}>
                  {pendingCount} kayıt gönderilmeyi bekliyor.
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
            <Text style={styles.emptyTitle}>Bu kartla yolculuk yok</Text>
            <Text style={styles.emptyText}>
              Yolculuk ekranından bir otobüse binip indiğinizde kayıtlar burada
              listelenir.
            </Text>
          </View>
        }
        renderItem={({ item }) => <TripRow record={item} />}
      />
    </View>
  );
}

function TripRow({ record }: { record: TripRecord }) {
  // Biniş anında açılan kayıt: yolcu hâlâ araçta, iniş bilgisi henüz yok
  const onboard = record.status === "onboard";
  const statusStyle = onboard
    ? styles.statusOnboard
    : record.status === "sent"
    ? styles.statusSent
    : styles.statusPending;
  const statusTextStyle = onboard
    ? styles.statusTextOnboard
    : record.status === "sent"
    ? styles.statusTextSent
    : styles.statusTextPending;

  return (
    <View style={[styles.row, onboard && styles.rowOnboard]}>
      <View style={styles.rowHeader}>
        <Text style={styles.time}>
          {hhmm(record.boardTime)} –{" "}
          {record.alightTime ? hhmm(record.alightTime) : "…"}
        </Text>
        <View style={[styles.statusChip, statusStyle]}>
          <Text style={[styles.statusText, statusTextStyle]}>
            {onboard
              ? "Otobüste"
              : record.status === "sent"
              ? "Gönderildi"
              : "Bekliyor"}
          </Text>
        </View>
      </View>
      <Text style={styles.line}>{record.line}</Text>
      <Text style={styles.route}>
        {onboard
          ? `${record.boardingStop} durağından bindi`
          : `${record.boardingStop} → ${record.alightingStop} · ${record.durationMin} dk`}
      </Text>
      <View style={styles.rowFooter}>
        <Text style={styles.card}>
          {record.busPlate ? `🚌 ${record.busPlate} · ` : ""}
          {record.cardType === "tam" ? "Tam" : "Öğrenci"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
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
  },
  identityBtn: {
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  identityBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.blue },
  pendingBox: {
    backgroundColor: colors.chipAmberBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  pendingText: { color: "#8a5600", fontWeight: "700", fontSize: 13.5 },
  empty: { alignItems: "center", paddingTop: 60, gap: 6 },
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
  rowOnboard: { borderColor: colors.blue, borderLeftWidth: 4 },
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
  statusOnboard: { backgroundColor: colors.chipBlueBg },
  statusText: { fontSize: 11.5, fontWeight: "700" },
  statusTextSent: { color: colors.success },
  statusTextPending: { color: "#8a5600" },
  statusTextOnboard: { color: colors.blue },
  line: { fontSize: 13.5, fontWeight: "700", color: colors.blue, marginTop: 8 },
  route: { fontSize: 13.5, color: colors.ink2, marginTop: 3 },
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  card: { fontSize: 12.5, color: colors.ink3, fontWeight: "600" },
});
