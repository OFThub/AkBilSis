import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { usePalette } from "../hooks/useTheme";
import { Palette, radius } from "../theme";

/** Lacivert ekran başlığı — belediye amblemi + başlık */
export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const background =
    tone === "navy"
      ? palette.navy700
      : tone === "danger"
      ? palette.danger
      : palette.accent;
  const foreground = tone === "accent" ? palette.navy900 : "#ffffff";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
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
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const scheme = {
    info: { bg: palette.chipBlueBg, fg: palette.blue },
    error: { bg: palette.chipAmberBg, fg: palette.danger },
    success: { bg: palette.chipBlueBg, fg: palette.success },
  }[tone];

  return (
    <View style={[styles.banner, { backgroundColor: scheme.bg }]}>
      <Text style={[styles.bannerText, { color: scheme.fg }]}>{text}</Text>
    </View>
  );
}

/** Form alanı — etiket + girdi, tema renkleriyle */
export function Field({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string } & TextInputProps) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={palette.ink3}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/** Veri beklenirken gösterilen ortalanmış gösterge */
export function LoadingBlock({ label }: { label: string }) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.blue} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    header: {
      backgroundColor: palette.navy900,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 3,
      borderBottomColor: palette.accent,
    },
    headerLogo: { width: 40, height: 40 },
    headerTitle: { color: palette.onNavy, fontSize: 18, fontWeight: "800" },
    headerSubtitle: { color: palette.onNavyMuted, fontSize: 12, marginTop: 1 },
    card: {
      backgroundColor: palette.card,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: palette.line,
      padding: 16,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: palette.ink3,
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
    field: { marginBottom: 14 },
    fieldLabel: {
      fontSize: 11.5,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
      color: palette.ink3,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: radius.control,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "600",
      color: palette.ink,
      backgroundColor: palette.surface,
    },
    fieldHint: { fontSize: 12, color: palette.ink3, marginTop: 5 },
    loading: { paddingVertical: 40, alignItems: "center", gap: 10 },
    loadingText: { fontSize: 13.5, color: palette.ink3, fontWeight: "600" },
  });
}
