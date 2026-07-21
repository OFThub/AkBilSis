# Mobil: Bakiyesiz Kart + Profil Ekranı, Hat Favorileri ve Yoğun Saatler

**Tarih:** 2026-07-21
**Kapsam:** Yalnızca `mobile/`. `backend/` ve web paneli değişmez.

## Amaç

1. Bakiye kavramını mobil uygulamadan tamamen kaldırmak — hiçbir işlem bakiyeye bakmaz, bakiye yüklenmez, gösterilmez, NFC etiketine yazılmaz.
2. Kart ekranını bir profil ekranına dönüştürmek: üstte kart kimliği, altında tüm hatlar, en altta favori hatlar.
3. Hatları favorilenebilir yapmak; favori hatların gün içindeki yoğunluk profilini ve en yoğun saatlerini göstermek.

## Kısıt: `fare` kalır

`fare` backend'de zorunlu alandır (`backend/server.js`, `REQUIRED_FIELDS`). Gönderilmezse `POST /api/trips` 400 döner ve web panelinin gelir grafiği veri alamaz. Backend değişmeyeceği için:

- **Ücret (`fare`) yolculuk kaydında kalır** ve backend'e gönderilmeye devam eder.
- Ücret artık hiçbir yerden **düşülmez** — sadece "bu yolculuğun bilet karşılığı" bilgisidir.
- `balance` alanı backend'de zorunlu değildir; gönderilmesi durur.

## 1. Bakiyenin kaldırılması

### `src/types.ts`
- `CardInfo` → `{ cardNo: string; cardType: CardType }` (`balance` silinir).
- `TripRecord.balanceAfter` silinir.

### `src/nfc/nfcCard.ts`
- `serializeCard` artık `balance` yazmaz; etiket biçimi `v: 2`.
- `parseCard` `balance` alanını **doğrulamaz ve okumaz**. Eski (v1) etiketlerde `balance` bulunması hata değildir — alan yok sayılır, kart geçerli okunur. Geriye uyumluluk şartı budur.
- `updateCardTag` ve `flowError` silinir (tek kullanıcıları iniş bakiye düşümü ve bakiye yüklemeydi).
- `NfcErrorCode` birleşiminden `"flow"` çıkar.
- `readCardTag`, `writeCardTag`, `cancelCardScan` aynen kalır.

### `src/context/AppContext.tsx`
- `prepareAlight` ve `AlightCheck` silinir. Tek işi bakiye kontrolü + ücret hesabıydı; durak doğrulaması zaten `completeAlight` içinde tekrarlanıyor.
- `completeAlight(stopIndex, card)` imzası korunur; `balanceAfter` alanı kaydedilmez.
- `formatTL` / `round2` importları kalkar (kullanımları biter).
- Yeni alan: `favoriteLineIds: string[]` (bkz. Bölüm 3).

### `src/screens/TripScreen.tsx`
- İniş akışı artık etikete **yazmaz**: `updateCardTag(...)` yerine `readCardTag(app.settings.nfcSimulation)`.
- Okunan kart doğrudan `completeAlight(stopIndex, card)`'a geçer.
- Başarı mesajları bakiyeden arındırılır:
  - Gönderildi: `İniş tamam — {hh:mm} – {hh:mm}, bilet {fare}. Kayıt izleme merkezine gönderildi.`
  - Gönderilemedi: `İniş tamam — bilet {fare}. Sunucuya ulaşılamadı — Geçmiş ekranından tekrar gönderebilirsiniz.`
- Ücret bilgi kartı ("Tam bilet / Öğrenci bilet") kalır; alt notu güncellenir: *"Ücret bilgi amaçlıdır; karttan düşülmez."*
- İptal/`scanToken` mantığı ve ekran-üstüne-kaydırma davranışı korunur.

### `src/screens/HistoryScreen.tsx`
- "Kalan ₺X" satırı ve `balanceAfter` kullanımı silinir. Ücret gösterimi kalır.

### `src/api/client.ts`
- `postTrip` artık `balanceAfter`/`balance` göndermez; `localId` ve `status` ayıklaması aynı kalır.

### `src/utils/format.ts`
- `round2` silinir (kullanımı kalmaz). `formatTL`, `hhmm`, `maskCardNo`, `randomCardNo` kalır.
- Yeni: `hourRange(hour: number): string` → `"08:00–09:00"` (24 → 00 sarması ile).

### `src/screens/SettingsScreen.tsx`
- Sıfırlama açıklamasındaki "Karttaki bakiye etikette durduğu için etkilenmez." cümlesi bakiyesiz metinle değişir; favorilerin korunduğu belirtilir.

## 2. Hat yoğunluk profili (statik)

`src/data/lines.ts` içinde `BusLine`'a yeni alan:

```ts
/** Saat başına göreli yoğunluk (0-100), index = saat (0-23) */
hourly: number[]; // uzunluk 24
```

Profiller (her hattın karakteri farklı):

| Hat | 0-5 | 6-11 | 12-17 | 18-23 |
|---|---|---|---|---|
| **448** Mecidiyeköy (banliyö, sert zirveler) | 2 1 1 1 3 12 | 38 82 100 71 42 35 | 33 34 38 46 63 88 | 95 70 44 26 14 6 |
| **H-1** merkez içi (yayvan) | 3 2 1 1 2 8 | 24 52 68 61 55 58 | 62 60 57 59 66 74 | 70 52 38 25 14 7 |
| **AR-2** hastane (gündüz ağırlıklı) | 1 1 0 0 1 4 | 14 34 56 78 85 80 | 62 68 76 72 58 46 | 34 24 16 10 5 2 |
| **AR-3** sanayi (erken vardiya) | 4 2 2 3 10 32 | 74 92 66 44 32 28 | 30 34 40 52 86 78 | 50 30 20 12 7 4 |

