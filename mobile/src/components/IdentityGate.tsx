import React from "react";
import { StyleSheet, Text } from "react-native";
import { useApp } from "../context/AppContext";
import { colors } from "../theme";
import { CardUser } from "../types";
import UserPicker from "./UserPicker";
import { SectionCard, SectionTitle } from "./UI";

/**
 * Kimlik kapısı — Yolculuk ve Geçmiş ekranları bu seçimden geçmeden
 * içeriklerini göstermez. Kullanıcı kayıtlı listeden seçilerek doğrulanır.
 *
 * Kimlik bileşenin dışında (ekranın state'inde) tutulur; sekmeden çıkınca
 * ekran unmount olduğu için kimlik kendiliğinden düşer.
 */
export default function IdentityGate({
  title,
  hint,
  onIdentified,
}: {
  title: string;
  hint: string;
  onIdentified: (user: CardUser) => void;
}) {
  const app = useApp();

  return (
    <SectionCard>
      <SectionTitle>{title}</SectionTitle>
      <UserPicker users={app.users} onSelect={onIdentified} />
      <Text style={styles.hint}>{hint}</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: colors.ink3, marginTop: 10, lineHeight: 17 },
});
