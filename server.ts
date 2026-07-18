import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import "dotenv/config";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

let adminDb: any = null;

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

  // API Route for Admin Registration Notification
  app.post("/api/notify-admin-registration", async (req: any, res: any) => {
    try {
      const { userEmail, userId } = req.body;
      if (!userEmail) {
        return res.status(400).json({ error: "userEmail is required" });
      }

      console.log(`New registration alert for email: ${userEmail}, userId: ${userId}`);

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost || !smtpUser || !smtpPass) {
        console.log("SMTP configuration is incomplete. Skipping actual email delivery.");
        return res.json({
          success: true,
          message: "Registration received (SMTP is not configured in Secrets, email simulation logged)."
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const adminEmail = "muhammedakifkayacan@gmail.com";
      const appUrl = process.env.APP_URL || "https://psycalcu.com";

      const mailOptions = {
        from: `"PsyCalcu Kayıt Bildirimi" <${smtpUser}>`,
        to: adminEmail,
        subject: `🔔 Yeni Kullanıcı Kayıt Onayı Bekleniyor: ${userEmail}`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e1d8; border-radius: 16px; background-color: #fdfbf7; color: #333;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e5e1d8;">
              <span style="font-size: 28px; font-weight: bold; color: #6b705c; letter-spacing: -0.5px;">PsyCalcu</span>
              <p style="font-size: 13px; color: #a5a58d; margin-top: 5px; margin-bottom: 0;">Yönetici Onay Sistemi</p>
            </div>
            
            <div style="padding: 25px 10px;">
              <h2 style="color: #6b705c; font-size: 17px; margin-top: 0; font-weight: 600;">Merhaba,</h2>
              <p style="font-size: 13.5px; line-height: 1.6; color: #555; margin-bottom: 20px;">
                PsyCalcu uygulamasına yeni bir kullanıcı kayıt oldu ve <strong>yönetici onayınızı</strong> bekliyor:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border: 1px solid #e5e1d8; border-radius: 12px; overflow: hidden;">
                <tr style="border-bottom: 1px solid #e5e1d8; background-color: #fcfbfa;">
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: bold; color: #6b705c; width: 120px;">E-Posta:</td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #222; font-weight: 500;">${userEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: bold; color: #6b705c;">Kullanıcı ID:</td>
                  <td style="padding: 12px 16px; font-size: 12px; color: #777; font-family: monospace;">${userId}</td>
                </tr>
              </table>

              <p style="font-size: 13.5px; line-height: 1.6; color: #555;">
                Bu kullanıcının uygulamayı kullanabilmesi için yönetici panelinizden onay vermeniz gerekmektedir. Aşağıdaki butona tıklayarak doğrudan sisteme gidip onaylayabilirsiniz:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="background-color: #6b705c; color: #ffffff !important; padding: 12px 28px; text-decoration: none; font-size: 13.5px; font-weight: bold; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(107, 112, 92, 0.15);">
                  Yönetici Paneline Git ve Onayla
                </a>
              </div>
              
              <p style="font-size: 11px; color: #a5a58d; text-align: center; margin-top: 40px; border-top: 1px solid #e5e1d8; padding-top: 20px; margin-bottom: 0;">
                Bu e-posta PsyCalcu sistemi tarafından otomatik olarak üretilmiştir.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Approval email successfully sent to ${adminEmail}`);
      res.json({ success: true, message: "Email sent successfully!" });
    } catch (error: any) {
      console.error("Nodemailer Email Send Error:", error);
      res.status(500).json({ error: `E-posta gönderimi başarısız oldu: ${error.message}` });
    }
  });

  // Helper functions to unwrap Firestore REST API nested values
  function unwrapFirestoreValue(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if ('stringValue' in value) return value.stringValue;
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('integerValue' in value) return Number(value.integerValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('nullValue' in value) return null;
    if ('mapValue' in value) {
      const obj: any = {};
      const fields = value.mapValue.fields || {};
      for (const key of Object.keys(fields)) {
        obj[key] = unwrapFirestoreValue(fields[key]);
      }
      return obj;
    }
    if ('arrayValue' in value) {
      const arr = value.arrayValue.values || [];
      return arr.map((item: any) => unwrapFirestoreValue(item));
    }
    return value;
  }

  function parseFirestoreDocument(doc: any): any {
    const result: any = {};
    const fields = doc.fields || {};
    for (const key of Object.keys(fields)) {
      result[key] = unwrapFirestoreValue(fields[key]);
    }
    return result;
  }

  // API Route for secure, public room availability data
  app.get("/api/public-availability/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: "Kullanıcı ID gereklidir." });
      }

      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(configPath)) {
        return res.status(500).json({ error: "Firebase konfigürasyon dosyası bulunamadı." });
      }

      let rawData: any = null;

      // Initialize adminDb if not already initialized
      let dbInstance = adminDb;
      if (!dbInstance && fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const projectId = config.projectId;
          const databaseId = config.firestoreDatabaseId;
          
          if (getAdminApps().length === 0) {
            const adminApp = initializeAdminApp({
              projectId: projectId
            });
            dbInstance = getAdminFirestore(adminApp, databaseId || "(default)");
            adminDb = dbInstance;
          } else {
            dbInstance = getAdminFirestore();
          }
        } catch (err) {
          console.error("Failed to initialize Firebase Admin SDK dynamically:", err);
        }
      }

      if (dbInstance) {
        console.log(`Using Firebase Admin SDK to fetch user data for: ${userId}`);
        const docRef = dbInstance.collection("users").doc(userId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: "Klinik veya terapist bulunamadı." });
        }
        rawData = docSnap.data();
      } else {
        console.log(`Firebase Admin not available. Falling back to Firestore REST API for: ${userId}`);
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const projectId = config.projectId;
        const apiKey = config.apiKey;
        const databaseId = config.firestoreDatabaseId || "(default)";

        // Call Firestore REST API to fetch settings and sessions securely
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${userId}?key=${apiKey}`;
        const response = await fetch(firestoreUrl);
        
        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: "Klinik veya terapist bulunamadı." });
          }
          throw new Error(`Firestore REST API returned ${response.status}: ${response.statusText}`);
        }

        const docData = await response.json();
        rawData = parseFirestoreDocument(docData);
      }
      
      const settings = rawData.settings || {};
      const sessions = rawData.sessions || [];

      // Filter sessions to protect confidentiality (never return clientName, notes, or prices)
      const publicSessions = sessions.map((s: any) => ({
        id: s.id,
        date: s.date,
        time: s.time,
        duration: s.duration || 60,
        roomId: s.roomId,
        type: s.type === 'cancelled' ? 'cancelled' : 'busy'
      }));

      res.json({
        therapistName: settings.therapistName || "Terapist",
        rooms: settings.rooms || [],
        blockedSlots: settings.blockedSlots || [],
        sessions: publicSessions
      });
    } catch (err: any) {
      console.error("Public availability fetch error:", err);
      res.status(500).json({ error: `Müsaitlik bilgisi yüklenemedi: ${err?.message || err}` });
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
