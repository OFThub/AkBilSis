# Kullanıcı Kılavuzu

**Arnavutköy Belediyesi — Akbil Simülasyon Sistemi**

Bu kılavuz sistemi *kullanan* kişiler içindir: otobüse binen yolcu ve hat
yoğunluklarını izleyen belediye yöneticisi. Kod bilgisi gerektirmez; hiçbir
yerde dosya adı ya da teknik terim kullanılmaz.

| Ne arıyorsanız | Nereye bakın |
|---|---|
| Sistemi kurmak / çalıştırmak | [Kullanım Senaryosu](KULLANIM-SENARYOSU.md) |
| Kodun nasıl çalıştığı | [API ve Mimari Dökümantasyonu](API-VE-MIMARI.md) |
| Uygulamayı kullanmak | **bu doküman** |

---

## İçindekiler

1. [Bu sistem ne yapar](#1-bu-sistem-ne-yapar)
2. [Sözlük](#2-sözlük)
3. [Web sitesi — Kayıt olma](#3-web-sitesi--kayıt-olma)
4. [Web sitesi — Giriş ve Hesabım paneli](#4-web-sitesi--giriş-ve-hesabım-paneli)
5. [Mobil uygulama — İlk açılış](#5-mobil-uygulama--ilk-açılış)
6. [Mobil — Yolculuk sekmesi](#6-mobil--yolculuk-sekmesi)
7. [Mobil — Kart sekmesi](#7-mobil--kart-sekmesi)
8. [Mobil — Geçmiş sekmesi](#8-mobil--geçmiş-sekmesi)
9. [Mobil — Ayarlar sekmesi](#9-mobil--ayarlar-sekmesi)
10. [Yönetim paneli](#10-yönetim-paneli)
11. [Sistemin kuralları](#11-sistemin-kuralları)
12. [Karşılaşabileceğiniz mesajlar](#12-karşılaşabileceğiniz-mesajlar)
13. [Sık sorulan sorular](#13-sık-sorulan-sorular)
14. [Erişilebilirlik](#14-erişilebilirlik)

---

## 1. Bu sistem ne yapar

Sistem, bir toplu ulaşım kartının ("akbil") günlük hayatını **simüle eder**.
Gerçek bir otobüse binmeden, telefonunuzdan kart basma deneyimini yaşarsınız ve
belediye bu yolculuklardan hat yoğunluğu analizi çıkarır.

Üç parçadan oluşur:

| Parça | Kim kullanır | Ne yapar |
|---|---|---|
| **Mobil uygulama** | Yolcu | Otobüse binme ve inme (kart basma), kart bilgileri, favori hatlar, yolculuk geçmişi |
| **Web sitesi** | Yolcu | Aynı hesapla kart bilgilerini, hat yoğunluk saatlerini ve yolculuk geçmişini görüntüleme |
| **Yönetim paneli** | Belediye yöneticisi | Hangi hatta sefer artırılmalı/azaltılmalı, hangi duraklar sıkışık, talep artıyor mu |

> ### ⚠️ Önemli: Bu sistemde para yoktur
>
> **Bakiye, ücret, dolum ve tarife kavramı bulunmaz.** Kartınızda para
> görmezsiniz, yolculuk sizden bir şey düşmez. "Tam", "Öğrenci" ve "65+"
> yalnızca bir **statü** bilgisidir; belediyenin hangi yolcu grubunun ne kadar
> seyahat ettiğini görmesini sağlar.

**Nasıl çalışır (özet):** Otobüsler sanaldır ve gerçek saate göre hatları
üzerinde sürekli hareket eder. Uygulamayı açtığınızda araçların o anda tam
olarak nerede olduğunu görürsünüz. Bir araç **durakta beklerken** "Bin"
diyebilirsiniz; sonraki duraklardan birinde "İn" dediğinizde yolculuğunuz
kaydedilir.

---

## 2. Sözlük

| Terim | Anlamı |
|---|---|
| **Hat** | Belirli bir güzergâhta çalışan otobüs servisi. Bir kodu (`448`, `H-1`) ve adı vardır. |
| **Durak** | Otobüsün yolcu alıp bıraktığı nokta. Bir durak birden fazla hatta ortak olabilir. |
| **Gidiş / Dönüş** | Hattın iki yönü. Araç son durağa varınca döner ve aynı güzergâhı ters yönde kat eder. |
| **Sefer** | Bir aracın hattı baştan sona bir kez kat etmesi. |
| **Biniş** | Otobüse bindiğinizde kart basma işlemi. Yolculuğunuz burada başlar. |
| **İniş** | Otobüsten indiğinizde ikinci kez kart basma. Yolculuğunuz burada kapanır ve kaydedilir. |
| **Açık yolculuk** | Bindiniz ama henüz inmediniz. Aynı anda yalnızca **bir** açık yolculuğunuz olabilir. |
| **Yarıda kalan yolculuk** | İnmeden başka bir araca bindiğinizde, önceki yolculuk bu duruma düşer. |
| **Otomatik iniş** | İnmeyi unutursanız, otobüs son durağa vardığında sistem sizi orada indirir. |
| **Mola (sefer bekliyor)** | Araç son durağa vardı, yeni sefere başlamadan önce bekliyor. Bu sırada yolcu alınmaz. |
| **Kart tipi** | Tam · Öğrenci · 65+. Yalnızca statü bilgisidir, ücretle ilgisi yoktur. |
| **Yoğunluk profili** | Bir hattın gün içinde saat saat *beklenen* kalabalıklığı. |

---

## 3. Web sitesi — Kayıt olma

Tarayıcınızda sitenin adresini açtığınızda **Giriş / Kayıt** ekranı gelir.

1. **Kayıt Ol** sekmesine geçin.
2. Formu doldurun:

| Alan | Kural |
|---|---|
| **Ad Soyad** | En az 2, en fazla 100 karakter |
| **E-posta** | Geçerli bir e-posta adresi. Sistemde **benzersiz** olmalı — aynı adresle ikinci hesap açılamaz. |
| **Şifre** | **En az 8 karakter.** Çok uzun şifreler kabul edilmez (72 baytı aşamaz — Türkçe karakterler birden fazla bayt yer kaplar, yani ~35-70 karakter üst sınırdır). |

3. **Kart Tipi** seçin — üç kutudan biri:

| Seçenek | Kimin için | Not |
|---|---|---|
| **Tam** | Standart yolcu | Varsayılan seçenek |
| **Öğrenci** | Öğrenciler | Belge ile doğrulanır |
| **65+** | 65 yaş ve üzeri | Belge ile doğrulanır |

> **Beyan sistemi:** Seçtiğiniz kart tipi anında kabul edilir, sistem belge
> istemez. Ancak Öğrenci ve 65+ için **belgenizi belediyeye ibraz etmeniz
> gerekir.** Doğrulanmazsa yönetici kartınızı Tam tarifeye çevirir. Bu
> değişiklik geçmiş yolculuklarınızı etkilemez.

4. **Hesap Oluştur** düğmesine basın.

Kayıt başarılıysa sistem sizi **otomatik olarak giriş yapar** ve doğrudan
Hesabım paneline yönlendirir; bilgilerinizi ikinci kez yazmanız gerekmez.

Kayıt sırasında hesabınıza otomatik olarak bir **mobil akbil kartı** tanımlanır.
Ayrıca kart başvurusu yapmanız gerekmez.

**Giriş yapmak için:** **Giriş Yap** sekmesinde e-posta ve şifrenizi girin.
Mobil uygulama ve web sitesi **aynı hesabı** kullanır.

---

## 4. Web sitesi — Giriş ve Hesabım paneli

Giriş yaptığınızda **Hesabım** sayfası açılır. Sayfa dört bölümden oluşur.

### Üst bant

| Öğe | Açıklama |
|---|---|
| Belediye logosu ve başlık | Sol üstte |
| **Hesabım** | Bulunduğunuz sayfa |
| **Yönetim** | **Yalnızca yönetici hesaplarında görünür.** Normal yolcuda bu bağlantı hiç basılmaz. |
| Adınız | Sağ üstte, oturumun kime ait olduğunu gösterir |
| Saat | Anlık saat, 30 saniyede bir güncellenir |
| **Çıkış** | Oturumu kapatır, giriş ekranına döner |

Üst bandın altındaki turuncu-noktalı şerit, hat şeması motifidir; süs amaçlıdır.

### Sanal akbil kartı

Lacivert zeminli, gerçek bir kartı andıran görsel:

- **Sağ üst rozet** — kart tipiniz: `TAM`, `ÖĞRENCİ` veya `65+`
- **Ad Soyad** — kart sahibi
- **Kart numarası** — `A1B2 C3D4` biçiminde 8 haneli. Bu numara kart kimliğinizin
  son 8 hanesinden üretilir. Fiziksel kartınız varsa onun NFC kimliği kullanılır.
- **Yolculuk** — panelde listelenen yolculuk sayınız
- Sağ altta `AKBİL` yazısı

Kartınız yoksa numara yerine **"Kart yok"** yazar.

### Durum kutusu

| Satır | Ne gösterir |
|---|---|
| **Ad Soyad** | Hesap sahibi |
| **E-posta** | Giriş yaptığınız adres |
| **Kart durumu** | `Aktif` ya da `Pasif — belediyeye başvurun` |
| **Favori hat** | Favori hatlarınızın kodları. Favori yoksa: *"Henüz favori hat yok (mobil uygulamadan ekleyebilirsiniz)"* |

**Şu an araçtaysanız**, kutunun altında mavi bir bant belirir:

> **Şu an araçtasınız**
> 448 Arnavutköy – Mecidiyeköy
> *Taşoluk durağından 08:42'de bindiniz.*

Yolculuğunuz kapandığında bu bant kendiliğinden kaybolur.

### Hatların yoğunluk saatleri

Sayfanın en geniş kartı. Kullanımı:

1. Üstteki **hat çiplerinden** birine tıklayın. Her çipte hattın kodu ve adı
   vardır; favori hatlarınızın yanında **★** işareti bulunur.
2. Çipin altındaki yazı, seçtiğiniz hattın **en yoğun iki saat dilimini**
   söyler:
   *"448 Arnavutköy – Mecidiyeköy — en yoğun saatler: 08:00–09:00 · 18:00–19:00"*
3. Altındaki çubuk grafik, hattın **24 saatlik beklenen yoğunluğunu** gösterir.
   Bir çubuğun üzerine gelirseniz o saatin değerini görürsünüz.

> **Bu grafik ne anlatır?** Hattın *beklenen* gün içi profilidir — yani
> belediyenin o hat için öngördüğü yoğunluk. Gerçekte yapılan yolculuk
> sayıları değildir. Gerçek sayılar Yönetim panelinde durur; ikisi bilerek ayrı
> tutulur.

Sayfa açıldığında **favori hatlarınızdan biri** otomatik seçilir; favoriniz
yoksa listedeki ilk hat gelir.

### Son yolculuklarım

Yalnızca **size ait** son 20 kayıt. Beş sütun:

| Sütun | İçerik |
|---|---|
| **Saat** | `08:42 – 09:05`. Henüz inmediyseniz: `08:42 – …` |
| **Hat** | Hattın kod rozeti (`448`) |
| **Güzergâh** | `Taşoluk → Mecidiyeköy`. İnmediyseniz: *"Taşoluk durağından bindi"* |
| **Süre** | Dakika cinsinden yolculuk süresi. Devam ediyorsa `—` |
| **Durum** | `Otobüste` · `Tamamlandı` · `Yarıda kaldı` |

Hiç yolculuğunuz yoksa: *"Henüz yolculuk yok. Mobil uygulamadan bir otobüse
bindiğinizde kayıtlarınız burada listelenir."*

---

## 5. Mobil uygulama — İlk açılış

Uygulama açıldığında kısa bir açılış ekranı görürsünüz, ardından:

- **Daha önce giriş yaptıysanız** doğrudan sekmelere geçersiniz. Oturumunuz
  telefonda saklandığı için her açılışta şifre sorulmaz.
- **Giriş yapmadıysanız** Giriş/Kayıt ekranı gelir.

> **Giriş zorunludur.** Uygulamaya hesapsız girmenin bir yolu yoktur; demo kipi
> veya kullanıcı listesinden seçim bulunmaz.

### Giriş / Kayıt ekranı

Üstte belediye arması ve uygulama adı, altında iki sekmeli bir kart:

**Giriş Yap** sekmesi — E-posta + Şifre → **Giriş Yap**

**Hesap Oluştur** sekmesi — Ad Soyad, E-posta, Şifre (en az 8 karakter) ve
**Kart Tipi** (Tam / Öğrenci / 65+ kutuları) → **Hesap Oluştur**

Web'deki gibi, kayıt başarılı olunca sistem sizi otomatik içeri alır.

İşlem sürerken düğme **"Lütfen bekleyin…"** yazar ve tekrar basılamaz. Hata
olursa formun üstünde kırmızı bir bant belirir.

### Alt sekme çubuğu

Giriş yaptıktan sonra ekranın altında dört sekme durur:

| Simge | Sekme | İçerik |
|---|---|---|
| 🚌 | **Yolculuk** | Otobüse binme/inme |
| 💳 | **Kart** | Kartınız, tüm hatlar, favoriler |
| 🕓 | **Geçmiş** | Yolculuk kayıtlarınız |
| ⚙️ | **Ayarlar** | Tema, dil, hesap, çıkış |

Seçili sekmenin yazısı turuncu renkte olur.

---

## 6. Mobil — Yolculuk sekmesi

Bu, uygulamanın kalbidir. **İki farklı hâli** vardır.

---

### A) Araçta değilken

#### 1. Hat seçin

Ekranın üstündeki listede tüm hatlar durur. Bir hatta dokunduğunuzda çerçevesi
mavileşir ve aşağıdaki bölümler o hatta göre dolar.

#### 2. Yoldaki otobüsler

Seçtiğiniz hattaki araçların **canlı** listesi. **2 saniyede bir** kendiliğinden
tazelenir; ekranı yenilemeniz gerekmez.

Her otobüs kartında:

- **🚌 34 44801** — aracın plakası
- **Sağ üstte mavi rozet** — araçtaki yolcu sayısı (`3 yolcu`) ya da `Boş`
- **Konum satırı** — aracın o an nerede olduğu, üç halden biri:

| Görüntü | Anlamı |
|---|---|
| `Taşoluk durağında` | Araç durakta bekliyor → **binebilirsiniz** |
| `Taşoluk → Haraççı · 4 dk` | Araç iki durak arasında yolda, Haraççı'ya 4 dakika var |
| `Sefer bekliyor — 3 dk` | Araç son durakta mola veriyor → yolcu almıyor |

- **En altta geniş bir düğme** — durumuna göre değişir:

| Düğme yazısı | Ne demek | Basılabilir mi |
|---|---|---|
| **Bin** | Araç durakta, işlem yapabilirsiniz | ✅ Evet |
| **4 dk · Haraççı** | Araç yolda, 4 dakika sonra Haraççı'da olacak | ❌ Hayır |
| **Sefer bekliyor** | Araç molada | ❌ Hayır |

> **Neden "Bin" hep aktif değil?**
> Gerçek hayatta olduğu gibi: yalnızca **durakta bekleyen** araca binebilirsiniz.
> Araç yoldayken veya molada yolcu alamaz. Düğme soluk göründüğünde birkaç
> saniye bekleyin — araç bir sonraki durağa varınca kendiliğinden aktifleşir.

Kartın altındaki açıklama şunu hatırlatır:
*"Yalnızca durakta bekleyen otobüse binebilirsiniz; biniş durağınız o duraktır.
Durağı sunucu belirler."*

Hatta hiç araç yoksa: *"Bu hatta şu an sefer yok."*

#### 3. Bindiğinizde

**Bin** düğmesine bastığınızda ekranın üstünde yeşil bir bant belirir:

> *Taşoluk durağında 448 hattına bindiniz.*

Ekran anında **"Araçta"** hâline geçer.

> **Durağı siz seçmezsiniz.** Sistem, aracın o anda beklediği durağı otomatik
> olarak biniş durağınız yapar. Bu yüzden yanlış durak seçme ihtimali yoktur.

---

### B) Araçtayken

Ekran sadeleşir; artık başka araca binmenin bir yolu yoktur.

#### Yolculuk bandı

Lacivert, turuncu kenarlıklı bant:

> **ARAÇTASINIZ**
> 448 Arnavutköy – Mecidiyeköy
> Taşoluk · 08:42

#### İniş kartı

Altında büyük harflerle **bir durak adı** yazar:

- Araç **durakta ise** → o durağın adı (burada inebilirsiniz)
- Araç **yolda ise** → yaklaşmakta olduğu durağın adı

Düğme üç hâl alır:

| Düğme yazısı | Anlamı |
|---|---|
| **Otobüsten İn** | Araç durakta → basabilirsiniz |
| **Durak bekleniyor…** | Araç yolda → basılamaz, birkaç saniye bekleyin |
| **Lütfen bekleyin…** | İşleminiz sunucuya gidiyor |

İndiğinizde yeşil bant belirir:

> *Haraççı durağında indiniz. İyi günler!*

Ekran otomatik olarak "Araçta değil" hâline döner ve yolculuğunuz Geçmiş
sekmesine **Tamamlandı** olarak işlenir.

Kartın altındaki hatırlatma:
*"İnmeden başka bir araca binemezsiniz. İnmezseniz otobüs son durağa varınca
otomatik indirilirsiniz."*

---

### C) Hat şeması (her iki hâlde de görünür)

Sayfanın en altındaki kart, hattın **görsel güzergâh şemasıdır**.

```
  │
  ● Arnavutköy Meydan
  │
  ● Fatih Caddesi
  │
  ● Taşoluk              ← Bindiğiniz durak
  🚌 34 44801 · durağında
  │
  ● Haraççı
  🚌 34 44802 · 3 dk → Hadımköy Sanayi
  │
  ● Hadımköy Sanayi
```

Şemayı okuma:

| İşaret | Anlamı |
|---|---|
| **●** gri nokta | Normal durak |
| **●** turuncu nokta | Bu durakta şu an bir otobüs bekliyor |
| **●** mavi nokta + kalın yazı | **Bindiğiniz durak** (yanında *"Bindiğiniz durak"* yazar) |
| **🚌 plaka · durağında** | Araç o durakta bekliyor |
| **🚌 plaka · 3 dk → X** | Araç o duraktan ayrıldı, X durağına 3 dakika var |

#### ⇅ Yön değiştir

Şemanın sağ üstündeki düğme, **Gidiş** ve **Dönüş** arasında geçiş yapar.
Başlıkta hangi yönde olduğunuz yazar: *"448 hat şeması · Gidiş"*.

- **Gidiş** — hattın ilk durağından son durağına
- **Dönüş** — son duraktan ilk durağa (durak sırası tersine döner)

Şemada **yalnızca o yöndeki araçlar** gösterilir. Gidiş yönüne bakarken dönüş
yapan araçları görmezsiniz — aksi hâlde araçlar yanlış konumda görünürdü.

> **Not:** Yön değiştirmek yalnızca *görüntüyü* değiştirir. Bineceğiniz aracı
> siz seçersiniz; aracın hangi yöne gittiği "Yoldaki otobüsler" listesindeki
> konum yazısından anlaşılır.

Araçtayken şemada sadece **bindiğiniz araç** işaretlenir; böylece nerede
olduğunuzu takip edebilirsiniz.

---

## 7. Mobil — Kart sekmesi

### Sanal akbil kartınız

Web panelindekiyle aynı görsel dilde, lacivert kart:

- Sol üstte belediye logosu, sağ üstte **kart tipi rozeti** (`TAM` turuncu,
  `ÖĞRENCİ` / `65+` yeşil)
- Ortada adınız ve `A1B2 C3D4` biçimindeki kart numarası
- Sol altta toplam **Yolculuk** sayınız, sağ altta `AKBİL`
- Arka planda soluk belediye arması filigranı

Kartınız pasif durumdaysa kartın altında kırmızı bir uyarı belirir. Pasif
kartla otobüse binemezsiniz; belediyeye başvurmanız gerekir.

### Tüm hatlar

Sistemdeki bütün hatların listesi. Her satırda:

- Mavi kod rozeti (`448`)
- Hattın adı
- Sağda **yıldız** — dolu ★ favori, boş ☆ değil

**Yıldıza dokunarak** bir hattı favorilerinize ekler ya da çıkarırsınız.
Değişiklik anında kaydedilir; ayrıca bir onay düğmesi yoktur. İşlem başarısız
olursa yıldız eski hâline döner ve bir hata mesajı görünür.

Altta hatırlatma: *"Yıldıza dokunduğunuz hatlar favorilerinize eklenir."*

### Favori hatlar

Yıldızladığınız her hat için ayrı bir kutu:

- Hattın tam adı
- **En yoğun:** `08:00–09:00 · 18:00–19:00`
- **24 sütunlu mini yoğunluk grafiği**

Grafiği okuma:

| Sütun | Anlamı |
|---|---|
| Soluk mavi sütunlar | Saat saat beklenen yoğunluk — sütun ne kadar yüksekse o saat o kadar kalabalık |
| **Turuncu sütun** | **İçinde bulunduğunuz saat** — "şu an neredeyiz" |

Altında `00 · 06 · 12 · 18 · 23` saat etiketleri bulunur.

Favoriniz yoksa: *"Henüz favori hat yok — yukarıdaki listeden yıldıza dokunun."*

### Yenileme

Ekranı **parmağınızla aşağı çekerek** tüm bilgileri (kart, hatlar, favoriler,
yolculuk sayısı) tazeleyebilirsiniz.

---

## 8. Mobil — Geçmiş sekmesi

Yalnızca **size ait** son 50 yolculuk, en yeniden eskiye doğru.

Her kayıt bir kutuda:

```
┌──────────────────────────────────────┐
│ 08:42 – 09:05          [Tamamlandı]  │
│ 448 Arnavutköy – Mecidiyeköy         │
│ Taşoluk → Mecidiyeköy · 23 dk        │
└──────────────────────────────────────┘
```

| Alan | Açıklama |
|---|---|
| **Saat aralığı** | Biniş – iniş saati. Devam ediyorsa `08:42 – …` |
| **Durum rozeti** | Üç halden biri (aşağıda) |
| **Hat adı** | Mavi renkte |
| **Güzergâh** | `Biniş durağı → İniş durağı · süre`. Devam ediyorsa yalnız biniş durağı yazar |

**Durum rozetleri:**

| Rozet | Anlamı | Ne olmuş |
|---|---|---|
| **Otobüste** | Yolculuk sürüyor | Bindiniz, henüz inmediniz. Kutunun sol kenarı mavi çizgiyle işaretlenir. |
| **Tamamlandı** | Normal biten yolculuk | İniş yaptınız *veya* son durakta otomatik indirildiniz |
| **Yarıda kaldı** | Düzgün bitmeyen yolculuk | İnmeden başka bir araca bindiniz |

Ekranı aşağı çekerek listeyi yenileyebilirsiniz.

Hiç kaydınız yoksa: *"Henüz yolculuk yok — Yolculuk ekranından bir otobüse
binip indiğinizde kayıtlarınız burada listelenir."*

---

## 9. Mobil — Ayarlar sekmesi

> **Bu ekran sunucuya hiçbir bilgi göndermez.** Yaptığınız seçimler yalnızca
> telefonunuzda saklanır.

### Görünüm

| Seçenek | Sonuç |
|---|---|
| **Açık** | Beyaz zemin, koyu yazı (varsayılan) |
| **Koyu** | Koyu lacivert zemin, açık yazı |

Seçim anında uygulanır ve uygulamayı kapatıp açsanız da korunur.

### Dil

| Seçenek | Sonuç |
|---|---|
| **Türkçe** | Tüm arayüz Türkçe (varsayılan) |
| **English** | Tüm arayüz İngilizce |

Dil değişikliği yalnızca uygulama arayüzünü etkiler; hat ve durak adları
değişmez.

### Hesap

Adınız ve e-posta adresiniz gösterilir. Altında kırmızı **Çıkış Yap** düğmesi
bulunur.

**Çıkış yaptığınızda:** Oturumunuz telefondan silinir ve Giriş ekranına
dönersiniz. Yolculuk kayıtlarınız, favorileriniz ve kartınız **silinmez** —
tekrar giriş yaptığınızda hepsi yerinde durur.

Ekranın altındaki not: *"Bu ekrandaki seçimler yalnızca telefonunuzda saklanır,
sunucuya gönderilmez."*

---

## 10. Yönetim paneli

> Yalnızca **yönetici** yetkisi olan hesaplar erişebilir. Yolcu hesabıyla
> adres çubuğuna elle yazsanız da sayfa açılmaz, giriş ekranına yönlendirilirsiniz.

Web sitesinde giriş yaptıktan sonra üst banttaki **Yönetim** bağlantısına
tıklayın.

Paneldeki tüm veriler, mobil uygulamadan yapılan **gerçek yolculuk
kayıtlarından** hesaplanır ve **15 saniyede bir** kendiliğinden yenilenir. Sayfanın
altında son güncelleme saati yazar.

### Özet kutuları

| Kutu | Ne gösterir |
|---|---|
| **Toplam yolculuk** | Seçili dönemdeki (varsayılan son 7 gün) toplam yolculuk sayısı |
| **Şu an araçta** | O anda otobüste bulunan yolcu sayısı — *dönemden bağımsızdır, anlık değerdir* |
| **Aktif otobüs** | Sefer yapan araç sayısı |
| **En yoğun saat** | Gün içinde en çok binişin yapıldığı saat dilimi (`08:00–09:00`) |

### Saatlik yoğunluk

24 sütunlu çubuk grafik: gün içinde hangi saatte kaç biniş yapıldığını gösterir.
Boş saatler sıfır olarak yer tutar, böylece gün profili bozulmaz.

### Günlük talep trendi

Çizgi grafik: dönem içinde gün gün biniş sayısı. Başlığın yanında özet:

> *· Günlük ortalama 42.5 biniş · en yoğun gün 21 Tem · ↑ %18.3 artış*

**Değişim yüzdesi neyi karşılaştırır?** Dönemin **ilk yarısının** günlük
ortalaması ile **ikinci yarısının** günlük ortalaması. Yeşil ↑ talebin arttığını,
kırmızı ↓ azaldığını gösterir.

> **Neden önemli?** Tek başına "günlük ortalama 42 biniş" bilgisi bir şey
> söylemez. Belediyenin asıl sorusu **"talep artıyor mu, azalıyor mu?"** —
> yatırım kararı buna göre verilir.

### Hat yoğunluğu ve sefer önerisi

Panelin en kritik bölümü. Yolculuk kaydı olan her hat için bir kart:

| Satır | Anlamı |
|---|---|
| **Toplam yolculuk** | Dönemdeki toplam |
| **En yoğun saat** | Hattın zirve saati |
| **Zirvede biniş** | Zirve saatteki günlük ortalama biniş |
| **Aktif otobüs** | Hatta çalışan araç sayısı |
| **Araç başına** | Zirve saatte bir araca düşen yolcu sayısı ← **karar bu sayıya dayanır** |

Kartın rengi ve rozeti üç halden biri olur:

| Renk | Rozet | Ne zaman | Öneri |
|---|---|---|---|
| 🟢 Yeşil | **Düşük yoğunluk** | Araç başına yolcu, kapasitenin **%40'ından az** | *"Araçlar boş gidiyor — sefer azaltılabilir"* |
| 🟡 Sarı | **Normal** | **%40 – %75** arası | *"Sefer sayısı yeterli"* |
| 🔴 Kırmızı | **Yüksek yoğunluk** | Kapasitenin **%75'inden fazla** | *"Zirve saatte araçlar doluyor — sefer artırılmalı"* |

Kartlar en yüklüden en boşa doğru sıralanır, yani ilgilenmeniz gereken hat
her zaman en üsttedir.

Henüz kayıt yoksa: *"Henüz yolculuk kaydı yok — mobil uygulamadan biniş
yapıldığında buradaki değerlendirme oluşur."*

### En yoğun duraklar

Yatay çubuk grafik: en çok kullanılan 8 durak. Değer, **biniş + iniş
toplamıdır**.

Renkler en yoğun durağa göre orantılıdır (yeşil rahat → kırmızı sıkışık).
Grafiğin altında, kırmızı duraklar **yazıyla da** listelenir:

> *Sıkışık duraklar: Arnavutköy Meydan (184), Belediye (156)*

### Kart tipi dağılımı

Halka grafik: yolculukların Tam / Öğrenci / 65+ dağılımı. Değerler,
**yolculuk anındaki** kart statüsüne göre sayılır — sonradan yapılan kart tipi
düzeltmeleri geçmiş kayıtları değiştirmez.

### En yoğun güzergâhlar

Tablo: hangi duraklar arasında en çok yolculuk yapıldığı.

| Biniş | İniş | Yolculuk |
|---|---|---|
| Arnavutköy Meydan | Mecidiyeköy | 87 |
| Taşoluk | Belediye | 64 |

Yalnızca **tamamlanmış** yolculuklar sayılır — iniş yapılmadan güzergâh
oluşmaz. Kayıt yoksa: *"Tamamlanmış yolculuk yok. Güzergâh ancak iniş
yapıldığında oluşur."*

### Son yapılan yolculuklar

Tüm kullanıcıların son 20 yolculuğu, canlı akış hâlinde:

| Sütun | İçerik |
|---|---|
| **Saat** | Biniş – iniş |
| **Yolcu** | Yolcunun adı |
| **Hat** | Kod rozeti |
| **Güzergâh** | `A → B`, sürüyorsa *"A · yolculuk sürüyor"* |
| **Süre** | Dakika |
| **Kart** | Tam / Öğrenci / 65+ rozeti |

---

## 11. Sistemin kuralları

Bu kurallar **sunucuda** uygulanır; uygulamayı değiştirerek aşılamaz.

### 1. Yalnızca duraktaki araca binilir ve inilir

Araç iki durak arasındayken veya son durakta mola verirken kart basamazsınız.
Durağı siz seçmezsiniz — kayda, aracın o an beklediği durak yazılır.

### 2. İnmeden binilemez

Aynı anda yalnızca **bir açık yolculuğunuz** olabilir. Açık yolculuğunuz
varken başka bir araca binerseniz, önceki yolculuk **"Yarıda kaldı"** sayılır ve
yenisi başlar.

### 3. Aynı durakta inilemez

Bindiğiniz duraktan hemen inemezsiniz — en az bir durak ilerlemeniz gerekir.
Denerseniz: *"Henüz durak değişmedi — sonraki durakta inebilirsiniz."*

Araç tur atıp aynı isimli durağa geri dönerse inebilirsiniz; ölçüt durağın adı
değil, güzergâhtaki sırasıdır.

### 4. Son durakta otomatik iniş

İnmeyi unutursanız sistem sizi otobüs son durağa vardığında **otomatik
indirir.** Yolculuğunuz "Tamamlandı" olarak kaydedilir.

Bu, uygulamayı kapatsanız veya telefonunuz kapansa bile çalışır: iniş anı, siz
bindiğiniz anda hesaplanıp saklanır.

### 5. Ücret ve bakiye yoktur

Kart tipi yalnızca statüdür. Hiçbir işlemde para geçmez.

### 6. Kart tipi beyana dayanır

Kayıt sırasında seçtiğiniz tip anında kabul edilir. Öğrenci ve 65+ için belge
belediyede kontrol edilir; doğrulanmazsa yönetici kartınızı Tam yapar.
**Süren yolculuklarınız bundan etkilenmez**, çünkü tip biniş anında damgalanır.

### 7. Ayarlar sunucuya gitmez

Tema ve dil seçiminiz yalnızca telefonunuzda durur.

---

## 12. Karşılaşabileceğiniz mesajlar

Sistem hatalarını Türkçe ve açıklayıcı verir. Aşağıdaki tablo, gördüğünüz
mesajın ne anlama geldiğini ve ne yapmanız gerektiğini söyler.

### Giriş ve hesap

| Mesaj | Neden | Ne yapmalı |
|---|---|---|
| **E-posta veya şifre hatalı** | Adres ya da şifre yanlış | Bilgileri kontrol edin. Şifreniz en az 8 karakterdir. |
| **Bu e-posta zaten kayıtlı** | Aynı adresle hesap var | Kayıt yerine giriş yapın |
| **Parola en fazla 72 bayt olabilir** | Şifre çok uzun | Daha kısa bir şifre seçin (Türkçe karakterler fazla yer kaplar) |
| **Oturumunuz sona erdi, tekrar giriş yapın** | Oturum süresi doldu veya başka bir cihazdan yenilendi | Tekrar giriş yapın |
| **Oturum geçersiz kılınmış** | Aynı hesap başka bir yerde oturum tazeledi | Tekrar giriş yapın |
| **Kimlik bilgisi gerekli** | Giriş yapmadan korumalı bir sayfaya girildi | Giriş yapın |
| **Geçersiz veya süresi dolmuş token** | Oturum bilgisi bozulmuş/eskimiş | Çıkış yapıp tekrar girin |
| **Kullanıcı bulunamadı** | Hesap silinmiş olabilir | Belediyeye başvurun |

### Otobüse binme / inme

| Mesaj | Neden | Ne yapmalı |
|---|---|---|
| **Otobüs duraklar arasında. *X* durağına varınca işlem yapabilirsiniz** | Araç yolda | Belirtilen durağa varmasını bekleyin — düğme kendiliğinden aktifleşir |
| **Bu araç son durakta sefer bekliyor — yoldaki bir araç seçin** | Araç molada | Listeden başka bir araç seçin veya molanın bitmesini bekleyin |
| **Henüz durak değişmedi — sonraki durakta inebilirsiniz** | Bindiğiniz durakta inmeye çalıştınız | Aracın bir sonraki durağa varmasını bekleyin |
| **Hesabınıza bağlı aktif kart yok** | Kartınız pasif ya da tanımlı değil | Belediyeye başvurun |
| **Otobüs pasif durumda** | Araç sefer dışı bırakılmış | Listeden başka bir araç seçin |
| **Bu kart için işlem zaten sürüyor, tekrar deneyin** | Düğmeye çok hızlı iki kez basıldı | Birkaç saniye bekleyip tekrar deneyin |
| **Hattın güzergâhı tanımlı değil** | Sistem verisi eksik | Belediyeye bildirin |
| **Bus bulunamadı** / **Line bulunamadı** | Seçilen araç veya hat artık yok | Ekranı yenileyin |

### Favoriler ve kart

| Mesaj | Neden | Ne yapmalı |
|---|---|---|
| **Hat zaten favorilerde** | Hat zaten yıldızlı | İşlem gerekmez |
| **Favori bulunamadı** | Zaten çıkarılmış | Ekranı yenileyin |
| **Kart bulunamadı** | Bağlanmak istenen kart sistemde yok | Kart kimliğini kontrol edin |
| **Kart başka bir hesaba bağlı** | Kart başkasına ait | Belediyeye başvurun |

### Bağlantı

| Mesaj | Neden | Ne yapmalı |
|---|---|---|
| **Sunucuya ulaşılamadı. Ağ bağlantınızı ve sunucu adresini kontrol edin.** | Telefon sunucuya erişemiyor | Wi-Fi bağlantınızı kontrol edin; sorun sürerse [Kullanım Senaryosu → Ağ sorun giderme](KULLANIM-SENARYOSU.md#ağ-sorun-giderme) |
| **Beklenmeyen bir hata oluştu.** | Tanımlanamayan sunucu hatası | Sayfayı yenileyin, sürerse belediyeye bildirin |

### Yönetim

| Mesaj | Neden | Ne yapmalı |
|---|---|---|
| **Bu işlem için yönetici yetkisi gerekli** | Yolcu hesabıyla yönetim verisine erişildi | Yönetici hesabıyla giriş yapın |
| **Seyahat zaten kapalı** | Kapatılmak istenen yolculuk zaten bitmiş | İşlem gerekmez |

---

## 13. Sık sorulan sorular

**"Bin" düğmesi soluk, basamıyorum.**
Araç o anda durakta değildir. Düğmenin üzerinde kaç dakika kaldığı ve hangi
durağa gittiği yazar. Bekleyin — araç durağa varınca düğme kendiliğinden
aktifleşir. Liste 2 saniyede bir tazelenir.

**"Henüz durak değişmedi" diyor, inemiyorum.**
Bindiğiniz durakta inmeye çalışıyorsunuz. En az bir durak ilerlemeniz gerekir.

**İnmeyi unuttum, ne olur?**
Hiçbir şey. Otobüs son durağa vardığında sistem sizi otomatik indirir ve
yolculuğunuz "Tamamlandı" olarak kaydedilir. Uygulama kapalı olsa bile çalışır.

**Yanlışlıkla başka bir araca bindim.**
Önceki yolculuğunuz "Yarıda kaldı" olarak kapanır, yenisi başlar. Geçmişte iki
kayıt görürsünüz.

**Kart numaram nereden geliyor? Değiştirebilir miyim?**
Kart kimliğinizin son 8 hanesinden üretilir ve değiştirilemez. Gerçek bir kart
numarası değildir, yalnızca görsel bir kimliktir.

**"Yönetim" bağlantısını göremiyorum.**
Hesabınız yönetici değildir. Yönetici yetkisi yalnızca belediye tarafından
verilir; kayıt olurken seçilemez.

**Kartım "Pasif" görünüyor.**
Kartınız bloke edilmiş. Bu durumda otobüse binemezsiniz; belediyeye başvurmanız
gerekir.

**Kart tipimi yanlış seçtim.**
Belediyeye başvurun; yönetici düzeltir. Geçmiş yolculuklarınız değişmez.

**Mobil ile web'de aynı hesabı kullanabilir miyim?**
Evet, tek hesaptır. Mobilde yaptığınız yolculuk web panelinde anında görünür.

**Ayarlarımı değiştirdim, web'de de değişti mi?**
Hayır. Tema ve dil yalnızca telefonda saklanır.

**Grafikteki sayılar ile yönetim panelindeki sayılar neden farklı?**
Yolcu ekranındaki grafik hattın **beklenen** yoğunluk profilidir. Yönetim
paneli ise **gerçekten yapılmış** yolculukları sayar. İkisi farklı sorulara
cevap verir.

---

## 14. Erişilebilirlik

Sistem şu ilkelere göre tasarlandı:

**Renk asla tek başına anlam taşımaz.** Yönetim panelindeki yeşil/sarı/kırmızı
yoğunluk göstergelerinin her birinin yanında **metin etiketi** bulunur
("Düşük yoğunluk", "Normal", "Yüksek yoğunluk") ve altlarında sözle yazılmış
öneri yer alır. Sıkışık duraklar grafikte kırmızıya boyanmakla kalmaz, grafiğin
altında **isim isim yazıyla** da listelenir. Renk körlüğü olan bir kullanıcı
hiçbir bilgiyi kaçırmaz.

**Ekran okuyucu desteği.** Sekmeler, düğmeler ve seçim kutuları uygun rollerle
işaretlenmiştir; hangi sekmenin seçili, hangi düğmenin devre dışı olduğu ekran
okuyucuya bildirilir. Favori yıldızları *"448 favorilere ekle"* / *"448
favorilerden çıkar"* şeklinde okunur. Grafiklerin her birinin metin açıklaması
vardır.

**Okunabilirlik.** Saat ve sayı alanlarında sabit genişlikli rakamlar
kullanılır, böylece değerler değişirken satırlar oynamaz. Mobil uygulamada
**Koyu tema** seçeneği bulunur.

**Klavye kullanımı.** Web sitesinde bağlantı ve düğmelere klavyeyle
gezinildiğinde belirgin bir odak çerçevesi görünür.

---

<div align="center">

**Arnavutköy Belediyesi — Akbil Simülasyon Projesi**

[Kullanım Senaryosu](KULLANIM-SENARYOSU.md) ·
[API ve Mimari](API-VE-MIMARI.md) ·
[Proje ana sayfası](../README.md)

</div>
