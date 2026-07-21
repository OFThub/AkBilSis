import React, { useEffect, useState } from "react";
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
import { formatTL, randomCardNo } from "../utils/format";
import {
  Header,
  InfoBanner,
  PrimaryButton,
  SectionCard,
  SectionTitle,
} from "../components/UI";
import NfcPrompt from "../components/NfcPrompt";
import UserPicker from "../components/UserPicker";
import { NfcError, cancelCardScan, readTagId } from "../nfc/nfcCard";
import { CardType, CardUser } from "../types";

const TOP_UP_AMOUNTS = [50, 100, 250];

type Notice = { tone: "info" | "error" | "success"; text: string } | null;

/**
 * Kart işlemleri. İki mod birbirini dışlar:
 *  - NFC açık   → yalnızca etiket okutma; kullanıcı listesi hiç gösterilmez
 *  - NFC kapalı → yalnızca kayıtlı kullanıcı listesi; okutma arayüzü gösterilmez
 */
export default function CardScreen() {
  const app = useApp();
  const nfcOn = app.settings.nfcEnabled;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [amount, setAmount] = useState(TOP_UP_AMOUNTS[0]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  /** Okunan ama hiçbir kullanıcıya bağlı olmayan etiket */
  const [unknownTagId, setUnknownTagId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCardNo, setNewCardNo] = useState(randomCardNo());
  const [newType, setNewType] = useState<CardType>("tam");

  const selected = app.users.find((u) => u.id === selectedId) ?? null;

  // Ekrandan çıkarken açık NFC oturumunu kapat
  useEffect(() => () => cancelCardScan(), []);

  // Mod değişince diğer modun geçici durumunu temizle
  useEffect(() => {
    setSelectedId(null);
    setUnknownTagId(null);
    setScanError(null);
    setNotice(null);
  }, [nfcOn]);

  async function handleScan() {
    setNotice(null);
    setScanError(null);
    setUnknownTagId(null);
    setScanning(true);
    try {
      const tagId = await readTagId();
      const user = app.findUserByTagId(tagId);
      if (user) {
        setSelectedId(user.id);
        setNotice({
          tone: "success",
          text: `${user.name} — bakiye ${formatTL(user.balance)}.`,
        });
      } else {
        setSelectedId(null);
        setUnknownTagId(tagId);
        setNotice({
          tone: "info",
          text: `Bu etiket (${tagId}) kayıtlı değil. Aşağıdan bu etikete bir kullanıcı tanımlayabilirsiniz.`,
        });
      }
    } catch (e) {
      const err = e as NfcError;
      if (err.code !== "cancelled") setScanError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function handleTopUp() {
    if (!selected) {
      setNotice({
        tone: "error",
        text: nfcOn ? "Önce kartı okutun." : "Önce listeden kullanıcı seçin.",
      });
      return;
    }
    const result = app.topUp(selected.id, amount);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Yükleme yapılamadı." });
      return;
    }
    setNotice({
      tone: "success",
      text: `${selected.name} kartına ${formatTL(amount)} yüklendi.`,
    });
  }

  function handleAddUser() {
    const result = app.addUser(
      newName,
      newCardNo,
      newType,
      unknownTagId ?? undefined
    );
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Kullanıcı eklenemedi." });
      return;
    }
    setNotice({
      tone: "success",
      text: unknownTagId
        ? `${newName.trim()} eklendi ve okunan etikete bağlandı.`
        : `${newName.trim()} kayıtlı kullanıcılara eklendi.`,
    });
    setNewName("");
    setNewCardNo(randomCardNo());
    setUnknownTagId(null);
  }

  function handleRemove(user: CardUser) {
    app.removeUser(user.id);
    if (selectedId === user.id) setSelectedId(null);
    setNotice({ tone: "info", text: `${user.name} listeden kaldırıldı.` });
  }

  return (
    <View style={styles.root}>
      <Header
        title="Kart"
        subtitle={nfcOn ? "NFC ile kart işlemleri" : "Kayıtlı kullanıcı kartları"}
      />
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
                <Text style={styles.balanceLabel}>Bakiye</Text>
                <Text style={styles.balanceValue}>
                  {formatTL(selected.balance)}
                </Text>
              </View>
              <Text style={styles.cardFooter}>AKBİL</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.virtualCard, styles.cardPlaceholder]}>
            <Text style={styles.placeholderTitle}>
              {nfcOn ? "Kart okutulmadı" : "Kullanıcı seçilmedi"}
            </Text>
            <Text style={styles.placeholderText}>
              {nfcOn
                ? "Kartı okutun; etiketin kimliğine bağlı kullanıcı burada görünür."
                : "Aşağıdaki listeden bir kullanıcı seçin."}
            </Text>
          </View>
        )}

        {notice && <InfoBanner tone={notice.tone} text={notice.text} />}

        {/* ── NFC AÇIK: yalnızca okutma ── */}
        {nfcOn && (
          <SectionCard>
            <SectionTitle>Kart okut</SectionTitle>
            {scanning || scanError ? (
              <NfcPrompt
                state={scanError ? "error" : "waiting"}
                error={scanError ?? undefined}
                onRetry={handleScan}
                onCancel={() => {
                  cancelCardScan();
                  setScanning(false);
                  setScanError(null);
                }}
              />
            ) : (
              <PrimaryButton label="Kartı Okut" onPress={handleScan} />
            )}
            <Text style={styles.hint}>
              Etiket yalnızca kimlik sağlar; bakiye ve kart bilgisi uygulamadaki
              kayıtta tutulur, etikete hiçbir şey yazılmaz.
            </Text>
          </SectionCard>
        )}

        {/* ── NFC KAPALI: yalnızca kullanıcı listesi ── */}
        {!nfcOn && (
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
        )}

        <SectionCard>
          <SectionTitle>Bakiye yükle</SectionTitle>
          <View style={styles.amountRow}>
            {TOP_UP_AMOUNTS.map((value) => {
              const active = amount === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setAmount(value)}
                  style={[styles.amountChip, active && styles.amountChipActive]}
                >
                  <Text
                    style={[
                      styles.amountLabel,
                      active && styles.amountLabelActive,
                    ]}
                  >
                    +{formatTL(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            label={
              selected
                ? `${selected.name} kartına ${formatTL(amount)} yükle`
                : `${formatTL(amount)} Yükle`
            }
            onPress={handleTopUp}
            disabled={!selected}
          />
        </SectionCard>

        <SectionCard>
          <SectionTitle>
            {unknownTagId ? "Bu etikete kullanıcı tanımla" : "Yeni kullanıcı"}
          </SectionTitle>
          {unknownTagId && (
            <Text style={styles.tagLine}>Etiket kimliği: {unknownTagId}</Text>
          )}
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
                    {formatTL(FARES[type])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={unknownTagId ? "Ekle ve Etikete Bağla" : "Kullanıcı Ekle"}
              onPress={handleAddUser}
            />
          </View>
          <Text style={styles.hint}>Yeni kullanıcı ₺0,00 bakiye ile başlar.</Text>
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
  amountRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  amountChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingVertical: 12,
    alignItems: "center",
  },
  amountChipActive: {
    borderColor: colors.blue,
    backgroundColor: colors.chipBlueBg,
  },
  amountLabel: { fontSize: 15, fontWeight: "800", color: colors.ink2 },
  amountLabelActive: { color: colors.navy900 },
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
  tagLine: {
    fontSize: 12.5,
    color: colors.blue,
    fontWeight: "700",
    marginBottom: 10,
  },
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: 10, lineHeight: 17 },
});
