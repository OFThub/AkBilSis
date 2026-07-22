import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { CardUser } from "../types";

/**
 * Kayıtlı kullanıcı listesi — kullanıcı buradan seçilerek doğrulanır.
 */
export default function UserPicker({
  users,
  selectedId,
  onSelect,
  onRemove,
}: {
  users: CardUser[];
  selectedId?: string | null;
  onSelect: (user: CardUser) => void;
  onRemove?: (user: CardUser) => void;
}) {
  if (users.length === 0) {
    return (
      <Text style={styles.empty}>
        Kayıtlı kullanıcı yok — aşağıdan yeni kullanıcı ekleyin.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {users.map((user) => {
        const active = user.id === selectedId;
        return (
          <Pressable
            key={user.id}
            onPress={() => onSelect(user)}
            style={({ pressed }) => [
              styles.row,
              active && styles.rowActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, active && styles.nameActive]}>
                {user.name}
              </Text>
              <Text style={styles.cardNo}>{user.cardNo}</Text>
            </View>
            <View style={styles.right}>
              <View
                style={[
                  styles.typeBadge,
                  user.cardType === "ogrenci" && styles.typeBadgeStudent,
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {user.cardType === "tam" ? "TAM" : "ÖĞRENCİ"}
                </Text>
              </View>
            </View>
            {onRemove && (
              <Pressable
                onPress={() => onRemove(user)}
                hitSlop={10}
                style={styles.removeBtn}
              >
                <Text style={styles.removeText}>Sil</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: {
    fontSize: 13.5,
    color: colors.ink3,
    lineHeight: 19,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowActive: { borderColor: colors.blue, backgroundColor: colors.chipBlueBg },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  nameActive: { color: colors.navy900, fontWeight: "800" },
  cardNo: {
    fontSize: 12.5,
    color: colors.ink3,
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  right: { alignItems: "flex-end", gap: 4 },
  typeBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeBadgeStudent: { backgroundColor: "#3f9e6e" },
  typeBadgeText: {
    color: colors.navy900,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  removeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  removeText: { fontSize: 12.5, color: colors.danger, fontWeight: "700" },
});
