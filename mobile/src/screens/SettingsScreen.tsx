import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../context/AppContext";
import { usePalette } from "../hooks/useTheme";
import { useT } from "../i18n";
import { Palette, radius } from "../theme";
import { Header, PrimaryButton, SectionCard, SectionTitle } from "../components/UI";
import { Language, ThemeMode } from "../types";

/**
 * Ayarlar — **sunucuya hiçbir istek atmaz.**
 *
 * Tema ve dil yalnızca telefonda (AsyncStorage) saklanır. Bağlantı testi,
 * sunucu adresi ve veri sıfırlama gibi geliştirici işlevleri bilinçli olarak
 * yoktur; kullanıcıya dönük tek sunucu işlemi çıkıştır, o da yalnızca yerel
 * oturumu siler.
 */
export default function SettingsScreen() {
  const app = useApp();
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const themes: { value: ThemeMode; label: string }[] = [
    { value: "light", label: t("themeLight") },
    { value: "dark", label: t("themeDark") },
  ];

  const languages: { value: Language; label: string }[] = [
    { value: "tr", label: "Türkçe" },
    { value: "en", label: "English" },
  ];

  return (
    <View style={styles.root}>
      <Header title={t("settingsTitle")} subtitle={t("settingsSubtitle")} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard>
          <SectionTitle>{t("appearance")}</SectionTitle>
          <View style={styles.options}>
            {themes.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                active={app.settings.theme === option.value}
                styles={styles}
                onPress={() => app.updateSettings({ theme: option.value })}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>{t("language")}</SectionTitle>
          <View style={styles.options}>
            {languages.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                active={app.settings.language === option.value}
                styles={styles}
                onPress={() => app.updateSettings({ language: option.value })}
              />
            ))}
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>{t("account")}</SectionTitle>
          <Text style={styles.accountName}>{app.passenger?.full_name ?? "—"}</Text>
          <Text style={styles.accountEmail}>{app.passenger?.email ?? ""}</Text>
          <View style={{ marginTop: 14 }}>
            <PrimaryButton label={t("logout")} onPress={app.logout} tone="danger" />
          </View>
        </SectionCard>

        <Text style={styles.note}>{t("settingsNote")}</Text>
        <Text style={styles.footer}>{t("municipality")}</Text>
      </ScrollView>
    </View>
  );
}

function OptionChip({
  label,
  active,
  styles,
  onPress,
}: {
  label: string;
  active: boolean;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.option, active && styles.optionActive]}
    >
      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.surface },
    content: { padding: 16, paddingBottom: 28 },
    options: { flexDirection: "row", gap: 10 },
    option: {
      flex: 1,
      borderWidth: 1,
      borderColor: palette.line,
      borderRadius: radius.control,
      paddingVertical: 13,
      alignItems: "center",
    },
    optionActive: { borderColor: palette.blue, backgroundColor: palette.chipBlueBg },
    optionLabel: { fontSize: 15, fontWeight: "700", color: palette.ink2 },
    optionLabelActive: { color: palette.blue, fontWeight: "800" },
    accountName: { fontSize: 16, fontWeight: "800", color: palette.ink },
    accountEmail: { fontSize: 13, color: palette.ink3, marginTop: 3 },
    note: {
      fontSize: 12.5,
      color: palette.ink3,
      lineHeight: 18,
      marginTop: 4,
      textAlign: "center",
    },
    footer: {
      textAlign: "center",
      color: palette.ink3,
      fontSize: 12,
      marginTop: 14,
    },
  });
}
