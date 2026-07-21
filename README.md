# Arnavutköy Belediyesi — Akbil Simülasyon Projesi

İki bölümden oluşur:

| Klasör | Ne yapar |
|---|---|
| `backend/` | Mobilden gelen yolculuk kayıtlarını alır ve **Akbil İzleme Merkezi** panelinde grafiklerle gösterir (Node.js + Express, bellek içi — veritabanı yok, ileride eklenecek) |
| `mobile/` | Akbil basmayı simüle eden mobil uygulama (Expo / React Native, TypeScript) |

## 1. Backend'i başlat

```powershell
cd backend
npm install        # ilk seferde
npm start
```

- Panel: <http://localhost:4000>
- Açılışta konsolda **"Ağ (mobil): http://192.168.x.x:4000"** satırı görünür —
  telefonla test ederken bu adres mobil uygulamanın **Ayarlar** ekranına girilir.
- Panel 3 saniyede bir kendini yeniler; grafikler: saatlik yoğunluk, hat
  kullanımı, en çok kullanılan duraklar, tam/öğrenci dağılımı + son yolculuklar.

Demo verisi doldurmak için (backend çalışırken, ikinci bir terminalde):

```powershell
cd backend
npm run seed        # 60 rastgele yolculuk; sayı verilebilir: npm run seed 100
```

Panelin sağ altındaki **"Verileri temizle"** tüm kayıtları sıfırlar.

## 2. Mobil uygulamayı başlat

```powershell
cd mobile
npm install        # ilk seferde
npx expo start
```

- **Telefonda**: Expo Go uygulamasını kurup terminaldeki QR kodu okutun.
  Ardından uygulamada **Ayarlar → İzleme merkezi adresi** alanına backend'in
  ağ adresini yazıp "Bağlantıyı Test Et" ile doğrulayın (telefon ve bilgisayar
  aynı Wi-Fi'da olmalı).
- **Bilgisayarda hızlı deneme**: `npx expo start --web` → tarayıcıda açılır;
  varsayılan adres `http://localhost:4000` bu modda doğrudan çalışır.

## Simülasyon kuralları

- **Kart Bas (Bin)**: biniş saati = o anki saat; kart tipine göre ücret düşer
  (Tam ₺20,00 / Öğrenci ₺9,76 — `mobile/src/data/lines.ts` içinde tek yerden).
- **İnmeden binilemez**: aktif yolculuk bitmeden yeni biniş engellenir.
- **İniş saati** seçilen durağa göre otomatik hesaplanır: biniş saati +
  duraklar arası sürelerin toplamı (hat/durak verileri `lines.ts`).
- Bakiye yetersizse biniş engellenir; **Kartım** ekranından bakiye yüklenir.
- İniş anında kayıt izleme merkezine gönderilir; sunucuya ulaşılamazsa
  **Geçmiş** ekranında "Bekliyor" olarak durur ve tekrar gönderilebilir.
- **Ayarlar → Demo saat modu**: grafiklerde farklı saatlere veri üretmek için
  biniş saatini elle seçme imkânı.

## Notlar

- Görsel kimlik arnavutkoy.bel.tr ile uyumludur (lacivert + turuncu, belediye
  logosu `backend/public/assets/` ve `mobile/assets/` altında).
- Veritabanı ve FastAPI bilinçli olarak yoktur; kayıtlar backend belleğinde
  tutulur ve sunucu yeniden başlatılınca silinir. API sözleşmesi:
  `POST /api/trips`, `GET /api/trips`, `GET /api/stats`, `GET /api/health`,
  `DELETE /api/trips`.
