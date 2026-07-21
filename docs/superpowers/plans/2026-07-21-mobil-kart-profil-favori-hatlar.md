# Mobil Kart Profili + Favori Hatlar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobil uygulamadan bakiyeyi tamamen kaldırmak ve Kart ekranını, altında tüm hatların favorilenebildiği + favori hatların yoğunluk grafiğinin göründüğü bir profil ekranına dönüştürmek.

**Architecture:** Kart NFC etiketinde artık yalnızca kimlik taşır (`cardNo` + `cardType`); iniş akışı etikete yazmayı bırakıp sadece okur. Hat yoğunluğu backend'den değil, `src/data/lines.ts` içindeki statik 24 saatlik profillerden gelir. Favoriler mevcut AsyncStorage state'ine yeni bir dizi alanı olarak eklenir.

**Tech Stack:** Expo 57 / React Native 0.86 / TypeScript 6, `@react-native-async-storage/async-storage`, `react-native-nfc-manager`. Yeni bağımlılık **eklenmeyecek** — grafik saf `View`'lerle çizilir.

## Global Constraints

- **Yalnızca `mobile/` değişir.** `backend/`, `backend/public/` ve `README.md` bu planda hiç düzenlenmez.
- **`fare` kayıtta kalır ve backend'e gönderilmeye devam eder.** `backend/server.js` içindeki `REQUIRED_FIELDS` dizisi `fare` alanını zorunlu tutar; gönderilmezse `POST /api/trips` 400 döner. Ücret artık hiçbir yerden düşülmez, yalnızca bilgi olarak gösterilir.
- **`balance` hiçbir yere yazılmaz/gönderilmez/gösterilmez.**
- **Projede test koşucusu yok** (`mobile/package.json` içinde `test` scripti ve test bağımlılığı yoktur). Her görevin doğrulaması: `cd mobile && npx tsc --noEmit` çıktısının hatasız olması + görevde tanımlanan elle kontrol. TDD adımları bu yüzden "önce derleyiciyi kırmızıya düşür, sonra yeşile al" biçiminde uygulanır.
- **Arayüz metinleri Türkçe.** Mevcut ton korunur (kısa, resmî, "siz" hitabı).
- **Renkler yalnızca `src/theme.ts`'ten** (`colors.navy900`, `colors.accent`, `colors.blue`, `colors.line`, `colors.ink`/`ink2`/`ink3`, `colors.surface`, `colors.card`); satır içi hex yazılmaz (mevcut dosyalardaki `#ffffff` ve `#b9c3de` istisnaları korunur).
- **Commit'ler yalnızca kullanıcı onayıyla atılır.** Adımlardaki `git commit` komutları hazır tutulur; kullanıcı "commit et" demeden çalıştırılmaz.

---

### Task 1: Hat yoğunluk verisi ve saat aralığı biçimlendirmesi

Salt ekleme yapan görev — mevcut hiçbir kullanım bozulmaz, `tsc` bu görevin sonunda da yeşildir.

**Files:**
- Modify: `mobile/src/data/lines.ts` (BusLine arayüzü ~9-18, dört hat kaydı, dosya sonuna yeni fonksiyon)
- Modify: `mobile/src/utils/format.ts` (dosya sonuna yeni fonksiyon)

**Interfaces:**
- Consumes: yok (ilk görev)
- Produces:
  - `BusLine.hourly: number[]` — 24 elemanlı, 0-100 göreli yoğunluk
  - `peakHours(line: BusLine, count?: number): number[]` — artan saat sırasında tepe saatleri
  - `hourRange(hour: number): string` — `"08:00–09:00"`

- [ ] **Step 1: `BusLine` arayüzüne `hourly` alanını ekle**

`mobile/src/data/lines.ts` içinde arayüzü şu hâle getir:

```ts
export interface BusLine {
  id: string;
  name: string;
  /** Kısa rozet etiketi (ör. "448") */
  code: string;
  stops: string[];
  /** minutesBetween[i] = stops[i] -> stops[i+1] arası dakika */
  minutesBetween: number[];
  /** Saat başına göreli yoğunluk (0-100), index = saat (0-23) */
  hourly: number[];
}
```