Yeni yardımcı:

```ts
/** En yüksek `count` ayrık tepe saati; komşu saatler (±1) tek tepe sayılır. Saat sırasına göre döner. */
export function peakHours(line: BusLine, count = 2): number[];
```

Algoritma: `hourly` değerlerine göre azalan sırada gez; seçilmiş bir tepeye ±1 komşu olan saatleri atla; `count` tepe toplanınca dur; sonucu artan saat sırasına diz.

Beklenen çıktılar: 448 → `[8, 18]`, H-1 → `[8, 17]`, AR-2 → `[10, 14]`, AR-3 → `[7, 16]`.

## 3. Favoriler

`AppState`'e `favoriteLineIds: string[]` eklenir; mevcut `akbil-state-v2` AsyncStorage kaydının içinde saklanır. Eski kayıtlarda alan yoksa `[]` ile yüklenir.

`AppApi`'ye eklenenler:
- `favoriteLineIds: string[]`
- `toggleFavorite(lineId: string): void` — varsa çıkarır, yoksa ekler.

`resetAll()`: favoriler **korunur** (`backendUrl` ve `nfcSimulation` gibi kullanıcı emeğidir). Aktif yolculuk ve geçmiş silinir.

## 4. Kart ekranı (`src/screens/CardScreen.tsx`)

Header: `"Kart"` · alt başlık `"Kart bilgileri ve hatlarım"`. Tek `ScrollView`, sıra:

1. **Profil kartı** — lacivert zemin, amblem filigranı (mevcut `virtualCard` stili korunur).
   - Okutulmuşsa: kart no (büyük, tabular), TAM/ÖĞRENCİ rozeti, alt satırda bu karta ait yerel yolculuk sayısı (`history.filter(r => r.cardNo === card.cardNo).length` → `"12 yolculuk"`) ve `AKBİL` amblemi. **Bakiye bloğu yoktur.**
   - Okutulmamışsa: mevcut "Kart okutulmadı" boş durumu, metni bakiyesiz hâle güncellenir.
2. **Kart işlemleri** — `Kartı Okut` ve `Yeni kart oluştur` (tip seçimi + kart no + `Karta Yaz`). "Bakiye yükle" bölümü, `TOP_UP_AMOUNTS`, `handleTopUp` ve `amount` state'i tamamen silinir. Yeni kart açıklamasından "bakiye ₺0,00 başlar" ifadesi çıkar.
3. **TÜM HATLAR** — her satır: kod rozeti (`448`), hat adı, `{n} durak`, sağda yıldız düğmesi (`★` dolu / `☆` boş) → `toggleFavorite`.
4. **FAVORİ HATLAR** — favori yoksa boş durum: *"Yıldıza dokunarak sık kullandığın hatları buraya ekle."* Favori varsa her hat için kart:
   - Hat adı
   - `En yoğun: 08:00–09:00 · 18:00–19:00` (`peakHours` + `hourRange`)
   - 24 çubuklu yoğunluk grafiği; içinde bulunulan saat vurgulu (`colors.accent`), diğerleri `colors.blue` tonunda
   - Altında `06 / 12 / 18` saat etiketleri

NFC oturumu temizliği (`useEffect(() => () => cancelCardScan(), [])`) ve `runScan` hata/yeniden-deneme akışı korunur.

### Yeni dosya: `src/components/BusyChart.tsx`

```ts
export default function BusyChart({
  hourly,      // 24 elemanlı 0-100 dizisi
  currentHour, // vurgulanacak saat
}: { hourly: number[]; currentHour: number }): JSX.Element;
```

Saf `View`'lerle çizer — yeni bağımlılık yok. Çubuk yüksekliği sabit maksimum yükseklik (46px) üzerinden yüzdeyle hesaplanır; sıfıra yakın değerler için minimum 2px taban.

Hat satırları ve favori kartı, `mobile/src/screens/TripScreen.tsx` içindeki `StopRow` desenine uyarak `CardScreen.tsx` içinde yerel bileşen olarak kalır.

**Vurgulanan saat:** `settings.demoMode` açıksa `settings.demoHour`, değilse `new Date().getHours()`. Böylece demo saat modu grafikte de tutarlı görünür.

## 5. Uç durumlar

- Kart hiç okutulmamışken hat listesi ve favoriler tam çalışır — bunlar karttan bağımsızdır.
- Eski v1 NFC etiketi okunduğunda `balance` alanı yok sayılır, kart geçerli kabul edilir.
- Eski AsyncStorage geçmişinde `balanceAfter` bulunan kayıtlar sorunsuz yüklenir; alan artık okunmadığı için gösterilmez.
- Favori hat listesi boşken favori bölümü boş durum metni gösterir, gizlenmez.

## 6. Doğrulama

Projede test altyapısı yok. Doğrulama:

1. `cd mobile && npx tsc --noEmit` → hatasız.
2. Elle akış:
   - Yeni kart oluştur → kart okut: bakiye hiçbir yerde görünmüyor.
   - Bin → in: bakiye uyarısı çıkmıyor, iniş kart okutunca tamamlanıyor, geçmişte "Kalan" satırı yok.
   - Backend açıkken kayıt "Gönderildi" oluyor (fare gittiği için 400 almıyor).
   - Bir hattı favorile → favori bölümünde yoğunluk grafiği ve en yoğun saatler görünüyor; şu anki saat vurgulu.
   - Uygulamayı kapatıp aç → favoriler duruyor. Ayarlar → Sıfırla → favoriler yine duruyor, geçmiş siliniyor.
