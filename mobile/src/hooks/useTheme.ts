/**
 * Etkin renk paleti.
 *
 * Tema seçimi Ayarlar'da yapılır ve yalnızca telefonda saklanır. Ekranlar
 * stillerini `useMemo(() => makeStyles(palette), [palette])` kalıbıyla üretir;
 * böylece tema değişince tüm ekran yeniden renklenir.
 */

import { useApp } from "../context/AppContext";
import { Palette, darkPalette, lightPalette } from "../theme";

export function usePalette(): Palette {
  const { settings } = useApp();
  return settings.theme === "dark" ? darkPalette : lightPalette;
}