- [ ] **Step 2: Derleyicinin kırmızıya düştüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: FAIL — dört `LINES` kaydı için `Property 'hourly' is missing in type ... but required in type 'BusLine'` hatası.

- [ ] **Step 3: Dört hatta yoğunluk profillerini ekle**

Her hat nesnesinde `minutesBetween` satırından sonra ilgili diziyi ekle. Diziler tam 24 elemanlıdır ve her hattın karakteri farklıdır.

`448` (banliyö hattı — sert sabah/akşam zirvesi):

```ts
    // 00-05, 06-11, 12-17, 18-23
    hourly: [
      2, 1, 1, 1, 3, 12, 38, 82, 100, 71, 42, 35, 33, 34, 38, 46, 63, 88, 95,
      70, 44, 26, 14, 6,
    ],
```

`h1` (merkez içi — gün boyu yayvan):

```ts
    hourly: [
      3, 2, 1, 1, 2, 8, 24, 52, 68, 61, 55, 58, 62, 60, 57, 59, 66, 74, 70, 52,
      38, 25, 14, 7,
    ],
```

`ar2` (hastane hattı — gündüz ağırlıklı):

```ts
    hourly: [
      1, 1, 0, 0, 1, 4, 14, 34, 56, 78, 85, 80, 62, 68, 76, 72, 58, 46, 34, 24,
      16, 10, 5, 2,
    ],
```

`ar3` (sanayi hattı — erken vardiya):

```ts
    hourly: [
      4, 2, 2, 3, 10, 32, 74, 92, 66, 44, 32, 28, 30, 34, 40, 52, 86, 78, 50,
      30, 20, 12, 7, 4,
    ],
```

- [ ] **Step 4: `peakHours` fonksiyonunu ekle**

`mobile/src/data/lines.ts` dosyasının sonuna, mevcut `findLine`/`travelMinutes` fonksiyonlarının yanına:

```ts
/**
 * En yoğun `count` saati döndürür. Komşu saatler (±1) aynı tepenin parçası
 * sayılır — böylece iki ayrı zirve gösterilir, aynı tepenin iki yanı değil.
 * Sonuç artan saat sırasındadır.
 */
export function peakHours(line: BusLine, count = 2): number[] {
  const byBusiest = line.hourly
    .map((value, hour) => ({ value, hour }))
    .sort((a, b) => b.value - a.value);

  const peaks: number[] = [];
  for (const { hour } of byBusiest) {
    if (peaks.length >= count) break;
    if (peaks.some((picked) => Math.abs(picked - hour) <= 1)) continue;
    peaks.push(hour);
  }
  return peaks.sort((a, b) => a - b);
}
```

- [ ] **Step 5: `hourRange` biçimlendiricisini ekle**

`mobile/src/utils/format.ts` dosyasının sonuna:

```ts
/** Tepe saat etiketi — 8 → "08:00–09:00" */
export function hourRange(hour: number): string {
  const pad = (h: number) => String(h).padStart(2, "0");
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}
```

- [ ] **Step 6: Derleyicinin yeşile döndüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: çıktı yok (hatasız).

- [ ] **Step 7: Profillerin beklenen tepeleri verdiğini doğrula**

Run:

```bash
cd mobile && node -e "
const src = require('fs').readFileSync('src/data/lines.ts','utf8');
const arrays = [...src.matchAll(/hourly:\s*\[([^\]]+)\]/g)].map(m => m[1].split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n)));
const peak = (h, count=2) => { const o = h.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v); const p=[]; for (const {i} of o) { if (p.length>=count) break; if (p.some(x=>Math.abs(x-i)<=1)) continue; p.push(i);} return p.sort((a,b)=>a-b); };
arrays.forEach((h,idx) => console.log(idx, 'uzunluk=' + h.length, 'tepeler=' + JSON.stringify(peak(h))));
"
```

Expected:

```
0 uzunluk=24 tepeler=[8,18]
1 uzunluk=24 tepeler=[8,17]
2 uzunluk=24 tepeler=[10,14]
3 uzunluk=24 tepeler=[7,16]
```

Dört dizinin de uzunluğu 24 olmalı. Farklı çıkarsa dizide eksik/fazla sayı vardır — düzelt ve tekrar çalıştır.

- [ ] **Step 8: Commit (yalnızca kullanıcı onayıyla)**

