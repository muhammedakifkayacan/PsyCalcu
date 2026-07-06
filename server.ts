import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

function generateSmartFallbackSummary(date: string, sessions: any[], dailyMetrics: any, isKeyMissing: boolean): string {
  const activeSessions = sessions ? sessions.filter((s: any) => s.type !== 'cancelled') : [];
  const cancelledSessions = sessions ? sessions.filter((s: any) => s.type === 'cancelled') : [];
  const onlineCount = activeSessions.filter((s: any) => s.type === 'online').length;
  const f2fCount = activeSessions.filter((s: any) => s.type === 'face-to-face').length;
  const unpaidCount = activeSessions.filter((s: any) => s.paymentStatus !== 'paid').length;
  const totalUnpaid = activeSessions.filter((s: any) => s.paymentStatus !== 'paid').reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0);

  let evaluation = "";
  
  // Section 1: Günün Değerlendirmesi
  evaluation += `- **Günün Değerlendirmesi:** `;
  if (activeSessions.length === 0) {
    evaluation += `${date} tarihinde aktif seansınız bulunmamaktadır. Dinlenmek ve klinik hazırlık yapmak için harika bir gün.`;
  } else {
    evaluation += `Bugün toplam ${activeSessions.length} aktif seans gerçekleştirdiniz (${onlineCount} Online, ${f2fCount} Yüzyüze). `;
    if (cancelledSessions.length > 0) {
      evaluation += `${cancelledSessions.length} adet seans iptali gerçekleşti; iptal politikalarınızı gözden geçirmek seans sadakatini artırabilir. `;
    } else {
      evaluation += `Seans katılım oranı %100; planlamalarınız son derece verimli geçti. `;
    }
    if (activeSessions.length >= 5) {
      evaluation += `Klinik yoğunluğunuz yüksek seviyededir; seans aralarında zihinsel dinlenmeye özen göstermelisiniz.`;
    } else if (activeSessions.length >= 3) {
      evaluation += `Dengeli ve sürdürülebilir bir klinik iş yükü dağılımı sağlandı.`;
    } else {
      evaluation += `Sakin bir gün; danışan takipleri ve idari hazırlıklar için yeterli vakit kaldı.`;
    }
  }
  evaluation += `\n\n`;

  // Section 2: Finansal Durum & Tahsilat
  evaluation += `- **Finansal Durum & Tahsilat:** `;
  const netProfit = dailyMetrics.net || 0;
  evaluation += `Günü ₺${netProfit.toLocaleString('tr-TR')} net kâr ile tamamladınız. `;
  if (unpaidCount > 0) {
    evaluation += `Tamamlanan seanslardan ${unpaidCount} adedinin (₺${totalUnpaid.toLocaleString('tr-TR')}) ödemesi henüz alınmamış. Bu danışanlara gün sonunda nazik bir hatırlatma göndermeniz nakit akışını olumlu etkileyecektir.`;
  } else if (activeSessions.length > 0) {
    evaluation += `Harika! Bugün tamamlanan tüm seansların ödemeleri tahsil edilmiş durumdadır, finansal akışınız kusursuz.`;
  } else {
    evaluation += `Bugün finansal bir hareketlilik bulunmamaktadır.`;
  }
  evaluation += `\n\n`;

  // Section 3: Günün Sözü / Öneri
  evaluation += `- **Günün Sözü / Öneri:** `;
  const quotes = [
    "\"Bir insanı dinlemek, ona var olma hakkı tanımaktır.\" - Seans sonrası kendinize de şefkat göstermeyi unutmayın.",
    "Zihinsel emeğiniz çok değerli. Bugün dokunduğunuz hayatlar için kendinize teşekkür edin.",
    "Klinik verimlilik sadece seans sayısıyla değil, seansların kalitesi ve kendi enerjinizle ölçülür.",
    "Başarılı bir terapist, kendi sınırlarını çizmeyi ve dinlenmeyi de çok iyi bilendir.",
    "Günün yoğunluğu geride kaldı; şimdi zihninizi boşaltma ve kendinize zaman ayırma vakti.",
    "Her seans yeni bir keşif yolculuğudur; kendinize ve mesleki sezgilerinize güvenin."
  ];
  const dayOffset = date ? parseInt(date.split('-').pop() || '0', 10) : 0;
  const index = (activeSessions.length + dayOffset) % quotes.length;
  evaluation += quotes[index];

  if (isKeyMissing) {
    evaluation += `\n\n*Not: Bu analiz, API anahtarınız tanımlanmadığı için PsyCalcu Akıllı Değerlendirme Modülü tarafından lokal olarak üretilmiştir. Gerçek yapay zeka analizleri için Settings > Secrets bölümünden GEMINI_API_KEY ekleyebilirsiniz.*`;
  } else {
    evaluation += `\n\n*Not: Bu rapor, yapay zeka sunucu yoğunluğu nedeniyle PsyCalcu Akıllı Değerlendirme Modülü tarafından lokal olarak hazırlanmıştır.*`;
  }

  return evaluation;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini Summary
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const { date, sessions, dailyMetrics } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        // Fallback gracefully instead of throwing 500 error
        const fallbackText = generateSmartFallbackSummary(date, sessions, dailyMetrics, true);
        return res.json({ text: fallbackText });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Sen psikologlar için geliştirilmiş PsyCalcu uygulamasının profesyonel ve pratik yapay zeka asistanısın. 
