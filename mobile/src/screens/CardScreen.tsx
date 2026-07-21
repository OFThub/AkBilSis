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
import { FARES } from "../data/lines";
import { colors, radius } from "../theme";
import { formatTL } from "../utils/format";
import {
  Header,
  InfoBanner,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import { CardType } from "../types";

const TOP_UP_AMOUNTS = [50, 100, 250];

export default function CardScreen() {
  const app = useApp();
  const [error, setError] = useState<string | null>(null);

  function changeType(type: CardType) {
    setError(null);
    const result = app.setCardType(type);
    if (!result.ok) setError(result.error ?? "Kart tipi değiştirilemedi.");
  }

  return (
    <View style={styles.root}>
      <Header title="Kartım" subtitle="Sanal akbil kartınız" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Sanal kart: lacivert zemin + amblem filigranı */}
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
                app.card.cardType === "ogrenci" && styles.typeBadgeStudent,
              ]}
            >
              <Text style={styles.typeBadgeText}>
                {app.card.cardType === "tam" ? "TAM" : "ÖĞRENCİ"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardNumber}>{app.card.cardNo}</Text>
          <View style={styles.cardBottomRow}>
            <View>
              <Text style={styles.balanceLabel}>Bakiye</Text>
              <Text style={styles.balanceValue}>
                {formatTL(app.card.balance)}
              </Text>
            </View>
            <Text style={styles.cardFooter}>AKBİL</Text>
          </View>
        </View>

        {error && <InfoBanner tone="error" text={error} />}

        <SectionCard>
          <SectionTitle>Kart tipi</SectionTitle>
          <View style={styles.typeRow}>
            {(["tam", "ogrenci"] as CardType[]).map((type) => {
              const active = app.card.cardType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => changeType(type)}
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
                    {formatTL(FARES[type])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Bakiye yükle</SectionTitle>
          <View style={styles.topUpRow}>
            {TOP_UP_AMOUNTS.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => app.topUp(amount)}
                style={({ pressed }) => [
                  styles.topUpButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.topUpLabel}>+{formatTL(amount)}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Kart numarası</SectionTitle>
          <TextInput
            value={app.card.cardNo}
            onChangeText={app.setCardNo}
            style={styles.input}
            placeholder="Örn. 1042 7316"
            placeholderTextColor={colors.ink3}
          />
          <Text style={styles.hint}>
            Kayıtlar izleme merkezine bu numarayla gönderilir.
          </Text>
        </SectionCard>
      </ScrollView>
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
  cardNumber: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 4,
    marginVertical: 18,
    fontVariant: ["tabular-nums"],
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  balanceLabel: {
    color: "#b9c3de",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
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
  topUpRow: { flexDirection: "row", gap: 10 },
  topUpButton: {
    flex: 1,
    backgroundColor: colors.navy700,
    borderRadius: radius.control,
    paddingVertical: 13,
    alignItems: "center",
  },
  topUpLabel: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: 8, lineHeight: 17 },
});
