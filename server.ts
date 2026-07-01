import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini Summary
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const { date, sessions, dailyMetrics } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "GEMINI_API_KEY asistan anahtarı ortam değişkenlerinde tanımlı değil. Lütfen Settings > Secrets bölümünden ekleyin."
        });
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

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error?.message || "Yapay zeka özeti üretilirken bir hata oluştu." });
    }
  });

  // Proxy endpoint for calendar (.ics) sync
  app.get("/api/proxy-ical", async (req, res) => {
    try {
      let calendarUrl = req.query.url as string;
      if (!calendarUrl) {
        return res.status(400).json({ error: "Lütfen geçerli bir takvim URL'si belirtin." });
      }

      // Handle webcal:// protocol by switching to https://
      if (calendarUrl.startsWith("webcal://")) {
        calendarUrl = "https://" + calendarUrl.substring(9);
      } else if (calendarUrl.startsWith("webcal:")) {
        calendarUrl = "https:" + calendarUrl.substring(7);
      }

      console.log(`Fetching calendar from: ${calendarUrl}`);
      const fetchResponse = await fetch(calendarUrl, {
        headers: {
          "User-Agent": "iCal/1.0 (Macintosh; Intel Mac OS X 10.15; compatible;)",
          "Accept": "text/calendar, text/plain, */*"
        }
      });

      if (!fetchResponse.ok) {
        throw new Error(`Takvim sunucusu hata döndürdü: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }

      const icsData = await fetchResponse.text();
      
      // Check if the returned content is HTML instead of a valid iCalendar file
      if (icsData.trim().startsWith("<html") || icsData.trim().startsWith("<!DOCTYPE") || icsData.trim().startsWith("<!doctype")) {
        throw new Error("Apple sunucusu takvim dosyası yerine bir web sayfası (HTML) döndürdü. Lütfen iCloud takviminizi herkese açık (Public) paylaştığınızdan ve linki eksiksiz kopyaladığınızdan emin olun. Ayrıca takvim isminin Türkçe karakter içermediğini kontrol edin.");
      }

      res.setHeader("Content-Type", "text/calendar");
      res.send(icsData);
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
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
