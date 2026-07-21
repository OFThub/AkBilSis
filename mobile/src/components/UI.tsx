import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius } from "../theme";

/** Lacivert ekran başlığı — belediye amblemi + başlık */
export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Image
        source={require("../../assets/logo.png")}
        style={styles.headerLogo}
        resizeMode="contain"
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = "accent",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "accent" | "navy" | "danger";
}) {
  const bg =
    tone === "navy"
      ? colors.navy700
      : tone === "danger"
      ? colors.danger
      : colors.accent;
  const fg = tone === "accent" ? colors.navy900 : "#ffffff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function InfoBanner({
  text,
  tone = "info",
}: {
  text: string;
  tone?: "info" | "error" | "success";
}) {
  const palette = {
    info: { bg: colors.chipBlueBg, fg: colors.blue },
    error: { bg: "#fbe9e7", fg: colors.danger },
    success: { bg: "#e5f3ec", fg: colors.success },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Text style={[styles.bannerText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy900,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  headerLogo: { width: 40, height: 40 },
  headerTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  headerSubtitle: { color: "#b9c3de", fontSize: 12, marginTop: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink3,
    marginBottom: 10,
  },
  button: {
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonLabel: { fontSize: 16, fontWeight: "800" },
  banner: {
    borderRadius: radius.control,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { fontSize: 13.5, fontWeight: "600", lineHeight: 19 },
});