Kullanıcının ${date} tarihindeki günlük seans listesi ve muhasebe özeti aşağıdadır. Bu verileri analiz ederek psikoloğa son derece kısa, net, "az ve öz" bir günlük değerlendirme raporu sun. Gereksiz uzun cümlelerden, aşırı süslü ifadelerden kaçın.

GÜNLÜK VERİLER:
Tarih: ${date}
Aktif Seans Sayısı: ${dailyMetrics.count}
Toplam Brüt Gelir: ₺${dailyMetrics.gross}
Bakıcı Gideri: ₺${dailyMetrics.babysitter}
Ofis Kira Gideri: ₺${dailyMetrics.officeRent}
Net Günlük Kâr: ₺${dailyMetrics.net}

SEANSLAR:
${sessions && sessions.length > 0 
  ? sessions.map((s: any) => `- Danışan: ${s.clientName}, Saat: ${s.time}, Tipi: ${s.type === 'cancelled' ? 'İptal' : s.type === 'face-to-face' ? 'Yüzyüze' : 'Online'}, Ücret: ₺${s.price}, Durum: ${s.paymentStatus === 'paid' ? 'Ödendi' : 'Ödenmedi'}, Notlar: ${s.notes || 'Yok'}`).join('\n')
  : 'Bu tarihte seans bulunmamaktadır.'
}

Lütfen yanıtını Türkçe olarak yaz. Yanıtın son derece kompakt, okunması kolay ve net olmalı. Uzun paragraflar yazma. Sadece şu 3 maddeyi içersin:

- **Günün Değerlendirmesi:** Seans yoğunluğu, online/yüz yüze dağılımı ve iptaller hakkında tek bir net cümle.
- **Finansal Durum & Tahsilat:** Günün net kârı ve varsa ödenmemiş seanslar için çok kısa tahsilat önerisi (tek cümle).
- **Günün Sözü / Öneri:** Psikoloğun motivasyonu için tek bir kısa, yapıcı cümle.

