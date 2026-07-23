# Kullanım Senaryosu — GitHub'dan Kuruluma ve İlk Yolculuğa

**Arnavutköy Belediyesi — Akbil Simülasyon Sistemi**

Bu doküman, projeyi GitHub'dan indiren birinin **hiçbir ön bilgi olmadan**
çalışan bir sisteme ulaşmasını ve beş uçtan uca senaryoyu adım adım
denemesini sağlar. Komutlar kopyala-yapıştır çalışır; Windows PowerShell ve
macOS/Linux sürümleri yan yana verilmiştir.

| Ne arıyorsanız | Nereye bakın |
|---|---|
| Uygulamayı kullanmak | [Kullanıcı Kılavuzu](KULLANIM-KILAVUZU.md) |
| Kodun iç işleyişi | [API ve Mimari](API-VE-MIMARI.md) |
| Kurulum + deneme | **bu doküman** |

---

## İçindekiler

1. [Ön koşullar](#1-ön-koşullar)
2. [Depoyu alma](#2-depoyu-alma)
3. [Adım 1 — PostgreSQL'i başlat](#3-adım-1--postgresqli-başlat)
4. [Adım 2 — Python ortamı](#4-adım-2--python-ortamı)
5. [Adım 3 — `.env` dosyası](#5-adım-3--env-dosyası)
6. [Adım 4 — Şema ve veri](#6-adım-4--şema-ve-veri)
7. [Adım 5 — Sunucuyu başlat](#7-adım-5--sunucuyu-başlat)
8. [Adım 6 — Mobil uygulama](#8-adım-6--mobil-uygulama)
9. [Ağ sorun giderme](#9-ağ-sorun-giderme)
10. [Senaryo 1 — Normal yolculuk](#10-senaryo-1--normal-yolculuk)
11. [Senaryo 2 — Otomatik iniş](#11-senaryo-2--otomatik-iniş)
12. [Senaryo 3 — Yarıda kalan yolculuk](#12-senaryo-3--yarıda-kalan-yolculuk)
13. [Senaryo 4 — Yönetici kararı](#13-senaryo-4--yönetici-kararı)
14. [Senaryo 5 — Kart tipi düzeltme](#14-senaryo-5--kart-tipi-düzeltme)
15. [Sıfırlama](#15-sıfırlama)
16. [Sık karşılaşılan hatalar](#16-sık-karşılaşılan-hatalar)
17. [Geliştirme akışı](#17-geliştirme-akışı)

---

## 1. Ön koşullar

| Araç | Sürüm | Ne için | Doğrulama komutu |
|---|---|---|---|
| **Git** | herhangi | Depoyu indirme | `git --version` |
| **Python** | 3.12+ | Backend | `python --version` |
| **Docker Desktop** | güncel | PostgreSQL 16 | `docker --version` |
| **Node.js** | 20+ | Mobil uygulama | `node --version` |
| **Expo Go** | **SDK 57 uyumlu** | Telefonda çalıştırma | Uygulama içi "Settings" |

Hepsini bir kerede sınayın:

```powershell
# Windows PowerShell
git --version; python --version; docker --version; node --version
```

```bash
# macOS / Linux
git --version && python3 --version && docker --version && node --version
```

> ### ⚠️ Expo Go sürüm uyarısı — önceden okuyun
>
> Proje **Expo SDK 57** kullanır. Mağazadaki (Play Store / App Store) Expo Go
> sürümü daha eski bir SDK'da takılı kalabilir. Bu durumda QR kodu okuttuğunuzda
> uygulama **hiç açılmaz** ve hata ağ sorunuymuş gibi görünür — ama sebebi ağ
> değil, **sürüm uyuşmazlığıdır.**
>
> **Çözüm:** Expo'nun sürüm arşivinden **SDK 57 uyumlu Expo Go APK/IPA**
> dosyasını kurun. Alternatif: `npm run web` ile tarayıcıda çalıştırın
> (adım 6'ya bakın).

**Docker kullanmak istemiyorsanız:** Kendi PostgreSQL 16 kurulumunuzu
kullanabilirsiniz; yalnızca [Adım 3](#5-adım-3--env-dosyası)'te `DATABASE_URL`
değerini kendi sunucunuza göre değiştirin. Adım 1'i atlayın.

---

## 2. Depoyu alma

### HTTPS ile (en yaygın)

```bash
git clone https://github.com/OFThub/AkBilSis.git
cd AkBilSis
```

### SSH ile

```bash
git clone git@github.com:OFThub/AkBilSis.git
cd AkBilSis
```

### ZIP olarak

GitHub sayfasında **Code → Download ZIP** → arşivi açın → klasöre girin.
(Bu yöntemde git geçmişi gelmez; katkı yapacaksanız `clone` tercih edin.)

### İndirdiğiniz klasörde ne var?

```
AkBilSis/
├── backend/     ⚙️  FastAPI sunucusu — web sitesini de bu servis eder
├── public/      🖥️  Web sitesi (giriş, yolcu paneli) — derleme adımı yok
├── private/     🔒  Yönetim paneli — yetki kontrolünden sonra servis edilir
├── mobile/      📱  Expo / React Native uygulaması
├── docs/        📚  Bu dökümanlar
└── README.md
```

> **Üç parçanın ilişkisi:** Backend hem API'yi hem web sitesini sunar. Mobil
> uygulama ayrı çalışır ve backend'e ağ üzerinden bağlanır. Web için ayrıca
> bir sunucu başlatmanıza **gerek yoktur**.

---

## 3. Adım 1 — PostgreSQL'i başlat

```powershell
cd backend
docker compose up -d
```

Çalıştığını doğrulayın:

```powershell
docker compose ps
```

`STATUS` sütununda **`healthy`** görmelisiniz. `starting` görüyorsanız birkaç
saniye bekleyip tekrar bakın — sağlık kontrolü 5 saniyede bir çalışır.

<details>
<summary>Bu komut ne yaptı?</summary>

`backend/docker-compose.yml` şu konteyneri ayağa kaldırdı:

- **İmaj:** `postgres:16`
- **Konteyner adı:** `akbil-db`
- **Kullanıcı / parola / veritabanı:** `akbil-sis` / `akbil-sis` / `akbilms`
- **Port:** `5432` (bilgisayarınıza açık)
- **Kalıcı birim:** `pgdata` — konteyner silinse de veri kalır

</details>

---

## 4. Adım 2 — Python ortamı

Sanal ortam oluşturun ve bağımlılıkları kurun:

```powershell
# Windows PowerShell — backend/ klasöründeyken
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ortamın etkin olduğunu komut satırının başındaki `(.venv)` ifadesinden
anlarsınız.

> **PowerShell "betik çalıştırılamıyor" derse:**
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```
>
> Bu yalnız o pencere için geçerlidir, kalıcı bir değişiklik yapmaz.

<details>
<summary>Neler kuruldu?</summary>

`fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg`, `pydantic`,
`pydantic-settings`, `email-validator`, `python-jose`, `bcrypt`.

Sürümler **alt sınırla** verilmiştir çünkü proje Python 3.14 ile de çalışır ve
yeni yorumlayıcı için hazır paketler yalnız güncel sürümlerde bulunur.
`passlib` bilinçli olarak kullanılmaz (Python 3.13'te kaldırılan `crypt`
modülüne bağımlı).

</details>

---

## 5. Adım 3 — `.env` dosyası

Şablonu kopyalayın:

```powershell
copy .env.example .env      # Windows
```

```bash
cp .env.example .env        # macOS / Linux
```

### Güvenlik anahtarını üretin

`.env` içindeki `SECRET_KEY` değeri şablonda bir yer tutucudur. Gerçek bir
anahtar üretin:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Çıkan değeri `.env` dosyasındaki `SECRET_KEY=` satırına yapıştırın.

### `.env` içindeki ayarlar ne işe yarar?

| Ayar | Şablondaki değer | Ne yapar |
|---|---|---|
| `DATABASE_URL` | Docker'daki Postgres'e işaret eder | Kendi sunucunuzu kullanacaksanız burayı değiştirin |
| `SECRET_KEY` | yer tutucu | **JWT imza anahtarı — mutlaka değiştirin** |
| `DEBUG` | `true` | `true` iken çerez `secure` bayrağı kapalıdır ve **HTTP üzerinden çalışır**. Yerel geliştirmede `true` bırakın |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Oturum ömrü |
| `SIM_SPEED` | `10` | Simülasyon hızı — aşağıya bakın |
| `BUS_CAPACITY` | `40` | Bir otobüsün "dolu" sayıldığı yolcu sayısı |
| `CORS_ORIGINS` | `["*"]` | Yalnız mobil gibi harici istemciler için |

> **`CARD_TOKEN_SECRET` satırını görmezden gelin.** Şablonda duruyor ama kod
> tarafından **kullanılmıyor**
> ([ayrıntı](API-VE-MIMARI.md#i-bilinen-tuhaflıklar-ve-teknik-borç)).

### `SIM_SPEED` — test kolaylığı için önemli

Otobüsler her durakta **3 sim-dakika** bekler; biniş ve iniş yalnızca bu
pencerede yapılabilir. Bu pencere gerçek zamanda:

| `SIM_SPEED` | Durakta bekleme | Yorum |
|---|---|---|
| `1` | **3 dakika** | Rahat, ama tur çok uzun sürer |
| `2` | **90 saniye** | 🟢 İlk kez deneyenler için ideal |
| `10` (varsayılan) | **18 saniye** | Hızlı, pencereyi kaçırmak kolay |
| `30` | 6 saniye | Çok hızlı, analitik testi için |

> **Öneri:** İlk denemeniz için `.env` içinde `SIM_SPEED=2` yapın. "Bin"
> düğmesini kaçırma derdiniz olmaz. Sonra `10`'a geri dönebilirsiniz.

---

## 6. Adım 4 — Şema ve veri

Üç komut, sırayla:

### 6.1 Veritabanı şemasını kur

```bash
alembic upgrade head
```

Beş göç sırayla uygulanır (`0001` → `0005`). Sonunda 8 tablo oluşur.

### 6.2 Hat, durak ve otobüsleri yükle

```bash
python -m app.seed
```

Beklenen çıktı:

```
4 hat, 24 durak yüklendi.
```

<details>
<summary>Ne yüklendi?</summary>

`backend/lines.json` dosyasından:

| Hat | Ad | Durak |
|---|---|---|
| `448` | Arnavutköy – Mecidiyeköy | 7 |
| `H-1` | Haraççı – Arnavutköy Merkez | 6 |
| `AR-2` | Taşoluk – Devlet Hastanesi | 6 |
| `AR-3` | Hadımköy – Arnavutköy | 5 |

Her hat için **gidiş ve dönüş** güzergâhı ile **3 otobüs** üretilir → toplam
12 araç. Ortak duraklar (*Arnavutköy Meydan*, *Belediye*, *Hadımköy Sanayi*)
tek kayda çözülür.

Bu komut **yeniden çalıştırılabilir**; var olan kayıtları güncelleyip
eksikleri tamamlar, veri çoğaltmaz.

</details>

### 6.3 Yönetici hesabı oluştur

```bash
python -m app.seed --admin admin@arnavutkoy.bel.tr Admin12345
```

```
admin@arnavutkoy.bel.tr yönetici olarak oluşturuldu.
```

> **Yönetici hesabı yalnızca bu komutla üretilir.** Kayıt formu asla yönetici
> hesabı oluşturmaz — güvenlik gereği. Aynı komutu var olan bir e-posta ile
> çalıştırırsanız o hesap yönetici yapılır ve parolası güncellenir.

### 6.4 (İsteğe bağlı) Demo verisi üret

Yönetim panelindeki grafikleri **dolu** görmek için:

```bash
python -m app.demo_seed
```

```
1487 seyahat uretildi (40 kart, 4 hat).
```

> ### ⚠️ Bu komut mevcut TÜM yolculukları siler
>
> `demo_seed`, `trips` tablosunu baştan yazar. Kendi test yolculuklarınızı
> yaptıktan **sonra** çalıştırırsanız onları kaybedersiniz. Sırayı şöyle
> kurun: önce demo verisini üretin, sonra kendi yolculuklarınızı yapın.

<details>
<summary>Demo verisi ne içerir?</summary>

- **40 sahte yolcu** — `demo1@akbil.local` … `demo40@akbil.local`, hepsinin
  parolası `demo1234`
- **14 günlük geçmiş** — hat başına günde 18-34 yolculuk
- Biniş saatleri hattın `hourly` profiline **ağırlıklı** seçilir → gerçekçi
  zirve saatler oluşur
- %8 oranında "yarıda kalan" yolculuk
- **12 açık yolculuk** — "Şu an araçta" kutusunu doldurur

Kart tipi dağılımı: %60 Tam, %30 Öğrenci, %10 65+.

</details>

---

## 7. Adım 5 — Sunucuyu başlat

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> ### `--host 0.0.0.0` neden şart?
>
> Varsayılan olarak uvicorn yalnızca `127.0.0.1` adresini dinler — yani
> **sadece bilgisayarın kendisi** erişebilir. Telefonunuzun backend'e
> ulaşabilmesi için sunucunun tüm ağ arayüzlerini dinlemesi gerekir.
> Sadece tarayıcıda deneyecekseniz bu bayrak gerekmez.

### Çalıştığını doğrulayın

```bash
curl http://localhost:8000/health
```

```json
{"status":"ok","app":"Akbil Takip Sistemi","database":"up"}
```

`"database":"down"` görüyorsanız Postgres konteyneri ayakta değildir → Adım 1'e
dönün.

Hatların yüklendiğini doğrulayın:

```bash
curl http://localhost:8000/api/v1/transit/lines
```

4 hat içeren bir JSON dizisi dönmelidir.

### Açabileceğiniz adresler

| Adres | Ne var |
|---|---|
| <http://localhost:8000> | Web sitesi — giriş / kayıt |
| <http://localhost:8000/docs> | Etkileşimli API dökümanı (Swagger UI) |
| <http://localhost:8000/admin> | Yönetim paneli (yönetici girişi gerekir) |
| <http://localhost:8000/health> | Bağlantı testi |

> **Bu pencereyi açık bırakın.** Sunucu burada çalışır. Mobil için **yeni bir
> terminal penceresi** açın.

---

## 8. Adım 6 — Mobil uygulama

**Yeni bir terminal** açın ve proje kökünden:

```bash
cd mobile
npm install        # yalnız ilk seferde
npm start
```

Ekranda bir **QR kod** belirir.

### Telefonda çalıştırma (önerilen)

1. Telefonunuz ve bilgisayarınız **aynı Wi-Fi ağında** olmalı.
2. **Expo Go** uygulamasını açın.
3. QR kodu okutun.

Uygulama açıldığında Metro günlüğünde şu satırı görmelisiniz:

```
[akbil] backend adresi: http://192.168.1.20:8000
```

> **Backend adresini elle girmenize gerek yok.** Uygulama, kendisini indirdiği
> Expo/Metro sunucusunun adresinden türetir — aynı bilgisayar, port 8000.
> Böylece Wi-Fi veya DHCP adresi değiştiğinde hiçbir dosya güncellenmez.

### Tarayıcıda çalıştırma (alternatif)

Telefon sorunu yaşıyorsanız:

```bash
npm run web
```

Uygulama tarayıcıda açılır. Tüm özellikler çalışır.

### `mobile/.env` ne zaman gerekir?

**Yalnızca** backend başka bir makinede ya da başka bir portta çalışıyorsa:

```bash
cp .env.example .env
```

`.env` içine:

```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.20:8000
```

> `.env` değiştikten sonra **Metro önbelleğini temizleyin**, aksi hâlde eski
> değer kullanılmaya devam eder:
>
> ```bash
> npx expo start -c
> ```

---

## 9. Ağ sorun giderme

Belirti size hangi katmanın koptuğunu söyler:

| Belirti | Sebep | Çözüm |
|---|---|---|
| Uygulama **hiç açılmıyor**, QR'da `IOException` | ① Expo Go sürümü eski (SDK 57 değil) ② Telefon bilgisayara hiç ulaşamıyor: Wi-Fi istemci yalıtımı (AP isolation) veya farklı ağ | ① SDK 57 uyumlu Expo Go kurun ② Aynı Wi-Fi'da olun; kurumsal/misafir ağda yalıtım açıksa **telefonun hotspot'unu** kullanın ve bilgisayarı ona bağlayın |
| Uygulama açılıyor, **"Sunucuya ulaşılamadı"** | Backend çalışmıyor **veya** 8000 portu güvenlik duvarında kapalı | Aşağıdaki iki adım |
| Metro günlüğünde `backend adresi: http://localhost:8000` **uyarısı** | Metro'nun adresi okunamadı; telefonda `localhost` telefonun kendisidir | `mobile/.env` içine `EXPO_PUBLIC_BACKEND_URL=http://<bilgisayar-ip>:8000` yazın, `npx expo start -c` |

### Adım 1 — Backend gerçekten dinliyor mu?

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 8000
```

```bash
# macOS / Linux
lsof -iTCP:8000 -sTCP:LISTEN
```

Boş dönerse uvicorn çalışmıyordur. `--host 0.0.0.0` ile başlattığınızdan emin
olun; `127.0.0.1` ile başlatılırsa yalnızca bilgisayarın kendisi erişebilir.

### Adım 2 — Güvenlik duvarı 8000'e izin veriyor mu?

**Windows kuralları dosya yoluna göredir**: sistem python'una verilmiş bir izin
`backend\.venv\Scripts\python.exe` için geçerli değildir. Bu yüzden **port
bazlı** bir kural gerekir (yönetici PowerShell):

```powershell
New-NetFirewallRule -DisplayName "AkBil backend 8000" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 `
  -Action Allow -Profile Private,Public
```

Geri almak için:

```powershell
Remove-NetFirewallRule -DisplayName "AkBil backend 8000"
```

### Adım 3 — Doğrulama

Bilgisayarınızın IP adresini öğrenin:

```powershell
ipconfig | Select-String IPv4        # Windows
```

```bash
ipconfig getifaddr en0               # macOS
hostname -I                          # Linux
```

**Telefonun tarayıcısında** şu adresi açın:

```
http://<bilgisayar-ip>:8000/health
```

`{"status":"ok",...}` görüyorsanız ağ yolu tamamdır; sorun uygulamadadır.
Görmüyorsanız sorun ağ/güvenlik duvarındadır.

---

## 10. Senaryo 1 — Normal yolculuk

**Amaç:** Kayıttan başlayıp bir yolculuğu tamamlamak ve kaydın hem mobilde hem
web'de göründüğünü doğrulamak.

> **Hazırlık:** `.env` içinde `SIM_SPEED=2` yapmanız önerilir — biniş penceresi
> 18 saniye yerine 90 saniye olur. Değişiklikten sonra uvicorn otomatik yeniden
> başlar (`--reload`).

### Adım 1 — Hesap oluştur (mobil)

1. Uygulamayı açın → **Hesap Oluştur** sekmesi
2. Doldurun:
   - **Ad Soyad:** `Ayşe Yılmaz`
   - **E-posta:** `ayse@example.com`
   - **Şifre:** `gizli12345`
   - **Kart Tipi:** **Öğrenci**
3. **Hesap Oluştur**

**Beklenen:** Sistem sizi otomatik içeri alır, alt kısımda dört sekme belirir
(🚌 Yolculuk · 💳 Kart · 🕓 Geçmiş · ⚙️ Ayarlar).

### Adım 2 — Kartı kontrol et

**Kart** sekmesine geçin.

**Beklenen:**

- Lacivert sanal kart, sağ üstte yeşil **ÖĞRENCİ** rozeti
- `Ayşe Yılmaz` ve `A1B2 C3D4` biçiminde bir numara
- Yolculuk sayısı: `0`

### Adım 3 — Hat seç

**Yolculuk** sekmesi → listeden **448** hattına dokunun.

**Beklenen:** "Yoldaki otobüsler" bölümünde 3 otobüs kartı belirir
(`34 44801`, `34 44802`, `34 44803`). Konum yazıları 2 saniyede bir güncellenir.

### Adım 4 — Durakta bekleyen aracı bul

Otobüs kartlarını izleyin. Konum yazısı üç halden birini gösterir:

| Yazı | Düğme | Anlamı |
|---|---|---|
| `Taşoluk durağında` | **Bin** (aktif) | 🟢 Şimdi binebilirsiniz |
| `Taşoluk → Haraççı · 4 dk` | `4 dk · Haraççı` (pasif) | Araç yolda |
| `Sefer bekliyor — 3 dk` | `Sefer bekliyor` (pasif) | Araç molada |

**"Bin" düğmesi turuncu ve basılabilir olana kadar bekleyin.**

### Adım 5 — Bin

**Bin** düğmesine basın.

**Beklenen:**

- Ekranın üstünde yeşil bant: *"Taşoluk durağında 448 hattına bindiniz."*
- Ekran anında değişir: lacivert **ARAÇTASINIZ** bandı belirir
- Artık yalnızca **Otobüsten İn** kartı vardır — başka araca binmenin yolu yoktur

### Adım 6 — Şemada aracı izle

Sayfayı aşağı kaydırın → **hat şeması**.

**Beklenen:**

- Bindiğiniz durak **mavi noktayla** işaretli, yanında *"Bindiğiniz durak"*
- 🚌 işareti aracın konumunu gösterir ve duraklar arasında ilerler
- **⇅ Yön değiştir** düğmesiyle gidiş/dönüş görünümü arasında geçebilirsiniz

### Adım 7 — İn

İniş kartına dönün. Düğme şu sırayla değişir:

```
Durak bekleniyor…   →   Otobüsten İn   →   (basın)
```

**Otobüsten İn** aktifleştiğinde basın.

**Beklenen:**

- Yeşil bant: *"Haraççı durağında indiniz. İyi günler!"*
- Ekran "Araçta değil" hâline döner

> **"Henüz durak değişmedi" hatası aldıysanız:** Bindiğiniz durakta inmeye
> çalıştınız. Aracın bir sonraki durağa varmasını bekleyin. Bu kural
> kasıtlıdır — [ayrıntı](KULLANIM-KILAVUZU.md#11-sistemin-kuralları).

### Adım 8 — Geçmişi doğrula

**Geçmiş** sekmesi.

**Beklenen:**

```
┌──────────────────────────────────────┐
│ 09:14 – 09:26          [Tamamlandı]  │
│ 448 Arnavutköy – Mecidiyeköy         │
│ Taşoluk → Haraççı · 12 dk            │
└──────────────────────────────────────┘
```

### Adım 9 — Web'de aynı kaydı gör

Tarayıcıda <http://localhost:8000> → aynı hesapla giriş yapın
(`ayse@example.com` / `gizli12345`).

**Beklenen:**

- Sanal kartta **ÖĞRENCİ** rozeti ve `Yolculuk: 1`
- **Son yolculuklarım** tablosunda az önceki kayıt, `Tamamlandı` rozetiyle

✅ **Senaryo tamamlandı.** Tek hesap, iki istemci, tek doğruluk kaynağı.

---

## 11. Senaryo 2 — Otomatik iniş

**Amaç:** İnmeyi unutan yolcunun son durakta otomatik indirildiğini doğrulamak.

> **Hazırlık:** Bu senaryo aracın son durağa varmasını gerektirir. `SIM_SPEED`
> yüksekse daha çabuk biter — geçici olarak `.env` içinde `SIM_SPEED=20`
> yapabilirsiniz.

### Adımlar

1. **Yolculuk** sekmesinden bir otobüse **binin** (Senaryo 1, adım 4-5).
2. **İnmeyin.** Ekranı açık bırakıp bekleyin.
3. Aracın hat şemasında ilerlemesini izleyin.

**Beklenen:** Araç son durağa vardığında ekran kendiliğinden "Araçta değil"
hâline döner. Hiçbir düğmeye basmanıza gerek kalmaz.

4. **Geçmiş** sekmesine bakın.

**Beklenen:** Yolculuk **Tamamlandı** olarak kaydedilmiş; iniş durağı hattın
**son durağıdır** (448 gidiş yönünde *Mecidiyeköy*).

### Bu nasıl çalışıyor?

Otomatik iniş anı, siz **bindiğiniz anda** hesaplanıp veritabanına yazılır
(`auto_alight_at`). Sunucudaki bir arkaplan görevi 5 saniyede bir vadesi gelen
yolculukları kapatır.

**Sonuç:** Uygulamayı kapatsanız, telefonunuz kapansa, hatta sunucu yeniden
başlasa bile iniş doğru anda ve doğru durakta gerçekleşir.
[Teknik ayrıntı](API-VE-MIMARI.md#b7-appservicespy--749-satır)

---

## 12. Senaryo 3 — Yarıda kalan yolculuk

**Amaç:** Açık yolculuğu varken başka araca binen yolcunun eski kaydının
"Yarıda kaldı" olduğunu doğrulamak.

### Adımlar

1. Bir otobüse **binin**, inmeyin.
2. Uygulamada başka araca binmenin yolu **yoktur** — bu kural arayüzde
   uygulanır. Bu yüzden ikinci binişi **API üzerinden** yapacağız.
3. Tarayıcıda <http://localhost:8000/docs> adresini açın.
4. Önce token alın: `POST /api/v1/auth/login` → **Try it out** →

   ```json
   { "email": "ayse@example.com", "password": "gizli12345" }
   ```

   Yanıttaki `access_token` değerini kopyalayın.
5. Sağ üstteki **Authorize** düğmesine basın, token'ı yapıştırın.
6. Başka bir aracın kimliğini bulun:
   `GET /api/v1/transit/lines/{line_id}/buses` → `at_stop: true` olan **farklı**
   bir aracın `id` değerini kopyalayın.
7. `POST /api/v1/validate` → **Try it out** →

   ```json
   { "bus_id": "<kopyaladığınız-id>" }
   ```

**Beklenen yanıt:**

```json
{ "action": "boarded", "...": "..." }
```

8. Mobilde **Geçmiş** sekmesini yenileyin (aşağı çekin).

**Beklenen:** İki kayıt görürsünüz:

| Kayıt | Durum |
|---|---|
| Önceki yolculuk | **Yarıda kaldı** |
| Yeni yolculuk | **Otobüste** |

> **Kural:** Kişi başına aynı anda yalnızca **bir** açık yolculuk olabilir. Bu
> kısıt veritabanı düzeyinde zorlanır, uygulama katmanında değil — iki
> eşzamanlı istek bile bunu aşamaz.

---

## 13. Senaryo 4 — Yönetici kararı

**Amaç:** Belediyenin "hangi hatta sefer artırmalıyım?" sorusunu panelden
cevaplamak.

> **Hazırlık:** Anlamlı grafikler için demo verisi gerekir:
>
> ```bash
> python -m app.demo_seed
> ```

### Adımlar

1. Tarayıcıda <http://localhost:8000> → **yönetici hesabıyla** giriş yapın:
   `admin@arnavutkoy.bel.tr` / `Admin12345`
2. Üst bantta **Yönetim** bağlantısı belirir (normal yolcuda görünmez) → tıklayın.

### Panel neyi anlatıyor?

**① Özet kutuları** — Toplam yolculuk, şu an araçta, aktif otobüs, en yoğun saat.

**② Saatlik yoğunluk** — Gün içinde hangi saatte kaç biniş yapıldığı. Sabah ve
akşam iki tepe görmelisiniz.

**③ Günlük talep trendi** — Başlığın yanındaki özet en kritik bilgidir:

> *· Günlük ortalama 42.5 biniş · en yoğun gün 21 Tem · ↑ %18.3 artış*

Yüzde, dönemin **ilk yarısı ile ikinci yarısının** günlük ortalamalarını
karşılaştırır. Yeşil ↑ talebin arttığını söyler.

**④ Hat yoğunluğu ve sefer önerisi** — Kararın verildiği yer.

En üstteki karta bakın (kartlar en yüklüden en boşa sıralanır):

| Satır | Örnek | Ne demek |
|---|---|---|
| Toplam yolculuk | 412 | Dönemdeki toplam |
| En yoğun saat | 08:00–09:00 | Hattın zirvesi |
| Zirvede biniş | 60 | Zirve saatteki günlük ortalama |
| Aktif otobüs | 3 | Hatta çalışan araç |
| **Araç başına** | **20 yolcu** | ← **karar bu sayıya dayanır** |

Renk ve öneri buradan çıkar:

| Araç başına / `BUS_CAPACITY` | Renk | Öneri |
|---|---|---|
| `< %40` | 🟢 Düşük yoğunluk | *"Araçlar boş gidiyor — sefer azaltılabilir"* |
| `%40 – %75` | 🟡 Normal | *"Sefer sayısı yeterli"* |
| `> %75` | 🔴 Yüksek yoğunluk | *"Zirve saatte araçlar doluyor — sefer artırılmalı"* |

**Örnek hesap:** 7 günde zirve saatte 420 biniş → günlük ortalama `420/7 = 60`
→ 3 araç → araç başına `60/3 = 20` → `20/40 = %50` → **Normal**.

### Kararı doğrulayın

Kırmızı bir hat gördünüz diyelim. Sorulacak ikinci soru: **talep artıyor mu?**
③ numaralı grafikteki trend yüzdesine bakın. Hem kırmızı hem ↑ artış varsa
sefer artırma kararı sağlamdır.

**⑤ En yoğun duraklar** — Grafiğin altındaki *"Sıkışık duraklar: …"* yazısı
renk körlüğünden bağımsız okunur.

**⑥ Kart tipi dağılımı** — Öğrenci oranı yüksek bir hatta okul saatleri
belirleyicidir.

**⑦ En yoğun güzergâhlar** — Hangi duraklar arası en çok yolculuk yapılıyor.
Yalnız **tamamlanmış** yolculuklar sayılır.

**⑧ Son yapılan yolculuklar** — 15 saniyede bir yenilenen canlı akış. Senaryo
1'de yaptığınız yolculuk burada da görünür.

### Yetki kontrolünü test edin

Yönetici oturumunu kapatın, normal yolcu hesabıyla girin ve adres çubuğuna elle
<http://localhost:8000/admin> yazın.

**Beklenen:** Sayfa açılmaz, giriş sayfasına yönlendirilirsiniz. HTML hiç
üretilmez — [üç katmanlı koruma](API-VE-MIMARI.md#d4-admin-sayfasının-korunması).

---

## 14. Senaryo 5 — Kart tipi düzeltme

**Amaç:** Belgesini ibraz etmeyen bir öğrencinin kartını Tam tarifeye çevirmek
ve geçmiş kayıtların değişmediğini doğrulamak.

### Adımlar

1. <http://localhost:8000/docs> adresini açın.
2. **Yönetici** hesabıyla token alın: `POST /api/v1/auth/login` →

   ```json
   { "email": "admin@arnavutkoy.bel.tr", "password": "Admin12345" }
   ```

3. **Authorize** → `access_token` yapıştırın.
4. Yolcuyu bulun: `GET /api/v1/admin/passengers?q=ayse` → `id` değerini alın.
5. Kartını bulun — kart kimliğini almanın en pratik yolu, o yolcunun kendi
   oturumuyla `GET /api/v1/cards` çağırmaktır. (Yönetici uçlarında kart
   listeleme yoktur.)
6. Tipi değiştirin: `PATCH /api/v1/admin/cards/{card_id}/type` →

   ```json
   { "card_type": "normal" }
   ```

**Beklenen yanıt:** `card_type` alanı `"normal"` olan güncel kart.

### Doğrulama

7. Mobilde **Kart** sekmesini yenileyin → rozet artık turuncu **TAM**.
8. **Geçmiş** sekmesine bakın → eski yolculuklar **değişmemiştir**.
9. Yönetim panelinde **Kart tipi dağılımı** grafiğine bakın → o yolculuklar
   hâlâ **Öğrenci** olarak sayılıyor.

> **Neden geçmiş değişmedi?** Kart tipi, yolculuk başladığı anda kayda
> **damgalanır** (`card_type_snapshot`). Sonradan yapılan düzeltmeler geçmişi
> yeniden yazmaz — analitik geçmişe dönük olarak bozulmaz. Süren bir yolculuk
> varsa o da etkilenmez.

---

## 15. Sıfırlama

### Yalnızca yolculukları temizle

```bash
python -m app.demo_seed
```

Bu komut `trips` tablosunu boşaltıp yeni demo verisi üretir. Hesaplar, hatlar ve
duraklar korunur.

### Her şeyi sil ve baştan kur

```powershell
# backend/ klasöründeyken
docker compose down -v          # -v: kalıcı veri birimini de siler
docker compose up -d
alembic upgrade head
python -m app.seed
python -m app.seed --admin admin@arnavutkoy.bel.tr Admin12345
python -m app.demo_seed         # isteğe bağlı
```

> `-v` bayrağı olmadan `docker compose down` yalnızca konteyneri durdurur; veri
> `pgdata` biriminde kalır ve tekrar başlattığınızda geri gelir.

### Mobil uygulamanın yerel verisini temizle

Uygulamada **Ayarlar → Çıkış Yap**. Oturum telefondan silinir; sunucudaki
kayıtlarınız korunur.

---

## 16. Sık karşılaşılan hatalar

### Kurulum

| Hata | Sebep | Çözüm |
|---|---|---|
| `Target database is not up to date` | Göçler uygulanmamış | `alembic upgrade head` |
| `Can't locate revision identified by '0005'` | Depo eksik indirilmiş | `git pull` ya da yeniden klonlayın |
| `connection to server ... failed` | Postgres ayakta değil | `docker compose up -d`, sonra `docker compose ps` ile `healthy` bekleyin |
| `port 5432 is already allocated` | Bilgisayarda başka bir Postgres çalışıyor | Onu durdurun **veya** `docker-compose.yml` içinde portu `5433:5432` yapıp `.env`'deki `DATABASE_URL`'i güncelleyin |
| `[Errno 10048] address already in use` (8000) | 8000 portu dolu | Başka bir uvicorn açık olabilir; kapatın ya da `--port 8001` kullanın |
| `psycopg` kurulum hatası | Eski `pip` | `python -m pip install --upgrade pip` sonra tekrar deneyin |
| `ValidationError: database_url field required` | `.env` yok ya da yanlış klasörde | `.env` **`backend/` içinde** olmalı; `copy .env.example .env` |

### Çalışma anı

| Hata | Sebep | Çözüm |
|---|---|---|
| Kayıtta `Parola en fazla 72 bayt olabilir` | Şifre çok uzun (Türkçe karakterler fazla yer kaplar) | Daha kısa şifre |
| Web'de giriş yapılıyor ama panel açılmıyor | `.env` içinde `DEBUG=false` → çerez yalnız HTTPS'te gönderilir | Yerel geliştirmede `DEBUG=true` |
| `/admin` sürekli giriş sayfasına atıyor | Hesap yönetici değil | `python -m app.seed --admin <eposta> <parola>` |
| Yönetim uçlarından `403` | Yolcu token'ı kullanılıyor | Yönetici hesabıyla giriş yapın |
| Grafikler boş | Hiç yolculuk yok | `python -m app.demo_seed` |
| "Bin" düğmesi hiç aktifleşmiyor | Biniş penceresi çok kısa (`SIM_SPEED=10` → 18 sn) | `.env` içinde `SIM_SPEED=2` |
| Sürekli yeniden giriş isteniyor | Aynı hesap iki cihazda; token tazelemesi diğerini düşürüyor | Bilinen davranış — [ayrıntı](API-VE-MIMARI.md#d3-token_version-rotasyonu) |

### Mobil

| Hata | Sebep | Çözüm |
|---|---|---|
| QR okutunca uygulama açılmıyor | Expo Go sürümü SDK 57 değil | SDK 57 uyumlu Expo Go kurun ya da `npm run web` |
| "Sunucuya ulaşılamadı" | Backend kapalı / güvenlik duvarı / farklı ağ | [Ağ sorun giderme](#9-ağ-sorun-giderme) |
| Metro günlüğünde `localhost` uyarısı | Metro adresi okunamadı | `mobile/.env` içine `EXPO_PUBLIC_BACKEND_URL` yazıp `npx expo start -c` |
| `.env` değişti ama etkisi yok | Metro önbelleği | `npx expo start -c` |
| `npm install` hatası | Node sürümü eski | Node 20+ kurun |

---

## 17. Geliştirme akışı

### Dal açma ve katkı

```bash
git checkout -b ozellik/kisa-aciklama
# … değişiklikleri yapın …
git add -A
git commit -m "Kısa ve açıklayıcı mesaj"
git push -u origin ozellik/kisa-aciklama
```

Ardından GitHub'da Pull Request açın.

### Katman kuralına uyun

Kod değiştirirken bu zinciri bozmayın:

```
routes.py  →  services.py  →  repositories.py  →  models.py
```

| Yapmayın | Neden |
|---|---|
| `routes.py` içine iş kuralı yazmak | Kural test edilemez hâle gelir |
| `services.py` içine ham SQL yazmak | Sorgu tek yerde toplanamaz |
| `repositories.py` içinde `commit` çağırmak | Servis birden çok işlemi tek işlemde toplayamaz |
| `simulation.py` içinden veritabanına dokunmak | Saf matematik olma özelliği kaybolur |

Ayrıntı: [Katman sözleşmesi](API-VE-MIMARI.md#a2-katman-diyagramı)

### Yeni bir şema göçü ekleme

```bash
alembic revision -m "kisa_aciklama"
```

`backend/alembic/versions/` altında yeni bir dosya oluşur. `upgrade()` ve
`downgrade()` fonksiyonlarını doldurun, sonra:

```bash
alembic upgrade head
```

> **Enum uyarısı:** Enum sütunları `native_enum=False` ile tanımlıdır — Postgres
> tarafında değerler **enum ADIYLA** saklanır (`'OPEN'`, `'open'` değil). Elle
> SQL yazarken buna dikkat edin.

Göçü geri almak için:

```bash
alembic downgrade -1
```

### Hat / durak verisini değiştirme

`backend/lines.json` dosyasını düzenleyin, sonra:

```bash
python -m app.seed
```

Komut **yeniden çalıştırılabilir**: var olan hatların adı ve saatlik profili
güncellenir, güzergâh yeniden kurulur, eksik otobüsler tamamlanır.

`lines.json` biçimi:

```json
{
  "code": "448",
  "name": "448 Arnavutköy – Mecidiyeköy",
  "hourly": [2, 1, 1, 1, 3, 12, 38, 82, 100, 71, 42, 35,
             33, 34, 38, 46, 63, 88, 95, 70, 44, 26, 14, 6],
  "stops": [
    { "name": "Arnavutköy Meydan", "minutes_from_previous": null },
    { "name": "Fatih Caddesi",     "minutes_from_previous": 6 }
  ]
}
```

| Alan | Kural |
|---|---|
| `code` | Benzersiz, en fazla 16 karakter |
| `hourly` | **Tam 24 eleman** olmalı; değilse sıfırlanır |
| `stops[].minutes_from_previous` | İlk durakta `null`, diğerlerinde dakika |

Dönüş yönü otomatik üretilir — ayrıca tanımlamanıza gerek yoktur.

### Web tarafında değişiklik

`public/` altındaki dosyalar **doğrudan** servis edilir. Derleme adımı yoktur;
dosyayı kaydedip tarayıcıyı yenilemek yeterlidir.

Betik sırası bağımlılık sırasıdır, değiştirmeyin:

```
chart.umd.js → api.js → auth.js → charts.js → panel.js|admin.js
```

### Mobil tarafında değişiklik

Metro çalışırken dosyayı kaydedin — değişiklik anında yansır (Fast Refresh).
`.env` veya `app.json` değiştiyse `npx expo start -c` gerekir.

TypeScript **strict** kipte çalışır. Yeni bir çeviri anahtarı eklerken `tr` ve
`en` sözlüklerinin ikisine de eklemeniz gerekir — aksi hâlde derleme hata verir.

---

<div align="center">

**Arnavutköy Belediyesi — Akbil Simülasyon Projesi**

[Kullanıcı Kılavuzu](KULLANIM-KILAVUZU.md) ·
[API ve Mimari](API-VE-MIMARI.md) ·
[Proje ana sayfası](../README.md)

</div>