```bash
git add mobile/src/data/lines.ts mobile/src/utils/format.ts
git commit -m "feat(mobile): hat yogunluk profilleri ve tepe saat yardimcilari"
```

---

### Task 2: `BusyChart` yoğunluk grafiği bileşeni

Salt ekleme — henüz kimse kullanmaz, `tsc` yeşil kalır.

**Files:**
- Create: `mobile/src/components/BusyChart.tsx`

**Interfaces:**
- Consumes: `colors` (`mobile/src/theme.ts`)
- Produces: `export default function BusyChart({ hourly, currentHour }: { hourly: number[]; currentHour: number })`

- [ ] **Step 1: Bileşeni yaz**

`mobile/src/components/BusyChart.tsx`:

```tsx
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
```

- [ ] **Step 2: Derleyiciyi çalıştır**

Run: `cd mobile && npx tsc --noEmit`
Expected: çıktı yok (hatasız).

- [ ] **Step 3: Commit (yalnızca kullanıcı onayıyla)**

```bash
git add mobile/src/components/BusyChart.tsx
git commit -m "feat(mobile): hat yogunluk grafigi bileseni"
```

---

### Task 3: Favori hatlar durumu

Salt ekleme — mevcut ekranlar etkilenmez, `tsc` yeşil kalır.

**Files:**
- Modify: `mobile/src/context/AppContext.tsx` (`AppState` ~24-28, `AppApi` ~41-52, `defaultState` ~54-66, yükleme efekti ~76-98, `resetAll` ~241-249, `api` nesnesi ~251-261)

**Interfaces:**
- Consumes: yok
- Produces: `useApp()` üzerinden `favoriteLineIds: string[]` ve `toggleFavorite(lineId: string): void`

- [ ] **Step 1: `AppState`'e alanı ekle**

```ts
interface AppState {
  activeTrip: ActiveTrip | null;
  history: TripRecord[];
  /** Kullanıcının yıldızladığı hat id'leri — Kart ekranındaki favori bölmesi */
  favoriteLineIds: string[];
  settings: Settings;
}
```

- [ ] **Step 2: Derleyicinin kırmızıya düştüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: FAIL — `defaultState` ve yükleme efektindeki `setState` çağrıları için `Property 'favoriteLineIds' is missing` hatası.

- [ ] **Step 3: `defaultState`'e varsayılanı ekle**

```ts
function defaultState(): AppState {
  return {
    activeTrip: null,
    history: [],
    favoriteLineIds: [],
    settings: {
      backendUrl: "http://localhost:4000",
      demoMode: false,
      demoHour: 8,
      // Expo Go'da native NFC yok — varsayılan simülasyon ki akış kutudan çıkar çıkmaz çalışsın
      nfcSimulation: true,
    },
  };
}
```

- [ ] **Step 4: Yükleme efektinde eski kayıtları güvenle taşı**

Yükleme efektindeki `setState({...})` çağrısına satırı ekle — alan yoksa boş dizi:

```ts
          setState({
            activeTrip: saved.activeTrip ?? null,
            history: Array.isArray(saved.history) ? saved.history : [],
            favoriteLineIds: Array.isArray(saved.favoriteLineIds)
              ? saved.favoriteLineIds
              : [],
            settings: { ...base.settings, ...(saved.settings ?? {}) },
          });
```

- [ ] **Step 5: `toggleFavorite` fonksiyonunu ekle**

`updateSettings` tanımının hemen üstüne:

```ts
  const toggleFavorite = useCallback((lineId: string) => {
    setState((s) => ({
      ...s,
      favoriteLineIds: s.favoriteLineIds.includes(lineId)
        ? s.favoriteLineIds.filter((id) => id !== lineId)
        : [...s.favoriteLineIds, lineId],
    }));
  }, []);
```

- [ ] **Step 6: `AppApi` arayüzüne imzayı ekle**

`updateSettings` satırının üstüne:

```ts
  /** Hattı favorilere ekler ya da çıkarır */
  toggleFavorite(lineId: string): void;
```

- [ ] **Step 7: `resetAll` favorileri korusun**

