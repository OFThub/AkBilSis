import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppProvider, useApp } from "./src/context/AppContext";
import { colors } from "./src/theme";
import TripScreen from "./src/screens/TripScreen";
import CardScreen from "./src/screens/CardScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

type TabKey = "trip" | "card" | "history" | "settings";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "trip", label: "Yolculuk", icon: "🚌" },
  { key: "card", label: "Kart", icon: "💳" },
  { key: "history", label: "Geçmiş", icon: "🕓" },
  { key: "settings", label: "Ayarlar", icon: "⚙️" },
];

function Shell() {
  const app = useApp();
  const [tab, setTab] = useState<TabKey>("trip");

  if (!app.ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashText}>Arnavutköy Akbil</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={{ flex: 1 }}>
        {tab === "trip" && <TripScreen />}
        {tab === "card" && <CardScreen />}
        {tab === "history" && <HistoryScreen />}
        {tab === "settings" && <SettingsScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const showBadge = t.key === "history" && app.pendingCount > 0;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={styles.tabItem}
            >
              <View>
                <Text style={[styles.tabIcon, !active && styles.tabInactive]}>
                  {t.icon}
                </Text>
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{app.pendingCount}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  active ? styles.tabLabelActive : styles.tabInactive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <Shell />
        </SafeAreaView>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Güvenli alan boşluğunu SafeAreaView kendisi verir — elle status bar payı eklenmez
  safe: {
    flex: 1,
    backgroundColor: colors.navy900,
  },
  shell: { flex: 1, backgroundColor: colors.surface },
  splash: {
    flex: 1,
    backgroundColor: colors.navy900,
    alignItems: "center",
    justifyContent: "center",
  },
  splashText: { color: "#ffffff", fontSize: 20, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.navy900,
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    paddingBottom: Platform.OS === "ios" ? 14 : 8,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11.5, fontWeight: "700", color: "#ffffff" },
  tabLabelActive: { color: colors.accent },
  tabInactive: { opacity: 0.55 },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.navy900, fontSize: 10, fontWeight: "800" },
});
