import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const MAX_BAR_HEIGHT = 46;
const AXIS_LABELS = ["00", "06", "12", "18", "23"];

/**
 * Hattın gün içi yoğunluk profili — 24 sütunlu mini grafik.
 * Saf View'lerle çizilir; grafik kütüphanesi bağımlılığı yoktur.
 */
export default function BusyChart({
  hourly,
  currentHour,
}: {
  hourly: number[];
  currentHour: number;
}) {
  // En yoğun saat tam yükseklik olsun; boş profilde sıfıra bölmeyi engelle
  const peak = Math.max(...hourly, 1);

  return (
    <View>
      <View style={styles.bars}>
        {hourly.map((value, hour) => (
          <View key={hour} style={styles.slot}>
            <View
              style={[
                styles.bar,
                { height: Math.max(2, (value / peak) * MAX_BAR_HEIGHT) },
                hour === currentHour && styles.barNow,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        {AXIS_LABELS.map((label) => (
          <Text key={label} style={styles.axisLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: MAX_BAR_HEIGHT,
    gap: 2,
  },
  slot: { flex: 1, justifyContent: "flex-end" },
  bar: {
    width: "100%",
    borderRadius: 2,
    backgroundColor: colors.blue,
    opacity: 0.4,
  },
  // İçinde bulunulan saat vurgulu — grafikte "şu an neredeyiz" okunsun
  barNow: { backgroundColor: colors.accent, opacity: 1 },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.ink3,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
