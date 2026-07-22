import React, { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ApiError, api } from "../api/client";
import { usePalette } from "../hooks/useTheme";
import { TranslationKey, useT } from "../i18n";
import { Palette, radius } from "../theme";
import { durationMinutes, hhmm } from "../utils/format";
import { Header, InfoBanner, LoadingBlock } from "../components/UI";
import { Trip, TripStatus } from "../types";

const STATUS_KEYS: Record<TripStatus, TranslationKey> = {
  open: "statusOpen",
  completed: "statusCompleted",
  abandoned: "statusAbandoned",
};

/**
 * Yolculuk geçmişi.
 *
 * Liste tamamen sunucudan gelir (`GET /trips`) ve yalnızca giriş yapan
 * kullanıcının kayıtlarını içerir — uygulama geçmişi kendisi üretmez ve
 * sunucuya geçmiş göndermez. Kayıt, iniş anında `/validate` ile zaten
 * yazılmıştır; burada gönderilecek bir şey yoktur.
 */
export default function HistoryScreen() {
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setTrips(await api.trips(50));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Geçmiş alınamadı.");
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={t("historyTitle")} />
        <LoadingBlock label={t("loading")} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={t("historyTitle")} subtitle={t("historySubtitle")} />
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={error ? <InfoBanner tone="error" text={error} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("historyEmpty")}</Text>
            <Text style={styles.emptyText}>{t("historyEmptyHint")}</Text>
          </View>
        }
        renderItem={({ item }) => <TripRow trip={item} styles={styles} />}
      />
    </View>
  );
}

function TripRow({
  trip,
  styles,
}: {
  trip: Trip;
  styles: ReturnType<typeof makeStyles>;
}) {
  const t = useT();
  const onboard = trip.status === "open";

  const statusStyle =
    trip.status === "completed"
      ? styles.statusCompleted
      : trip.status === "abandoned"
      ? styles.statusAbandoned
      : styles.statusOnboard;

  const statusTextStyle =
    trip.status === "completed"
      ? styles.statusTextCompleted
      : trip.status === "abandoned"
      ? styles.statusTextAbandoned
      : styles.statusTextOnboard;

  return (
    <View style={[styles.row, onboard && styles.rowOnboard]}>
      <View style={styles.rowHeader}>
        <Text style={styles.time}>
          {hhmm(trip.boarded_at)} – {trip.alighted_at ? hhmm(trip.alighted_at) : "…"}
        </Text>
        <View style={[styles.statusChip, statusStyle]}>
          <Text style={[styles.statusText, statusTextStyle]}>
            {t(STATUS_KEYS[trip.status])}
          </Text>
        </View>
      </View>
      <Text style={styles.line}>{trip.line.name}</Text>
      <Text style={styles.route}>
        {trip.alight_stop && trip.alighted_at
          ? `${trip.board_stop.name} → ${trip.alight_stop.name} · ${durationMinutes(
              trip.boarded_at,
              trip.alighted_at
            )} ${t("minutesShort")}`
          : trip.board_stop.name}
      </Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.surface },
    content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
    empty: { alignItems: "center", paddingTop: 60, gap: 6 },
    emptyTitle: { fontSize: 17, fontWeight: "800", color: palette.ink },
    emptyText: {
      fontSize: 13.5,
      color: palette.ink2,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 19,
    },
    row: {
      backgroundColor: palette.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: palette.line,
      padding: 14,
      marginBottom: 10,
    },
    rowOnboard: { borderColor: palette.blue, borderLeftWidth: 4 },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    time: {
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
      fontVariant: ["tabular-nums"],
    },
    statusChip: {
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    statusCompleted: { backgroundColor: palette.chipBlueBg },
    statusAbandoned: { backgroundColor: palette.chipAmberBg },
    statusOnboard: { backgroundColor: palette.chipBlueBg },
    statusText: { fontSize: 11.5, fontWeight: "700" },
    statusTextCompleted: { color: palette.success },
    statusTextAbandoned: { color: palette.amber },
    statusTextOnboard: { color: palette.blue },
    line: {
      fontSize: 13.5,
      fontWeight: "700",
      color: palette.blue,
      marginTop: 8,
    },
    route: { fontSize: 13.5, color: palette.ink2, marginTop: 3 },
  });
}
