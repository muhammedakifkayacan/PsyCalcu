# PsyCalcu — iOS (iPhone/iPad) Çökme Önleme ve Kararlı Senkronizasyon Planı

Bu plan, iPhone ve iPad cihazlarda (Safari ve Chrome tarayıcılarında) senkronizasyon sırasında ekranın gidip gelmesine ve ardından **"Bu web sayfasında birçok kez sorunla karşılaştı"** siyah ekran hatasına yol açan bellek (RAM) taşmalarını ve çoklu ekran geçişlerini kalıcı olarak ortadan kaldırır.

## Kullanıcı Tercihleri ve Kritik Kararlar

> [!IMPORTANT]
> **Onaylanan Kullanıcı Tercihleri (Faz 1):**
> - **Hedef Cihaz ve Tarayıcılar**: iPhone ve iPad üzerindeki **Safari** ve **Chrome** tarayıcıları (iOS WebKit motoru sıkı RAM/Jetsam limitlerine sahiptir; anlık yüksek bellek tüketiminde sekmeyi kapatıp yeniden yükler, ikinci denemede ise "Sayfada birçok kez sorunla karşılaştı" hatası verir).
> - **Açılış ve Eşitleme Deneyimi**: **Açılışta kısa, tek ve kararlı bir yükleme ekranı gösterilmesi**; arka arkaya farklı ekranların veya yarım yüklenmiş tabloların gidip gelmesinin (flickering) tamamen engellenmesi.

---

## 1. Sorunun Kök Neden Analizi ve Çözüm Özeti

- **Ne Yapıyoruz**:
  1. **Bellek (RAM) Patlamasını Önleme**: Açılışta ve senkronizasyon sırasında seans listesinin 5-6 kez üst üste kopyalanarak taranmasını (`autoCorrectPastSessions`, `findClientCustomRule`, `JSON.stringify` tekrarları) tek seferlik $O(1)$ indeksli yapıya indiriyoruz.
  2. **Takvim Ayrıştırıcı (`parseICS`) Bellek Koruması**: Tekil (tekrarsız) geçmiş etkinliklerin pencere filtresini (`windowStart`) atlayıp her senkronizasyonda binlerce gereksiz nesne ve açıklama notu oluşturmasını engelliyoruz.
  3. **Tek ve Kararlı Açılış Yükleme Ekranı**: Kimlik doğrulama, yetki kontrolü ve ilk bulut eşitlemesi tamamlanana kadar ekranın farklı görünümler arasında gidip gelmesini önleyen tek bir kararlı açılış ekranı kuruyoruz.
- **Hedef Kitle**: iPhone, iPad ve masaüstü cihazlarda yoğun takvim entegrasyonu ve muhasebe kaydı kullanan psikologlar ve klinik yöneticileri.
- **Temel Kazanım**: iPhone ve iPad'de sıfır çökme, %85 daha düşük RAM kullanımı ve göz yormayan, kesintisiz açılış deneyimi.

---

## 2. Kullanıcı Deneyimi ve Görsel Tasarım

- **Adım Adım Açılış ve Eşitleme Akışı**:
  1. **Kararlı Açılış Ekranı**: Kullanıcı uygulamayı açtığında veya sayfayı yenilediğinde, ekranlar arası gidip gelme olmadan tek bir temiz yükleme kartı (*"Verileriniz Hazırlanıyor..."*) görünür.
  2. **Tek Seferde Ana Panele Geçiş**: Yerel önbellek ve bulut muhasebe defteri tek geçişte uzlaştırıldıktan sonra doğrudan ana ekran açılır; ödeme durumları anında doğru ("Ödendi" / "Kilitli") olarak görünür.
  3. **Sarsıntısız Arka Plan Takvim Eşitlemesi**: Ana ekran açıldıktan sonra takvim senkronizasyonu arka planda sessizce ve düşük bellek tüketimiyle çalışır; ekranı dondurmaz veya kilitlemez.
- **Görsel Kimlik ve Tema**:
  - *Estetik Yönelim*: Sakin, güven veren klinik-editoryal tasarım dili (`#fdfbf7` sıcak fildişi zemin, `#6b705c` adaçayı yeşili vurgu, `#e5e1d8` ince kenarlıklar).
  - *Tipografi ve Hiyerarşi*: Başlıklarda serif, veri tabloları ve para birimlerinde hizalı rakamlar (`tabular-nums`).
  - *Etkileşimli Geri Bildirim*: Geçişlerde yalnızca GPU dostu `opacity` ve `transform` animasyonları kullanılır; sayfa yeniden boyutlandırması veya tam ekran yanıp sönme yaşanmaz.

