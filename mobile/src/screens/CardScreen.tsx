import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api } from "../api/client";
import { useApp } from "../context/AppContext";
import { usePalette } from "../hooks/useTheme";
import { useT } from "../i18n";
import { Palette, radius } from "../theme";
import { cardLabel, cardTypeKey, hourRange } from "../utils/format";
import BusyChart from "../components/BusyChart";
import {
  Header,
  InfoBanner,
  LoadingBlock,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import { Card, Line } from "../types";

/**
 * Kart profili ve hat yoğunlukları.
 *
 * Kart, hat ve favori verisinin tamamı sunucudan gelir; favori değişikliği
 * anında `/favorites` ucuna yazılır — yerel bir kopya tutulmaz.
 */
export default function CardScreen() {
  const app = useApp();
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [card, setCard] = useState<Card | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [tripCount, setTripCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentHour = new Date().getHours();

  async function load() {
    try {
      const [cards, allLines, favorites, trips] = await Promise.all([
        api.cards(),
        api.lines(),
        api.favorites(),
        api.trips(50),
      ]);
      setCard(cards[0] ?? null);
      setLines(allLines);
      setFavoriteIds(new Set(favorites.map((f) => f.line_id)));
      setTripCount(trips.length);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kart bilgileri alınamadı.");
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

  /** Favori değişikliği önce sunucuya yazılır; başarısızsa arayüz geri alınır */
  async function toggleFavorite(lineId: string) {
    const previous = favoriteIds;
    const wasFavorite = previous.has(lineId);
    const next = new Set(previous);
    if (wasFavorite) next.delete(lineId);
    else next.add(lineId);
    setFavoriteIds(next);

    try {
      if (wasFavorite) await api.removeFavorite(lineId);
      else await api.addFavorite(lineId);
    } catch (err) {
      setFavoriteIds(previous);
      setError(err instanceof ApiError ? err.message : "Favori güncellenemedi.");
    }
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={t("cardTitle")} />
        <LoadingBlock label={t("loading")} />
      </View>
    );
  }

  const favoriteLines = lines.filter((line) => favoriteIds.has(line.id));

  return (
    <View style={styles.root}>
      <Header title={t("cardTitle")} subtitle={t("cardSubtitle")} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Sanal akbil kartı — web panelindeki kartla aynı görsel dil */}
        <View style={styles.virtualCard}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.watermark}
            resizeMode="contain"
          />
          <View style={styles.cardTopRow}>
            <Image
              source={require("../../assets/logo-2.png")}
              style={styles.cardBrand}
              resizeMode="contain"
            />
            {card && (
              <View
                style={[
                  styles.typeBadge,
                  card.card_type !== "normal" && styles.typeBadgeAlt,
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {t(cardTypeKey(card.card_type)).toLocaleUpperCase("tr")}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cardHolder}>{app.passenger?.full_name ?? ""}</Text>
          <Text style={styles.cardNumber}>
            {card ? cardLabel(card.id, card.nfc_uid) : "•••• ••••"}
          </Text>
          <View style={styles.cardBottomRow}>
            <View>
              <Text style={styles.statLabel}>{t("cardTrips")}</Text>
              <Text style={styles.statValue}>{tripCount}</Text>
            </View>
            <Text style={styles.cardFooter}>AKBİL</Text>
          </View>
        </View>

        {error && <InfoBanner tone="error" text={error} />}

        {card && !card.is_active && <InfoBanner tone="error" text={t("cardInactive")} />}

        <SectionCard>
          <SectionTitle>{t("allLines")}</SectionTitle>
          {lines.map((line) => (
            <LineRow
              key={line.id}
              code={line.code}
              name={line.name.replace(`${line.code} `, "")}
              favorite={favoriteIds.has(line.id)}
              styles={styles}
              onToggle={() => toggleFavorite(line.id)}
            />
          ))}
          <Text style={styles.hint}>{t("favoriteHint")}</Text>
        </SectionCard>

        <SectionCard>
          <SectionTitle>{t("favoriteLines")}</SectionTitle>
          {favoriteLines.length === 0 ? (
            <Text style={styles.emptyFav}>{t("noFavorites")}</Text>
          ) : (
            favoriteLines.map((line) => (
              <View key={line.id} style={styles.favCard}>
                <Text style={styles.favName}>{line.name}</Text>
                <Text style={styles.favPeaks}>
                  {t("peakHours")}: {line.peak_hours.map(hourRange).join(" · ") || "—"}
                </Text>
                <BusyChart hourly={line.hourly_profile} currentHour={currentHour} />
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

/** Hat listesi satırı — kod rozeti, ad ve favori yıldızı */
function LineRow({
  code,
  name,
  favorite,
  styles,
  onToggle,
}: {
  code: string;
  name: string;
  favorite: boolean;
  styles: ReturnType<typeof makeStyles>;
  onToggle: () => void;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineCode}>{code}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Pressable
        onPress={onToggle}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          favorite ? `${code} favorilerden çıkar` : `${code} favorilere ekle`
        }
        style={({ pressed }) => [styles.star, pressed && { opacity: 0.6 }]}
      >
        <Text style={[styles.starIcon, favorite && styles.starIconActive]}>
          {favorite ? "★" : "☆"}
        </Text>
      </Pressable>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.surface },
    content: { padding: 16, paddingBottom: 28 },
    virtualCard: {
      backgroundColor: palette.navy900,
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
      overflow: "hidden",
      minHeight: 190,
      justifyContent: "space-between",
    },
    watermark: {
      position: "absolute",
      right: -30,
      bottom: -30,
      width: 180,
      height: 180,
      opacity: 0.12,
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    cardBrand: { width: 150, height: 40 },
    typeBadge: {
      backgroundColor: palette.accent,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    typeBadgeAlt: { backgroundColor: "#3f9e6e" },
    typeBadgeText: {
      color: palette.navy900,
      fontWeight: "800",
      fontSize: 11,
      letterSpacing: 1,
    },
    cardHolder: {
      color: palette.onNavy,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 14,
    },
    cardNumber: {
      color: palette.onNavy,
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: 4,
      marginTop: 4,
      marginBottom: 14,
      fontVariant: ["tabular-nums"],
    },
    cardBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    statLabel: {
      color: palette.onNavyMuted,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    statValue: {
      color: palette.onNavy,
      fontSize: 22,
      fontWeight: "800",
      marginTop: 2,
    },
    cardFooter: {
      color: palette.accent,
      fontWeight: "800",
      fontSize: 14,
      letterSpacing: 3,
    },
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    lineCode: {
      fontWeight: "800",
      fontSize: 13,
      color: "#ffffff",
      backgroundColor: palette.blue,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    lineName: { fontSize: 14.5, fontWeight: "700", color: palette.ink },
    star: { paddingHorizontal: 4, paddingVertical: 2 },
    starIcon: { fontSize: 22, color: palette.ink3 },
    starIconActive: { color: palette.accent },
    emptyFav: { fontSize: 13, color: palette.ink3, lineHeight: 19 },
    favCard: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: radius.control,
      padding: 12,
      marginBottom: 10,
    },
    favName: { fontSize: 14.5, fontWeight: "800", color: palette.ink },
    favPeaks: {
      fontSize: 12.5,
      color: palette.blue,
      fontWeight: "700",
      marginTop: 3,
      marginBottom: 10,
    },
    hint: { fontSize: 12.5, color: palette.ink3, marginTop: 10, lineHeight: 17 },
  });
}