```ts
  const resetAll = useCallback(() => {
    setState((s) => {
      const fresh = defaultState();
      // Backend adresi, NFC modu ve favoriler kullanıcı emeği — sıfırlamada koru
      fresh.settings.backendUrl = s.settings.backendUrl;
      fresh.settings.nfcSimulation = s.settings.nfcSimulation;
      fresh.favoriteLineIds = s.favoriteLineIds;
      return fresh;
    });
  }, []);
```

- [ ] **Step 8: `api` nesnesine ekle**

`api` nesnesinde `updateSettings` satırının üstüne `toggleFavorite,` ekle. (`favoriteLineIds` zaten `...state` yayılımıyla geliyor — ayrıca yazma.)

- [ ] **Step 9: Derleyicinin yeşile döndüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: çıktı yok (hatasız).

- [ ] **Step 10: Commit (yalnızca kullanıcı onayıyla)**

```bash
git add mobile/src/context/AppContext.tsx
git commit -m "feat(mobile): favori hat durumu ve kalicilik"
```

---

### Task 4: Bakiyenin tamamen kaldırılması

Bu görev atomiktir: `CardInfo.balance` silinince yedi dosya birden kırmızıya düşer, hepsi aynı görevde yeşile alınır. Bölünürse ara adımlarda `tsc` kırmızı kalır.

**Files:**
- Modify: `mobile/src/types.ts`
- Modify: `mobile/src/nfc/nfcCard.ts`
- Modify: `mobile/src/context/AppContext.tsx`
- Modify: `mobile/src/screens/TripScreen.tsx`
- Modify: `mobile/src/screens/CardScreen.tsx`
- Modify: `mobile/src/screens/HistoryScreen.tsx`
- Modify: `mobile/src/api/client.ts`
- Modify: `mobile/src/utils/format.ts`
- Modify: `mobile/src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: Task 1'in `hourRange`'i (bu görevde kullanılmaz), Task 3'ün favori state'i (değişmez)
- Produces:
  - `CardInfo = { cardNo: string; cardType: CardType }`
  - `readCardTag(simulate: boolean): Promise<CardInfo>` (imza aynı, artık iniş akışının tek NFC çağrısı)
  - `completeAlight(stopIndex: number, card: CardInfo): Promise<AlightResult>` (imza aynı, `balanceAfter` üretmez)
  - `prepareAlight` ve `updateCardTag` **artık yoktur** — Task 5 bunlara referans vermez

- [ ] **Step 1: `types.ts` — bakiye alanlarını sil**

```ts
export type CardType = "tam" | "ogrenci";

/** NFC etiketinde taşınan kart kimliği — uygulama kart saklamaz */
export interface CardInfo {
  cardNo: string;
  cardType: CardType;
}
```

`TripRecord` içinden şu iki satırı sil:

```ts
  /** İniş sonrası etikete yazılan güncel bakiye */
  balanceAfter?: number;
```

- [ ] **Step 2: Derleyicinin kırmızıya düştüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: FAIL — `nfcCard.ts`, `AppContext.tsx`, `TripScreen.tsx`, `CardScreen.tsx`, `HistoryScreen.tsx` dosyalarında `Property 'balance' does not exist on type 'CardInfo'` ve benzeri hatalar. Bu liste, aşağıdaki adımlarda kapatılacak işin haritasıdır.

- [ ] **Step 3: `nfcCard.ts` — etiket biçimini v2'ye al ve bakiye yolunu sil**

`import { round2 } from "../utils/format";` satırını sil (`import { CardInfo, CardType } from "../types";` kalır).

`NfcErrorCode` içinden `"flow"` satırını sil:

```ts
export type NfcErrorCode =
  | "unsupported" // cihazda NFC yok ya da native modül yüklenemedi (Expo Go)
  | "cancelled" // oturum iptal edildi — ekranlar sessizce yutar
  | "invalid-card" // etiket boş ya da akbil verisi değil
  | "io"; // okuma/yazma sırasında beklenmeyen hata
```

`flowError` fonksiyonunu tümüyle sil (üstündeki yorum satırıyla birlikte).

`serializeCard` ve `parseCard`:

```ts
function serializeCard(card: CardInfo): string {
  return JSON.stringify({
    app: CARD_MARKER,
    v: 2,
    cardNo: card.cardNo,
    cardType: card.cardType,
  });
}