---

## 3. Temel Ürün ve Mimari Kararlar

- **Karar 1: Danışan Özel Ücret ve İsim Eşleştirmelerinde $O(1)$ Harita Önbelleği**
  - *Seçilen Yaklaşım*: `findClientCustomRule` ve `autoCorrectPastSessions` içinde her seans için tüm özel kuralları döngüyle (`areClientNamesEquivalent`) taramak yerine, özel kuralları tek bir $O(1)$ `Map` tablosuna indeksliyoruz ve yalnızca ücreti `0` veya eksik olan aktif seanslarda çalıştırıyoruz.
  - *Neden*: 5.000 seanslık bir hesapta açılış başına yapılan ~1.500.000 metin parçalama işlemini ~50 işleme düşürerek iOS Safari/Chrome RAM çökmesini tamamen bitirir.
- **Karar 2: Yedek Noktalarının (`backupSnapshots`) RAM'de Tutulmaması**
  - *Seçilen Yaklaşım*: Her biri binlerce seans kopyası içeren tam yedek dizilerini sürekli React belleğinde (`state`) tutmak yerine yalnızca kullanıcı Yedek Noktaları penceresini açtığında IndexedDB'den okuyoruz; başlangıçta yalnızca hafif meta verileri tutuyoruz.
  - *Neden*: iPhone ve iPad'de sekme başına 30-50 MB gereksiz JSON belleğini boşa çıkarır.
- **Karar 3: Tekil Takvim Etkinliklerinde Tarih Penceresi (`windowStart`) Zorunluluğu**
  - *Seçilen Yaklaşım*: `parseICS` içinde tekrarlamayan (`occurrences.length === 0`) etkinliklerin de `startParsed.dateStr >= windowStart` kontrolünden geçmesini sağlıyoruz ve ilk takvim senkronizasyonu tamamlandıktan sonra geçmiş yıllara ait binlerce seans notunun her seferinde IndexedDB'de yeniden birleştirilmesini durduruyoruz.
  - *Neden*: Büyük `.ics` takvim dosyaları çekildiğinde mobil tarayıcının bellek sınırına takılmasını önler.

---

## 4. Teknik Mimari ve Veri Akışı

### Mimari ve Bileşen Diyagramı

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AÇILIŞ VE SENKRONİZASYON KAPISI                      │
│  [Tekil Kararlı Yükleme Ekranı] ──(Auth + İlk Bulut Uzlaştırması)──►    │
│  [Ana Panel (Ajanda / İstatistik / Denetim)] (Sıfır Ekran Gidip Gelmesi)│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│   BELLEK DOSTU MUHASEBE MOTORU    │       │   BELLEK DOSTU TAKVİM AYRIŞTIRICI │
│ • O(1) ClientCustomRule Map       │       │ • Tek geçişli satır okuma         │
│ • Tek seferlik başlangıç onarımı  │       │ • Tekil ve tekrarlayan seanslarda │
│ • Yedeklerin (Snapshot) yalnızca  │       │   sıkı windowStart filtresi       │
│   modal açıldığında yüklenmesi    │       │ • Yalnızca aktif dönem not kaydı  │
└───────────────────────────────────┘       └───────────────────────────────────┘
```

### Etkileşimli Durum ve Veri Eşlemesi
- **Açılış Durum Kilidi (`isBootstrapping`)**: ` !isInitialAuthCheckDone || (user && registrationStatus === 'checking') || (user && registrationStatus === 'approved' && !isInitialSyncDone && sessions.length === 0) ` koşulları tek bir kararlı yükleme görünümünde birleştirilir; ekranlar arası sıçrama engellenir.
- **İlk Yükleme Tekilleştirmesi**: `useState(sessions)`, `lastSavedRef` ve `onAuthStateChanged` içinde aynı yerel verinin 3 kez üst üste `JSON.parse` + `autoCorrectPastSessions` + `JSON.stringify` işleminden geçirilmesi engellenir; başlangıçta tek bir önbellek referansı kullanılır.
- **Takvim Eşitleme Koruması**: Otomatik takvim senkronizasyonu, ilk bulut senkronizasyonu tamamen bittikten sonra devreye girer ve değişiklik yoksa (`addedCount === 0 && updatedCount === 0 && deletedCount === 0`) `setSessions` tetiklemez, böylece gereksiz yeniden render ve kayıt döngüsü oluşmaz.
