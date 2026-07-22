import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePalette } from "../hooks/useTheme";
import { Palette } from "../theme";

const MAX_BAR_HEIGHT = 46;
const AXIS_LABELS = ["00", "06", "12", "18", "23"];

/**
 * Hattın gün içi yoğunluk profili — 24 sütunlu mini grafik.
 * Saf View'lerle çizilir; grafik kütüphanesi bağımlılığı yoktur.
 *
 * Veri `Line.hourly_profile` alanından, yani sunucudan gelir.
 */
export default function BusyChart({
  hourly,
  currentHour,
}: {
  hourly: number[];
  currentHour: number;
}) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

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

function makeStyles(palette: Palette) {
  return StyleSheet.create({
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
      backgroundColor: palette.blue,
      opacity: 0.4,
    },
    // İçinde bulunulan saat vurgulu — grafikte "şu an neredeyiz" okunsun
    barNow: { backgroundColor: palette.accent, opacity: 1 },
    axis: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 5,
    },
    axisLabel: {
      fontSize: 10,
      color: palette.ink3,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
  });
}