function parseCard(json: string): CardInfo {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new NfcError(
      "invalid-card",
      "Etiketteki veri çözümlenemedi — bu bir akbil kartı değil."
    );
  }
  const typeOk = data?.cardType === "tam" || data?.cardType === "ogrenci";
  if (data?.app !== CARD_MARKER || typeof data?.cardNo !== "string" || !typeOk) {
    throw new NfcError(
      "invalid-card",
      "Etikette geçerli bir akbil kartı yok. Kart ekranından yeni kart oluşturabilirsiniz."
    );
  }
  // v1 etiketlerinde balance alanı bulunabilir — okunmaz, yok sayılır
  return {
    cardNo: data.cardNo,
    cardType: data.cardType as CardType,
  };
}
```

`updateCardTag` fonksiyonunu tümüyle sil (üstündeki JSDoc yorumuyla birlikte). `readCardTag`, `writeCardTag`, `cancelCardScan` aynen kalır.

- [ ] **Step 4: `AppContext.tsx` — `prepareAlight` ve bakiye izlerini sil**

`AlightCheck` arayüzünü tümüyle sil:

```ts
export interface AlightCheck extends Result {
  fare?: number;
}
```

`AppApi` içinden `prepareAlight` satırını (üstündeki yorumla birlikte) sil. `completeAlight` yorumunu güncelle:

```ts
  /** Kart okunduktan sonra yolculuğu bitirir */
  completeAlight(stopIndex: number, card: CardInfo): Promise<AlightResult>;
```

`prepareAlight` fonksiyon gövdesini tümüyle sil.

`completeAlight` içindeki `record` nesnesinden `balanceAfter` satırını sil; nesnenin son iki alanı şöyle kalır:

```ts
        fare: FARES[card.cardType],
        status: "pending",
```

`import { formatTL, round2 } from "../utils/format";` satırını tümüyle sil (ikisi de artık kullanılmıyor).

`api` nesnesinden `prepareAlight,` satırını sil.

- [ ] **Step 5: `TripScreen.tsx` — iniş artık etikete yazmıyor**

Import bloğunu değiştir:

```tsx
import { NfcError, cancelCardScan, readCardTag } from "../nfc/nfcCard";
```

ve `import { formatTL, hhmm, round2 } from "../utils/format";` satırını `import { formatTL, hhmm } from "../utils/format";` yap.

`runAlightScan` gövdesini şununla değiştir:

```tsx
  async function runAlightScan(stopIndex: number, token: number) {
    setScanState("waiting");
    setScanError(null);
    try {
      // Kart yalnızca kimlik taşır — okunur, etikete hiçbir şey yazılmaz
      const card = await readCardTag(app.settings.nfcSimulation);
      if (token !== scanTokenRef.current) return;

      const result = await app.completeAlight(stopIndex, card);
      if (token !== scanTokenRef.current) return;
      setAlightIndex(null);
      if (!result.ok) {
        showNotice({ tone: "error", text: result.error ?? "İniş yapılamadı." });
        return;
      }
      const record = result.record!;
      showNotice(
        result.sent
          ? {
              tone: "success",
              text: `İniş tamam — ${hhmm(record.boardTime)} – ${hhmm(
                record.alightTime
              )}, bilet ${formatTL(
                record.fare
              )}. Kayıt izleme merkezine gönderildi.`,
            }
          : {
              tone: "info",
              text: `İniş tamam — bilet ${formatTL(
                record.fare
              )}. Sunucuya ulaşılamadı — Geçmiş ekranından tekrar gönderebilirsiniz.`,
            }
      );
    } catch (e) {
      if (token !== scanTokenRef.current) return;
      const err = e as NfcError;
      if (err.code === "cancelled") return;
      setScanState("error");
      setScanError(err.message || "Kart okunamadı.");
    }
  }
```

Ücret bilgi kartının alt notunu güncelle:

```tsx
              <Text style={styles.fareNote}>
                Ücret bilgi amaçlıdır — karttan düşülmez.
              </Text>
