import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { checkHealth } from "../api/client";
import { useApp } from "../context/AppContext";
import { colors, radius } from "../theme";
import {
  Header,
  InfoBanner,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsScreen() {
  const app = useApp();
  const [urlDraft, setUrlDraft] = useState(app.settings.backendUrl);
  const [testResult, setTestResult] = useState<
    { ok: boolean; text: string } | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    app.updateSettings({ backendUrl: urlDraft });
    const ok = await checkHealth(urlDraft);
    setTesting(false);
    setTestResult(
      ok
        ? { ok: true, text: "Bağlantı başarılı — izleme merkezi erişilebilir." }
        : {
            ok: false,
            text: "Sunucuya ulaşılamadı. Backend'in çalıştığından ve adresin doğru olduğundan emin olun.",
          }
    );
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    app.resetAll();
    setConfirmReset(false);
    setTestResult(null);
  }

  return (
    <View style={styles.root}>
      <Header title="Ayarlar" subtitle="Bağlantı ve simülasyon" />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard>
          <SectionTitle>İzleme merkezi adresi</SectionTitle>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://192.168.1.20:4000"
            placeholderTextColor={colors.ink3}
          />
          <Text style={styles.hint}>
            Telefonla test ederken bilgisayarınızın ağ adresini kullanın —
            backend açılırken "Ağ (mobil)" satırında yazar. Bilgisayarda web
            modunda http://localhost:4000 yeterli.
          </Text>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={testing ? "Deneniyor…" : "Kaydet ve Bağlantıyı Test Et"}
              onPress={handleTest}
              disabled={testing}
              tone="navy"
            />
          </View>
          {testResult && (
            <View style={{ marginTop: 12 }}>
              <InfoBanner
                tone={testResult.ok ? "success" : "error"}
                text={testResult.text}
              />
            </View>
          )}
        </SectionCard>

        <SectionCard>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Demo saat modu</Text>
              <Text style={styles.hint}>
                Biniş saatini elle seçin — grafiklerde farklı saatlere veri
                üretmek için. Kapalıyken gerçek saat kullanılır.
              </Text>
            </View>
            <Switch
              value={app.settings.demoMode}
              onValueChange={(value) => app.updateSettings({ demoMode: value })}
              trackColor={{ true: colors.blue, false: colors.line }}
              thumbColor="#ffffff"
            />
          </View>
          {app.settings.demoMode && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
              contentContainerStyle={styles.hourRow}
            >
              {HOURS.map((hour) => {
                const active = app.settings.demoHour === hour;
                return (
                  <Pressable
                    key={hour}
                    onPress={() => app.updateSettings({ demoHour: hour })}
                    style={[styles.hourChip, active && styles.hourChipActive]}
                  >
                    <Text
                      style={[
                        styles.hourText,
                        active && styles.hourTextActive,
                      ]}
                    >
                      {String(hour).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </SectionCard>

        <SectionCard>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>NFC</Text>
              <Text style={styles.hint}>
                Açık: kart okutulur, etiketin kimliğine bağlı kayıtlı kullanıcı
                bulunur — kullanıcı listesi gösterilmez. Kapalı: NFC tamamen
                devre dışı kalır, kullanıcı kayıtlı listeden seçilir — okutma
                arayüzü gösterilmez. Expo Go native NFC içermediği için orada
                kapalı kullanın.
              </Text>
            </View>
            <Switch
              value={app.settings.nfcEnabled}
              onValueChange={(value) =>
                app.updateSettings({ nfcEnabled: value })
              }
              trackColor={{ true: colors.blue, false: colors.line }}
              thumbColor="#ffffff"
            />
          </View>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Uygulama</SectionTitle>
          <PrimaryButton
            label={
              confirmReset
                ? "Emin misiniz? Tekrar dokunun"
                : "Uygulamayı Sıfırla"
            }
            onPress={handleReset}
            tone="danger"
          />
          <Text style={styles.hint}>
            Aktif yolculuk ve yolculuk geçmişi silinir; izleme merkezi adresi
            ile NFC modu korunur. Karttaki bakiye etikette durduğu için
            etkilenmez.
          </Text>
        </SectionCard>

        <Text style={styles.footer}>
          Arnavutköy Belediyesi — Akbil Simülasyon Projesi
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 28 },
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
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: 8, lineHeight: 17 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  hourRow: { gap: 8, paddingRight: 8 },
  hourChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  hourChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  hourText: { fontWeight: "700", color: colors.ink2, fontSize: 14 },
  hourTextActive: { color: "#ffffff" },
  footer: {
    textAlign: "center",
    color: colors.ink3,
    fontSize: 12,
    marginTop: 10,
  },
});
