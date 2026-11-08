# Takvim Senkronizasyonu (Son 30 Gün + Gelecek) ve Kilitli Aylar Performans Planı

## 1. Tespit Edilen Darboğazlar
1. **Rutin Takvim Eşitlemesinin Tüm Geçmişi Taraması:**
   - İlk tam takvim aktarımı bittikten sonra bile (`isInitialCalendarSyncDone === true`), `parseICS` ve `handleImportSessions` fonksiyonları başlangıç tarihi olarak son 30 gün yerine muhasebe başlangıç tarihini (veya `2010-01-01` tarihini) baz alıyordu.
   - Bu nedenle her otomatik ve manuel senkronizasyonda takvimdeki binlerce eski etkinlik baştan ayrıştırılıp kontrol ediliyordu.
2. **Önceki Ayları ve Yılları Kilitleyen Kullanıcılarda Ekstra Yavaşlama:**
   - `handleImportSessions` içinde, kilitli aylara ve geçmiş yıllara ait binlerce seans değişmeyecek olmasına rağmen her eşitlemede kopyalanıp sıralanıyor (`sortedForIndexing`) ve 5 ayrı arama haritasına (`Map`) indekslemek için tek tek işleniyordu.
   - `monthCloseUtils.ts` içindeki `mergeClosedMonths` fonksiyonu, her bulut/takvim senkronizasyonunda `localStorage` üzerindeki büyük ayar dosyalarını tekrar tekrar `JSON.parse` ile okuyup tüm kilitli ayları döngüye sokarak yeniden `localStorage` ve `IndexedDB`'ye yazıyordu.

---

## 2. Uygulanacak Çözümler

### A. İlk Aktarım Sonrası "Son 30 Gün ve Gelecek" Penceresi (`src/utils/icsParser.ts` & `src/App.tsx`)
- **İlk Tam Senkronizasyon (`!isInitialCalendarSyncDone`):** Takvim ilk kez bağlandığında tüm geçmiş ve gelecek seanslar eksiksiz içeri aktarılır.
- **Sonraki Tüm Senkronizasyonlar (`isInitialCalendarSyncDone === true`):**
  - Aktif senkronizasyon alt sınırı (`rolling30DaysStart`) bugünden **30 gün öncesi** olarak hesaplanır (eğer kullanıcının muhasebe başlangıç tarihi son 30 günden daha yeniyse o tarih baz alınır).
  - 30 günden eski etkinlikler ve **kilitli aylara (`closedMonths`) ait tüm etkinlikler** `parseICS` içinde daha `VEVENT` okuma aşamasında anında atlanır (`fast-skip`).
  - Tekrarlayan (`RRULE`) etkinliklerde bitiş tarihi (`UNTIL`) 30 günlük pencereden önceyse tekrarlama döngüsü hiç çalıştırılmaz.

### B. Kilitli Aylar ve Geçmiş Yıllar İçin Sıfır-Maliyetli İndeksleme (`src/App.tsx`)
- `handleImportSessions` çalışırken mevcut seanslar tek geçişte ikiye ayrılır:
  1. **Dokunulmaz Geçmiş / Kilitli Seanslar:** Kilitli bir aya (`isDateInClosedMonth`) ait olan veya ilk senkronizasyon sonrası 30 günlük pencereden (`cutOffDateStr`) daha eski olan seanslar **hiçbir sıralama, isim normalizasyonu veya `Map` indekslemesine sokulmadan** doğrudan korunur.
  2. **Aktif Pencere Seansları (Son 30 Gün + Gelecek):** Yalnızca aktif penceredeki (genellikle 30–100 adet) seanslar indekslenir ve takvimden gelen yeni/güncel etkinliklerle karşılaştırılır.
- Böylece 5–10 yıllık geçmişini kilitlemiş bir kullanıcıda bile senkronizasyon süresi binlerce seans yerine sadece son 30 günün seansları üzerinden milisaniyeler içinde tamamlanır.

### C. Kilitli Ay Önbelleği ve Disk Yazma Optimizasyonu (`src/utils/monthCloseUtils.ts`)
- `getStoredClosedMonths` ve `getStoredReopenedMonths` fonksiyonları bellek içi önbellek (`activeClosedMonthsCache` ve `activeReopenedMonthsCache`) dolu olduğunda `localStorage` üzerinde tekrar `JSON.parse` yapmaz.
- `saveStoredClosedMonths` ve `mergeClosedMonths` fonksiyonları, kilitli ayların JSON çıktısı değişmediği sürece `localStorage.setItem` ve `idbSet` yazma işlemlerini tekrarlamaz.
