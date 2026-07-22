import React, { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApp } from "../context/AppContext";
import { LINES, peakHours } from "../data/lines";
import { colors, radius } from "../theme";
import { hourRange, randomCardNo } from "../utils/format";
import BusyChart from "../components/BusyChart";
import {
  Header,
  InfoBanner,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import UserPicker from "../components/UserPicker";
import { CardType, CardUser } from "../types";

type Notice = { tone: "info" | "error" | "success"; text: string } | null;

/**
 * Kart işlemleri. Kullanıcı kayıtlı listeden seçilir; seçilen kartın profili,
 * favori hatları ve yolculuk sayısı gösterilir.
 */
export default function CardScreen() {
  const app = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [newName, setNewName] = useState("");
  const [newCardNo, setNewCardNo] = useState(randomCardNo());
  const [newType, setNewType] = useState<CardType>("tam");

  const selected = app.users.find((u) => u.id === selectedId) ?? null;

  // Grafikte vurgulanan saat — demo saat modu açıkken onunla tutarlı olsun
  const currentHour = app.settings.demoMode
    ? app.settings.demoHour
    : new Date().getHours();

  // Favoriler karta özeldir: bir kullanıcı seçilmeden ne görülür ne değiştirilebilir
  const favoriteIds = selected ? app.favoritesFor(selected.id) : [];
  const favoriteLines = LINES.filter((line) => favoriteIds.includes(line.id));

  // Profil kartındaki sayaç — seçili karta ait yerel yolculuk sayısı
  const tripCount = selected
    ? app.history.filter((r) => r.cardNo === selected.cardNo).length
    : 0;

  function handleAddUser() {
    const result = app.addUser(newName, newCardNo, newType);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Kullanıcı eklenemedi." });
      return;
    }
    setNotice({
      tone: "success",
      text: `${newName.trim()} kayıtlı kullanıcılara eklendi.`,
    });
    setNewName("");
    setNewCardNo(randomCardNo());
  }

  function handleRemove(user: CardUser) {
    app.removeUser(user.id);
    if (selectedId === user.id) setSelectedId(null);
    setNotice({ tone: "info", text: `${user.name} listeden kaldırıldı.` });
  }

  return (
    <View style={styles.root}>
      <Header title="Kart" subtitle="Kayıtlı kullanıcı kartları" />
      <ScrollView contentContainerStyle={styles.content}>
        {selected ? (
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
              <View
                style={[
                  styles.typeBadge,
                  selected.cardType === "ogrenci" && styles.typeBadgeStudent,
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {selected.cardType === "tam" ? "TAM" : "ÖĞRENCİ"}
                </Text>
              </View>
            </View>
            <Text style={styles.cardHolder}>{selected.name}</Text>
            <Text style={styles.cardNumber}>{selected.cardNo}</Text>
            <View style={styles.cardBottomRow}>
              <View>
                <Text style={styles.statLabel}>Yolculuk</Text>
                <Text style={styles.statValue}>{tripCount}</Text>
              </View>
              <Text style={styles.cardFooter}>AKBİL</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.virtualCard, styles.cardPlaceholder]}>
            <Text style={styles.placeholderTitle}>Kullanıcı seçilmedi</Text>
            <Text style={styles.placeholderText}>
              Aşağıdaki listeden bir kullanıcı seçin.
            </Text>
          </View>
        )}

        {notice && <InfoBanner tone={notice.tone} text={notice.text} />}

        <SectionCard>
          <SectionTitle>Kayıtlı kullanıcılar</SectionTitle>
          <UserPicker
            users={app.users}
            selectedId={selectedId}
            onSelect={(u) => {
              setSelectedId(u.id);
              setNotice(null);
            }}
            onRemove={handleRemove}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>Yeni kullanıcı</SectionTitle>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            style={styles.input}
            placeholder="Ad Soyad"
            placeholderTextColor={colors.ink3}
          />
          <TextInput
            value={newCardNo}
            onChangeText={setNewCardNo}
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Kart no — örn. 1042 7316"
            placeholderTextColor={colors.ink3}
          />
          <View style={[styles.typeRow, { marginTop: 10 }]}>
            {(["tam", "ogrenci"] as CardType[]).map((type) => {
              const active = newType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setNewType(type)}
                  style={[styles.typeOption, active && styles.typeOptionActive]}
                >
                  <Text
                    style={[
                      styles.typeOptionLabel,
                      active && styles.typeOptionLabelActive,
                    ]}
                  >
                    {type === "tam" ? "Tam" : "Öğrenci"}
                  </Text>
                  <Text
                    style={[
                      styles.typeOptionFare,
                      active && styles.typeOptionLabelActive,
                    ]}
                  >
                    {type === "tam" ? "Tam tarife" : "İndirimli statü"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Kullanıcı Ekle" onPress={handleAddUser} />
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Tüm hatlar</SectionTitle>
          {LINES.map((line) => (
            <LineRow
              key={line.id}
              code={line.code}
              name={line.name.replace(`${line.code} `, "")}
              stopCount={line.stops.length}
              favorite={favoriteIds.includes(line.id)}
              locked={!selected}
              onToggle={() =>
                selected && app.toggleFavorite(selected.id, line.id)
              }
            />
          ))}
          <Text style={styles.hint}>
            {selected
              ? `Yıldıza dokunduğunuz hatlar ${selected.name} kartının favorilerine eklenir.`
              : "Favori eklemek için önce yukarıdan bir kullanıcı seçin — favoriler karta özeldir."}
          </Text>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Favori hatlar</SectionTitle>
          {!selected ? (
            <Text style={styles.emptyFav}>
              Kullanıcı seçilince o karta ait favori hatlar burada görünür.
            </Text>
          ) : favoriteLines.length === 0 ? (
            <Text style={styles.emptyFav}>
              {selected.name} için henüz favori hat yok — yukarıdaki listeden
              yıldıza dokunun.
            </Text>
          ) : (
            favoriteLines.map((line) => (
              <FavoriteLine
                key={line.id}
                name={line.name}
                hourly={line.hourly}
                currentHour={currentHour}
                peaks={peakHours(line)}
              />
            ))
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

/** Hat listesi satırı — kod rozeti, ad, durak sayısı ve favori yıldızı */
function LineRow({
  code,
  name,
  stopCount,
  favorite,
  locked,
  onToggle,
}: {
  code: string;
  name: string;
  stopCount: number;
  favorite: boolean;
  /** Kart okutulmadı — yıldız pasif, favori değiştirilemez */
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineCode}>{code}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.lineMeta}>{stopCount} durak</Text>
      </View>
      <Pressable
        onPress={onToggle}
        disabled={locked}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={
          locked
            ? `${code} hattını favorilemek için önce kullanıcı seçin`
            : favorite
            ? `${code} hattını favorilerden çıkar`
            : `${code} hattını favorile`
        }
        style={({ pressed }) => [styles.star, pressed && { opacity: 0.6 }]}
      >
        <Text
          style={[
            styles.starIcon,
            favorite && styles.starIconActive,
            locked && styles.starIconLocked,
          ]}
        >
          {locked ? "🔒" : favorite ? "★" : "☆"}
        </Text>
      </Pressable>
    </View>
  );
}

/** Favori hat kartı — en yoğun saatler + gün içi yoğunluk grafiği */
function FavoriteLine({
  name,
  hourly,
  currentHour,
  peaks,
}: {
  name: string;
  hourly: number[];
  currentHour: number;
  peaks: number[];
}) {
  return (
    <View style={styles.favCard}>
      <Text style={styles.favName}>{name}</Text>
      <Text style={styles.favPeaks}>
        En yoğun: {peaks.map(hourRange).join(" · ")}
      </Text>
      <BusyChart hourly={hourly} currentHour={currentHour} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28 },
  virtualCard: {
    backgroundColor: colors.navy900,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    minHeight: 190,
    justifyContent: "space-between",
  },
  cardPlaceholder: { alignItems: "center", justifyContent: "center", gap: 6 },
  placeholderTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  placeholderText: {
    color: "#b9c3de",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 270,
    lineHeight: 18,
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
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  typeBadgeStudent: { backgroundColor: "#3f9e6e" },
  typeBadgeText: {
    color: colors.navy900,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },
  cardHolder: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },
  cardNumber: {
    color: "#ffffff",
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
    color: "#b9c3de",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lineCode: {
    fontWeight: "800",
    fontSize: 13,
    color: "#ffffff",
    backgroundColor: colors.blue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  lineName: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  lineMeta: { fontSize: 12, color: colors.ink3, marginTop: 2 },
  star: { paddingHorizontal: 4, paddingVertical: 2 },
  starIcon: { fontSize: 22, color: colors.ink3 },
  starIconActive: { color: colors.accent },
  starIconLocked: { fontSize: 15, opacity: 0.5 },
  emptyFav: { fontSize: 13, color: colors.ink3, lineHeight: 19 },
  favCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    padding: 12,
    marginBottom: 10,
  },
  favName: { fontSize: 14.5, fontWeight: "800", color: colors.navy900 },
  favPeaks: {
    fontSize: 12.5,
    color: colors.blue,
    fontWeight: "700",
    marginTop: 3,
    marginBottom: 10,
  },
  cardFooter: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 3,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
  },
  typeOptionActive: {
    borderColor: colors.blue,
    backgroundColor: colors.chipBlueBg,
  },
  typeOptionLabel: { fontSize: 15, fontWeight: "700", color: colors.ink2 },
  typeOptionFare: { fontSize: 12.5, color: colors.ink3, fontWeight: "600" },
  typeOptionLabelActive: { color: colors.navy900 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: 10, lineHeight: 17 },
});
