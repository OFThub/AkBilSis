import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider, useApp } from "./src/context/AppContext";
import { usePalette } from "./src/hooks/useTheme";
import { LanguageProvider, TranslationKey, useT } from "./src/i18n";
import { Palette } from "./src/theme";
import AuthScreen from "./src/screens/AuthScreen";
import TripScreen from "./src/screens/TripScreen";
import CardScreen from "./src/screens/CardScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

type TabKey = "trip" | "card" | "history" | "settings";

const TABS: { key: TabKey; labelKey: TranslationKey; icon: string }[] = [
  { key: "trip", labelKey: "tabTrip", icon: "🚌" },
  { key: "card", labelKey: "tabCard", icon: "💳" },
  { key: "history", labelKey: "tabHistory", icon: "🕓" },
  { key: "settings", labelKey: "tabSettings", icon: "⚙️" },
];

/**
 * Uygulama kabuğu.
 *
 * Oturum yoksa yalnızca giriş/kayıt ekranı gösterilir — sekmelere ulaşmanın
 * başka bir yolu yoktur. Kullanıcı listesi ve geliştirici kipi kaldırıldı.
 */
function Shell() {
  const app = useApp();
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [tab, setTab] = useState<TabKey>("trip");

  if (!app.ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>{t("appName")}</Text>
      </View>
    );
  }

  if (!app.passenger) return <AuthScreen />;

  return (
    <View style={styles.shell}>
      <View style={{ flex: 1 }}>
        {tab === "trip" && <TripScreen />}
        {tab === "card" && <CardScreen />}
        {tab === "history" && <HistoryScreen />}
        {tab === "settings" && <SettingsScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tabItem}
            >
              <Text style={[styles.tabIcon, !active && styles.tabInactive]}>
                {item.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  active ? styles.tabLabelActive : styles.tabInactive,
                ]}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Tema ve dil AppContext'teki ayarlardan beslenir */
function ThemedApp() {
  const app = useApp();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <LanguageProvider language={app.settings.language}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <Shell />
      </SafeAreaView>
    </LanguageProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    // Güvenli alan boşluğunu SafeAreaView verir — elle status bar payı eklenmez
    safe: { flex: 1, backgroundColor: palette.navy900 },
    shell: { flex: 1, backgroundColor: palette.surface },
    splash: {
      flex: 1,
      backgroundColor: palette.navy900,
      alignItems: "center",
      justifyContent: "center",
    },
    splashText: { color: palette.onNavy, fontSize: 20, fontWeight: "800" },
    tabBar: {
      flexDirection: "row",
      backgroundColor: palette.navy900,
      borderTopWidth: 3,
      borderTopColor: palette.accent,
      paddingBottom: Platform.OS === "ios" ? 14 : 8,
      paddingTop: 8,
    },
    tabItem: { flex: 1, alignItems: "center", gap: 2 },
    tabIcon: { fontSize: 20 },
    tabLabel: { fontSize: 11.5, fontWeight: "700", color: palette.onNavy },
    tabLabelActive: { color: palette.accent },
    tabInactive: { opacity: 0.55 },
  });
}
