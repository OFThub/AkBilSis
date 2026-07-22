import React, { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useApp } from "../context/AppContext";
import { usePalette } from "../hooks/useTheme";
import { useT } from "../i18n";
import { Palette, radius } from "../theme";
import { Field, InfoBanner, PrimaryButton } from "../components/UI";

type Mode = "login" | "register";

/**
 * Giriş ve kayıt. Uygulamaya başka hiçbir yoldan girilemez: oturum yoksa
 * App.tsx yalnızca bu ekranı gösterir.
 */
export default function AuthScreen() {
  const app = useApp();
  const t = useT();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
  }

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = isLogin
      ? await app.login(email, password)
      : await app.register(fullName, email, password);

    // Başarılıysa AppContext oturumu kurar ve App.tsx sekmelere geçer; bu
    // bileşen unmount olacağı için ek bir işlem gerekmez
    if (!result.ok) {
      setError(result.error ?? t("loginAction"));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.crest}
            resizeMode="contain"
          />
          <Text style={styles.appName}>{t("appName")}</Text>
          <Text style={styles.tagline}>
            {isLogin ? t("loginSubtitle") : t("registerSubtitle")}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            {(["login", "register"] as Mode[]).map((option) => {
              const active = mode === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => switchMode(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {option === "login" ? t("loginTitle") : t("registerTitle")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <InfoBanner tone="error" text={error} /> : null}

          {!isLogin && (
            <Field
              label={t("fullName")}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
            />
          )}

          <Field
            label={t("email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />

          <Field
            label={t("password")}
            hint={isLogin ? undefined : t("passwordHint")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          <PrimaryButton
            label={
              busy ? t("pleaseWait") : isLogin ? t("loginAction") : t("registerAction")
            }
            onPress={handleSubmit}
            disabled={busy}
          />

          <Pressable
            onPress={() => switchMode(isLogin ? "register" : "login")}
            hitSlop={8}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {isLogin ? t("toRegister") : t("toLogin")}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>{t("municipality")}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.navy900 },
    content: { padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: "center" },
    brand: { alignItems: "center", marginBottom: 26, gap: 8 },
    crest: { width: 76, height: 76 },
    appName: { color: palette.onNavy, fontSize: 22, fontWeight: "800" },
    tagline: {
      color: palette.onNavyMuted,
      fontSize: 13.5,
      textAlign: "center",
      maxWidth: 280,
      lineHeight: 19,
    },
    card: {
      backgroundColor: palette.card,
      borderRadius: 18,
      padding: 20,
    },
    tabs: {
      flexDirection: "row",
      gap: 6,
      backgroundColor: palette.surface,
      borderRadius: radius.control,
      padding: 4,
      marginBottom: 18,
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    tabActive: { backgroundColor: palette.card },
    tabLabel: { fontSize: 14.5, fontWeight: "700", color: palette.ink2 },
    tabLabelActive: { color: palette.navy900, fontWeight: "800" },
    switchRow: { marginTop: 16, alignItems: "center" },
    switchText: { fontSize: 13, fontWeight: "600", color: palette.blue },
    footer: {
      color: palette.onNavyMuted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 26,
    },
  });
}
