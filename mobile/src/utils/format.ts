/** Kuruş hassasiyetinde yuvarla — bakiye aritmetiği hep bununla yapılır */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatTL(value: number): string {
  return "₺" + value.toFixed(2).replace(".", ",");
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function maskCardNo(cardNo: string): string {
  const digits = cardNo.replace(/\s/g, "");
  return "•••• " + digits.slice(-4);
}

export function randomCardNo(): string {
  const part = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${part()} ${part()}`;
}

/** Tepe saat etiketi — 8 → "08:00–09:00" */
export function hourRange(hour: number): string {
  const pad = (h: number) => String(h).padStart(2, "0");
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}