```

- [ ] **Step 6: `CardScreen.tsx` — bakiye yükleme ve bakiye gösterimini sil**

Bu adım yalnızca **silme** yapar; ekranın yeniden yapılandırılması Task 5'tedir.

Sil:
- `const TOP_UP_AMOUNTS = [50, 100, 250];` satırı
- `const [amount, setAmount] = useState(TOP_UP_AMOUNTS[0]);` satırı
- `handleTopUp` fonksiyonunun tamamı
- "Bakiye yükle" başlıklı `<SectionCard>` bloğunun tamamı
- Stillerden: `amountRow`, `amountChip`, `amountChipActive`, `amountLabel`, `amountLabelActive`, `balanceLabel`, `balanceValue`
- Importlardan: `updateCardTag` ve `round2`

Kart görselindeki bakiye bloğunu çıkar — `cardBottomRow` şu hâle gelir:

```tsx
            <View style={styles.cardBottomRow}>
              <Text style={styles.cardFooter}>AKBİL</Text>
            </View>
```

Kalan importlar: `import { NfcError, cancelCardScan, readCardTag, writeCardTag } from "../nfc/nfcCard";` ve `import { formatTL, randomCardNo } from "../utils/format";` (`formatTL` hâlâ "Yeni kart oluştur" bölümündeki bilet ücretlerini gösterir).

Metin güncellemeleri:
- `handleRead` bildirimi: `` text: `Kart okundu — ${card.cardType === "tam" ? "Tam" : "Öğrenci"} · ${card.cardNo}.` ``
- "Kart bilgisi" bölümü ipucu: `"Karttaki numarayı ve tipi görüntüler."`
- "Yeni kart oluştur" ipucu: `"Boş NFC etiketini yapay akbile çevirir. Etikette eski kart varsa üzerine yazılır."`

- [ ] **Step 7: `HistoryScreen.tsx` — "Kalan" satırını sil**

`rowFooter` içindeki blok şu hâle gelir:

```tsx
      <View style={styles.rowFooter}>
        <Text style={styles.card}>
          {record.cardType === "tam" ? "Tam" : "Öğrenci"} ·{" "}
          {maskCardNo(record.cardNo)}
        </Text>
        <Text style={styles.fare}>{formatTL(record.fare)}</Text>
      </View>