Lütfen bu şablona sadık kal ve lafı uzatmadan doğrudan bilgiye odaklan.`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        });
      } catch (firstErr: any) {
        console.warn("Primary model (gemini-3.5-flash) failed, trying fallback model (gemini-3.1-flash-lite):", firstErr);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
          });
        } catch (fallbackErr: any) {
          console.error("Fallback model also failed:", fallbackErr);
          throw new Error("Yapay zeka servisleri şu anda yoğun talep altında. Lütfen birkaç saniye sonra tekrar deneyin.");
        }
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error, falling back to smart analysis:", error);
      const { date, sessions, dailyMetrics } = req.body;
      const fallbackText = generateSmartFallbackSummary(date, sessions, dailyMetrics, false);
      res.json({ text: fallbackText });
    }
  });

  // Proxy endpoint for calendar (.ics) sync
  app.get("/api/proxy-ical", async (req, res) => {
    let calendarUrl = req.query.url as string;
    try {
      if (!calendarUrl) {
        return res.status(400).json({ error: "Lütfen geçerli bir takvim URL'si belirtin." });
      }

      // Trim leading/trailing whitespaces
      calendarUrl = calendarUrl.trim();

      // Handle webcal:// protocol by switching to https://
      let normalizedUrl = calendarUrl;
      if (normalizedUrl.startsWith("webcal://")) {
        normalizedUrl = "https://" + normalizedUrl.substring(9);
      } else if (normalizedUrl.startsWith("webcal:")) {
        normalizedUrl = "https:" + normalizedUrl.substring(7);
      }

      // Safe URL parsing & encoding for Turkish/Unicode/special characters in paths
      try {
        normalizedUrl = encodeURI(decodeURI(normalizedUrl));
      } catch (urlErr) {
        console.error("URL encoding error, using original normalizedUrl:", urlErr);
      }

      console.log(`Fetching calendar from: ${normalizedUrl}`);
      const fetchResponse = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "iCal/1.0 (Macintosh; Intel Mac OS X 10.15; compatible;)",
          "Accept": "text/calendar, text/plain, */*"
        }
      });

      if (!fetchResponse.ok) {
        throw new Error(`Takvim sunucusu hata döndürdü: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }

      const icsData = await fetchResponse.text();
      
      // Save diagnostics log for debugging sync issue
      try {
        const diagnostics = {
          timestamp: new Date().toISOString(),
          originalUrl: calendarUrl,
          normalizedUrl,
          status: fetchResponse.status,
          contentType: fetchResponse.headers.get("content-type"),
          contentLength: icsData.length,
          preview: icsData.substring(0, 3000), // First 3000 chars
          hasVcalendar: icsData.includes("BEGIN:VCALENDAR"),
          hasVevent: icsData.includes("BEGIN:VEVENT")
        };
        fs.writeFileSync(
          path.join(process.cwd(), "src", "debug_log.json"),
          JSON.stringify(diagnostics, null, 2),
          "utf-8"
        );
        console.log("Diagnostics logged to src/debug_log.json");
      } catch (logErr) {
        console.error("Failed to write debug log:", logErr);
      }

      // Check if the returned content is HTML instead of a valid iCalendar file
      if (icsData.trim().startsWith("<html") || icsData.trim().startsWith("<!DOCTYPE") || icsData.trim().startsWith("<!doctype")) {
        throw new Error("Apple sunucusu takvim dosyası yerine bir web sayfası (HTML) döndürdü. Lütfen iCloud takviminizi herkese açık (Public) paylaştığınızdan ve linki eksiksiz kopyaladığınızdan emin olun. Ayrıca takvim isminin Türkçe karakter içermediğini kontrol edin.");
      }

      res.setHeader("Content-Type", "text/calendar");
      res.send(icsData);
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
      // Log failure diagnostics
      try {
        const diagnostics = {
          timestamp: new Date().toISOString(),
          originalUrl: calendarUrl,
          error: err?.message || err
        };
        fs.writeFileSync(
          path.join(process.cwd(), "src", "debug_log.json"),
          JSON.stringify(diagnostics, null, 2),
          "utf-8"
        );
      } catch (logErr) {}
      res.status(500).json({ error: `Takvim verisi çekilemedi: ${err?.message || err}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
