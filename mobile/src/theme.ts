// Arnavutköy Belediyesi kimliği — web paneliyle aynı tonlar.
// Açık ve koyu tema aynı anahtarları taşır, böylece ekranlar tek bir
// `colors` nesnesiyle çalışır ve tema değişimi hiçbir bileşeni bozmaz.

export interface Palette {
  navy900: string;
  navy700: string;
  blue: string;
  amber: string;
  accent: string;
  surface: string;
  card: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  success: string;
  danger: string;
  chipBlueBg: string;
  chipAmberBg: string;
  /** Lacivert zemin üzerindeki metin — iki temada da açık kalır */
  onNavy: string;
  onNavyMuted: string;
}

export const lightPalette: Palette = {
  navy900: "#16224a",
  navy700: "#22376e",
  blue: "#2456a6",
  amber: "#c47a00",
  accent: "#f0a11c",
  surface: "#f4f6fa",
  card: "#ffffff",
  ink: "#1c2333",
  ink2: "#5a6478",
  ink3: "#8b93a7",
  line: "#e3e7f0",
  success: "#1d7a4f",
  danger: "#b3362c",
  chipBlueBg: "#eaf0fa",
  chipAmberBg: "#f8efdd",
  onNavy: "#ffffff",
  onNavyMuted: "#b9c3de",
};

export const darkPalette: Palette = {
  navy900: "#0d1428",
  navy700: "#182543",
  blue: "#6f9fe8",
  amber: "#e0a344",
  accent: "#f0a11c",
  surface: "#0b1020",
  card: "#151d33",
  ink: "#eef1f8",
  ink2: "#a9b3c9",
  ink3: "#7b859c",
  line: "#26314d",
  success: "#4cbe86",
  danger: "#e8776b",
  chipBlueBg: "#1c2b4a",
  chipAmberBg: "#3a2e17",
  onNavy: "#ffffff",
  onNavyMuted: "#a9b3c9",
};

export const radius = { card: 14, control: 10, pill: 999 };

/** Tema sağlayıcısının erişemediği yerlerde (StyleSheet.create) açık palet */
export const colors = lightPalette;