```

Stillerden `balanceAfter` girdisini sil.

- [ ] **Step 8: `client.ts` — `balance` gönderimini kaldır**

```ts
export async function postTrip(
  baseUrl: string,
  record: TripRecord
): Promise<boolean> {
  try {
    // Yerel alanlar (localId, status) sunucuya gitmez
    const { localId, status, ...payload } = record;
    const res = await fetchWithTimeout(`${normalize(baseUrl)}/api/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 9: `format.ts` — `round2`'yi sil**

Dosyanın başındaki `round2` fonksiyonunu ve üstündeki yorumu tümüyle sil. `formatTL`, `hhmm`, `maskCardNo`, `randomCardNo`, `hourRange` kalır.

- [ ] **Step 10: `SettingsScreen.tsx` — sıfırlama açıklamasını güncelle**

```tsx
          <Text style={styles.hint}>
            Aktif yolculuk ve yolculuk geçmişi silinir; izleme merkezi adresi,
            NFC modu ve favori hatlar korunur.
          </Text>
```

- [ ] **Step 11: Derleyicinin yeşile döndüğünü doğrula**

Run: `cd mobile && npx tsc --noEmit`
Expected: çıktı yok (hatasız).

- [ ] **Step 12: Bakiye izinin gerçekten kalmadığını doğrula**

Run: `cd mobile && grep -rniE "balance|bakiye|round2|prepareAlight|updateCardTag|flowError" src App.tsx`
Expected: hiçbir eşleşme yok (çıktı boş).

Eşleşme çıkarsa o satırı temizle ve komutu tekrar çalıştır.

- [ ] **Step 13: Elle akış kontrolü**

Run: `cd mobile && npx expo start` → uygulamayı aç.

Kontrol listesi:
- Kart ekranı: "Bakiye yükle" bölümü yok, kart görselinde bakiye yok.
- Yeni kart oluştur → Kartı Okut: bildirimde bakiye geçmiyor.
- Yolculuk: Bin → iniş durağı seç → kart okut → iniş tamamlanıyor, mesajda bakiye yok.
- Geçmiş: kayıtta "Kalan" satırı yok, ücret görünüyor.
- Backend açıkken kayıt "Gönderildi" oluyor (`fare` gittiği için 400 almıyor).

- [ ] **Step 14: Commit (yalnızca kullanıcı onayıyla)**

```bash
git add mobile/src
git commit -m "feat(mobile)!: bakiye kavramini tamamen kaldir"
```

---

### Task 5: Kart ekranını profil + hat listesi + favoriler hâline getir

**Files:**
- Modify: `mobile/src/screens/CardScreen.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `LINES`, `peakHours(line)` (`../data/lines`), `hourRange(hour)` (`../utils/format`)
  - Task 2: `BusyChart` (`../components/BusyChart`)
  - Task 3: `app.favoriteLineIds`, `app.toggleFavorite(lineId)`
  - Task 4: `CardInfo` (bakiyesiz), `readCardTag`, `writeCardTag`
- Produces: son ekran — başka görev buna bağlı değil

- [ ] **Step 1: Importları güncelle**

```tsx
import { FARES, LINES, peakHours } from "../data/lines";
import { formatTL, hourRange, randomCardNo } from "../utils/format";
import BusyChart from "../components/BusyChart";
```

- [ ] **Step 2: Türetilmiş değerleri bileşen gövdesine ekle**

`const [newCardNo, setNewCardNo] = useState(randomCardNo());` satırından sonra:

```tsx
  // Grafikte vurgulanan saat — demo saat modu açıkken onunla tutarlı olsun
  const currentHour = app.settings.demoMode
    ? app.settings.demoHour
    : new Date().getHours();

  const favoriteLines = LINES.filter((line) =>
    app.favoriteLineIds.includes(line.id)
  );

  // Profil kartındaki sayaç — bu karta ait yerel yolculuk sayısı
  const tripCount = lastCard
    ? app.history.filter((r) => r.cardNo === lastCard.cardNo).length
    : 0;
```

- [ ] **Step 3: Başlığı güncelle**

```tsx
      <Header title="Kart" subtitle="Kart bilgileri ve hatlarım" />
```

- [ ] **Step 4: Profil kartının alt satırına yolculuk sayacını koy**

`cardBottomRow` bloğu (Task 4'te yalnızca `AKBİL` kalmıştı):

```tsx
            <View style={styles.cardBottomRow}>
              <View>
                <Text style={styles.statLabel}>Yolculuk</Text>
                <Text style={styles.statValue}>{tripCount}</Text>
              </View>
              <Text style={styles.cardFooter}>AKBİL</Text>
            </View>
```

- [ ] **Step 5: "Tüm hatlar" ve "Favori hatlar" bölümlerini ekle**

"Yeni kart oluştur" `<SectionCard>` bloğundan **sonra**, `</ScrollView>` etiketinden önce:

```tsx
        <SectionCard>
          <SectionTitle>Tüm hatlar</SectionTitle>
          {LINES.map((line) => (
            <LineRow
              key={line.id}
              code={line.code}
              name={line.name.replace(`${line.code} `, "")}
              stopCount={line.stops.length}
              favorite={app.favoriteLineIds.includes(line.id)}
              onToggle={() => app.toggleFavorite(line.id)}
            />
          ))}
          <Text style={styles.hint}>
            Yıldıza dokunduğunuz hatlar aşağıdaki favori bölmesinde yoğunluk
            grafiğiyle birlikte görünür.
          </Text>
        </SectionCard>

        <SectionCard>
          <SectionTitle>Favori hatlar</SectionTitle>
          {favoriteLines.length === 0 ? (
            <Text style={styles.emptyFav}>
              Henüz favori hat yok — yukarıdaki listeden yıldıza dokunarak sık
              kullandığınız hatları ekleyin.
            </Text>
          ) : (
            favoriteLines.map((line) => (
              <FavoriteLine
                key={line.id}
                name={line.name}
                hourly={line.hourly}
                currentHour={currentHour}
                peaks={peakHours(line)}
              />
            ))
          )}
        </SectionCard>
```

- [ ] **Step 6: `LineRow` yerel bileşenini ekle**

Dosyanın sonunda, `const styles = StyleSheet.create({` bloğundan **önce** (TripScreen'deki `StopRow` deseniyle aynı yer):

```tsx
/** Hat listesi satırı — kod rozeti, ad, durak sayısı ve favori yıldızı */
function LineRow({
  code,
  name,
  stopCount,
  favorite,
  onToggle,
}: {
  code: string;
  name: string;
  stopCount: number;
  favorite: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineCode}>{code}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.lineMeta}>{stopCount} durak</Text>
      </View>
      <Pressable
        onPress={onToggle}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          favorite
            ? `${code} hattını favorilerden çıkar`
            : `${code} hattını favorile`
        }
        style={({ pressed }) => [styles.star, pressed && { opacity: 0.6 }]}
      >
        <Text style={[styles.starIcon, favorite && styles.starIconActive]}>
          {favorite ? "★" : "☆"}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 7: `FavoriteLine` yerel bileşenini ekle**

`LineRow`'un hemen altına:

```tsx
/** Favori hat kartı — en yoğun saatler + gün içi yoğunluk grafiği */
function FavoriteLine({
  name,
  hourly,
  currentHour,
  peaks,
}: {
  name: string;
  hourly: number[];
  currentHour: number;
  peaks: number[];
}) {
  return (
    <View style={styles.favCard}>
      <Text style={styles.favName}>{name}</Text>
      <Text style={styles.favPeaks}>
        En yoğun: {peaks.map(hourRange).join(" · ")}
      </Text>
      <BusyChart hourly={hourly} currentHour={currentHour} />
    </View>
  );
}
```

- [ ] **Step 8: Yeni stilleri ekle**

`styles` nesnesine, mevcut `hint` girdisinin yanına:

```tsx
  statLabel: {
    color: "#b9c3de",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lineCode: {
    fontWeight: "800",
    fontSize: 13,
    color: "#ffffff",
    backgroundColor: colors.blue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  lineName: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  lineMeta: { fontSize: 12, color: colors.ink3, marginTop: 2 },
  star: { paddingHorizontal: 4, paddingVertical: 2 },
  starIcon: { fontSize: 22, color: colors.ink3 },
  starIconActive: { color: colors.accent },
  emptyFav: { fontSize: 13, color: colors.ink3, lineHeight: 19 },
  favCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    padding: 12,
    marginBottom: 10,
  },
  favName: { fontSize: 14.5, fontWeight: "800", color: colors.navy900 },
  favPeaks: {
    fontSize: 12.5,
    color: colors.blue,
    fontWeight: "700",
    marginTop: 3,
    marginBottom: 10,
  },
```

- [ ] **Step 9: Derleyiciyi çalıştır**

Run: `cd mobile && npx tsc --noEmit`
Expected: çıktı yok (hatasız).

- [ ] **Step 10: Elle akış kontrolü**

Run: `cd mobile && npx expo start`

Kontrol listesi:
- Kart ekranı sırası: profil kartı → kart işlemleri → **Tüm hatlar** → **Favori hatlar**.
- Favori yokken favori bölümü boş durum metnini gösteriyor (bölüm gizlenmiyor).
- Bir hattın yıldızına dokun → favori bölmesinde o hat, "En yoğun: …" satırı ve 24 çubuklu grafikle beliriyor.
- Grafikte içinde bulunulan saatin çubuğu turuncu (`colors.accent`).
- Ayarlar → Demo saat modunu aç, saati 08 seç → Kart ekranındaki vurgulu çubuk 08'e kayıyor.
- Yıldıza tekrar dokun → hat favorilerden çıkıyor.
- Uygulamayı kapat/aç → favoriler duruyor.
- Ayarlar → Uygulamayı Sıfırla (iki kez dokun) → geçmiş siliniyor, favoriler duruyor.

- [ ] **Step 11: Commit (yalnızca kullanıcı onayıyla)**

```bash
git add mobile/src/screens/CardScreen.tsx
git commit -m "feat(mobile): kart ekranini profil + hat listesi + favoriler yap"
```

---

## Kapsam Dışı (bilerek yapılmayanlar)

- `backend/` ve web paneli hiç değişmez. Panelin gelir grafiği `fare` üzerinden çalışmaya devam eder.
- Hat yoğunluğu kullanıcının kendi geçmişinden hesaplanmaz (statik profil tercih edildi).
- Favori hatlar Yolculuk ekranında öne çıkarılmaz — bu planın kapsamı Kart ekranıdır.
