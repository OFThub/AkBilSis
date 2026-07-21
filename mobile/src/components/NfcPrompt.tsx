import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { PrimaryButton } from "./UI";

/**
 * NFC okuma bekleme paneli. state="waiting" iken kart bekler; hata durumunda
 * mesaj + Tekrar Okut gösterir. onCancel verilmezse panelden çıkış yolu yoktur
 * (iniş akışı: NFC okutmadan geri gidilemez).
 */
export default function NfcPrompt({
  state,
  error,
  onRetry,
  onCancel,
}: {
  state: "waiting" | "error";
  error?: string;
  onRetry: () => void;
  onCancel?: () => void;
}) {
  return (
    <View style={styles.panel}>
      {state === "waiting" ? (
        <>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.title}>Kartınızı okutun</Text>
          <Text style={styles.text}>
            Akbil kartını telefonun arkasına yaklaştırın ve okuma bitene dek
            sabit tutun.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.title}>Okuma başarısız</Text>
          <Text style={styles.text}>{error ?? "Kart okunamadı."}</Text>
          <View style={styles.actions}>
            <PrimaryButton label="Tekrar Okut" onPress={onRetry} />
          </View>
        </>
      )}
      {onCancel && (
        <View style={styles.actions}>
          <PrimaryButton label="Vazgeç" onPress={onCancel} tone="navy" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.navy900,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 6,
  },
  text: {
    color: "#b9c3de",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 19,
  },
  errorIcon: { fontSize: 30 },
  actions: { alignSelf: "stretch", marginTop: 8 },
});
