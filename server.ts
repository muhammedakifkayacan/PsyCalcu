import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import "dotenv/config";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

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

  // API Route for Custom Branded Password Reset Email
  app.post("/api/send-password-reset", async (req: any, res: any) => {
    try {
      const { email } = req.body;
      if (!email || !email.trim()) {
        return res.status(400).json({ error: "E-posta adresi gereklidir." });
      }

      const targetEmail = email.trim();
      console.log(`Password reset requested for: ${targetEmail}`);

      let resetLink = "";
      try {
        let adminAppInstance;
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        let projectId = process.env.FIREBASE_PROJECT_ID;
        if (fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          projectId = cfg.projectId || projectId;
        }

        if (getAdminApps().length === 0) {
          adminAppInstance = initializeAdminApp({ projectId });
        } else {
          adminAppInstance = getAdminApps()[0];
        }

        const adminAuth = getAdminAuth(adminAppInstance);
        const appUrl = process.env.APP_URL || "https://psycalcu.com";
        const actionCodeSettings = {
          url: appUrl,
        };
        resetLink = await adminAuth.generatePasswordResetLink(targetEmail, actionCodeSettings);
        console.log(`Generated reset link for ${targetEmail}`);
      } catch (linkErr: any) {
        console.warn("Could not generate password reset link via Admin Auth SDK:", linkErr);
      }

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      // If resetLink was generated and SMTP is configured, send the custom template!
      if (resetLink && smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const htmlTemplate = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; background-color: #fdfbf7; color: #2d312e;">
            <div style="background-color: #ffffff; border: 1px solid #e5e1d8; border-radius: 24px; padding: 35px 30px; box-shadow: 0 4px 20px rgba(107, 112, 92, 0.05); text-align: center;">
              
              <!-- Brand Logo Badge -->
              <div style="width: 56px; height: 56px; background-color: #6b705c; border-radius: 18px; line-height: 56px; text-align: center; color: #ffffff; font-family: Georgia, serif; font-size: 32px; font-style: italic; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(107, 112, 92, 0.2);">
                P
              </div>

              <!-- Brand Title -->
              <h1 style="font-family: Georgia, serif; font-style: italic; color: #6b705c; font-size: 26px; margin: 0 0 6px 0; font-weight: normal;">
                PsyCalcu
              </h1>
              <p style="font-size: 11px; font-weight: 700; color: #a5a58d; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 25px 0;">
                Klinik &amp; Terapi Seans Planlayıcı — Güvenlik Servisi
              </p>

              <div style="height: 1px; background-color: #e5e1d8; width: 100%; margin-bottom: 28px;"></div>

              <!-- Content Header -->
              <h2 style="font-size: 18px; color: #333333; margin-top: 0; margin-bottom: 12px; font-weight: 700; text-align: left;">
                Şifre Sıfırlama Talebi
              </h2>

              <p style="font-size: 14px; line-height: 1.65; color: #555555; text-align: left; margin-bottom: 24px;">
                Merhaba,<br><br>
                PsyCalcu hesabınız için bir şifre yenileme talebinde bulunuldu. Hesabınıza güvenle erişebilmeniz ve yeni bir şifre belirleyebilmeniz için aşağıdaki butona tıklamanız yeterlidir:
              </p>

              <!-- Action Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" target="_blank" style="background-color: #6b705c; color: #ffffff !important; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(107, 112, 92, 0.25); letter-spacing: 0.2px;">
                  🔑 Şifremi Sıfırla ve Yeni Şifre Belirle
                </a>
              </div>

              <!-- Raw Link Box -->
              <div style="background-color: #fdfbf7; border: 1px solid #e5e1d8; border-radius: 14px; padding: 14px 16px; margin: 24px 0; text-align: left;">
                <p style="font-size: 11px; color: #777777; margin: 0 0 6px 0; font-weight: 600;">
                  Yukarıdaki buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayın:
                </p>
                <a href="${resetLink}" style="font-size: 11px; color: #6b705c; word-break: break-all; text-decoration: underline;">
                  ${resetLink}
                </a>
              </div>

              <!-- Security Box -->
              <div style="background-color: #fff9f5; border: 1px solid #f2e3d5; border-radius: 14px; padding: 14px 16px; text-align: left; margin-top: 24px;">
                <p style="font-size: 12px; line-height: 1.5; color: #cb997e; margin: 0; font-weight: 600;">
                  ⚠️ Güvenlik Uyarısı:
                </p>
                <p style="font-size: 11.5px; line-height: 1.5; color: #8c6a58; margin: 4px 0 0 0;">
                  Bu talebi siz yapmadıysanız bu e-postayı güvenle göz ardı edebilirsiniz. Şifreniz siz yeni bir şifre oluşturana kadar değişmeyecektir. Bağlantı güvenlik amacıyla tek kullanımlık ve sürelidir.
                </p>
              </div>

              <!-- Footer -->
              <div style="margin-top: 32px; border-top: 1px solid #e5e1d8; padding-top: 20px; text-align: center;">
                <p style="font-size: 11px; color: #a5a58d; margin: 0 0 4px 0;">
                  PsyCalcu — Psikologlar &amp; Klinisyenler İçin Seans ve Finans Yönetim Sistemi
                </p>
                <p style="font-size: 10px; color: #cccccc; margin: 0;">
                  Bu e-posta otomatik olarak gönderilmiştir.
                </p>
              </div>

            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"PsyCalcu Destek" <${smtpUser}>`,
          to: targetEmail,
          subject: "🔑 PsyCalcu Şifre Sıfırlama Bağlantınız",
          html: htmlTemplate,
        });

        console.log(`Custom branded password reset email sent to ${targetEmail}`);
        return res.json({
          success: true,
          customSent: true,
          message: "Şifre sıfırlama e-postası PsyCalcu özel şablonuyla başarıyla gönderildi."
        });
      }

      return res.json({
        success: true,
        customSent: false,
        resetLink: resetLink || null,
        message: "Özel SMTP tanımlı olmadığı için varsayılan e-posta sistemine yönlendiriliyor."
      });
    } catch (error: any) {
      console.error("Custom password reset error:", error);
      res.status(500).json({ error: error?.message || "E-posta gönderilirken bir hata oluştu." });
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

  // API Route for secure, public room availability data (without userId, to prevent HTML routing fall-through)
  app.get("/api/public-availability", (req, res) => {
    return res.status(400).json({ error: "Kullanıcı ID gereklidir." });
  });

  // API Route for secure, public room availability data
  app.get("/api/public-availability/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || userId === "undefined" || userId === "null" || userId.trim() === "") {
        return res.status(400).json({ error: "Geçerli bir Kullanıcı ID gereklidir." });
      }

      // Demo klinik handling for instant preview & testing without db record
      if (userId === "demo_klinik" || userId === "demo") {
        const todayStr = new Date().toISOString().split('T')[0];
        return res.json({
          therapistName: "PsyCalcu Örnek Klinik",
          therapistPhone: "05320000000",
          rooms: [
            { id: "room_1", name: "Oda 1 - Ege (Bireysel)", type: "standard", color: "#6b705c" },
            { id: "room_2", name: "Oda 2 - Marmara (Oyun)", type: "play-therapy", color: "#cb997e" },
            { id: "room_3", name: "Oda 3 - Akdeniz (Çift & Aile)", type: "family-therapy", color: "#b5838d" }
          ],
          blockedSlots: [],
          sessions: [
            { id: "s1", date: todayStr, time: "10:00", duration: 50, roomId: "room_1", type: "busy" },
            { id: "s2", date: todayStr, time: "14:00", duration: 50, roomId: "room_2", type: "busy" },
            { id: "s3", date: todayStr, time: "16:00", duration: 50, roomId: "room_3", type: "busy" }
          ]
        });
      }

      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(configPath)) {
        return res.status(500).json({ error: "Firebase konfigürasyon dosyası bulunamadı." });
      }

      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const projectId = config.projectId;
      const apiKey = config.apiKey;
      const databaseId = config.firestoreDatabaseId || "(default)";

      let rawData: any = null;
      let fromPublicCollection = false;

      // 1. Try to fetch from the public_availability collection via REST API first (fast, secure, bypasses 403)
      try {
        const publicFirestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/public_availability/${userId}?key=${apiKey}`;
        const response = await fetch(publicFirestoreUrl);
        if (response.ok) {
          const docData = await response.json();
          rawData = parseFirestoreDocument(docData);
          fromPublicCollection = true;
          console.log(`Successfully fetched public-safe availability for user: ${userId}`);
        } else if (response.status === 404) {
          console.log(`Public-safe availability document not found for user: ${userId}. Trying fallback options.`);
        } else {
          console.warn(`Public Firestore REST API returned status ${response.status} when fetching public_availability.`);
        }
      } catch (restErr) {
        console.error("Failed to fetch public-safe availability via REST API:", restErr);
      }

      // 2. Fallback: If not found in public_availability, try Admin SDK if initialized
      if (!rawData) {
        let dbInstance = adminDb;
        if (!dbInstance) {
          try {
            if (getAdminApps().length === 0) {
              const adminApp = initializeAdminApp({ projectId });
              dbInstance = getAdminFirestore(adminApp, databaseId);
              adminDb = dbInstance;
            } else {
              dbInstance = getAdminFirestore();
            }
          } catch (err) {
            console.error("Failed to initialize Admin SDK in public route:", err);
          }
        }

        if (dbInstance) {
          try {
            console.log(`Fallback: Using Admin SDK to fetch user data for: ${userId}`);
            const docRef = dbInstance.collection("users").doc(userId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
              rawData = docSnap.data();
            }
          } catch (adminErr) {
            console.error("Admin SDK fallback query failed:", adminErr);
          }
        }
      }

      // 3. Fallback: If still not found, do NOT try unauthenticated REST query on private 'users' collection (guaranteed 403),
      // instead return a clean, friendly 404 message.
      if (!rawData) {
        return res.status(404).json({
          error: "Klinik müsaitlik bilgisi bulunamadı. Lütfen ilgili klinisyenin paneline giriş yaparak müsaitlik ayarlarını en az bir kere güncellediğinden emin olun."
        });
      }

      const settings = rawData.settings || rawData;
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

      // If we fetched the full user document (not the pre-filtered one), let's background-write it to public_availability
      // to make future loads faster and unauthenticated-safe!
      if (!fromPublicCollection) {
        try {
          let dbInstance = adminDb;
          if (dbInstance) {
            const publicData = {
              therapistName: settings.therapistName || "Terapist",
              rooms: settings.rooms || [],
              blockedSlots: settings.blockedSlots || [],
              sessions: publicSessions,
              updatedAt: new Date().toISOString()
            };
            await dbInstance.collection("public_availability").doc(userId).set(publicData, { merge: true });
            console.log(`Cached public availability data for user ${userId} to public_availability collection.`);
          }
        } catch (cacheErr) {
          console.warn("Could not cache public availability data:", cacheErr);
        }
      }

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

      // Handle webcal:// protocol and trim spaces
      let normalizedUrl = calendarUrl.trim();
      if (normalizedUrl.startsWith("webcal://")) {
        normalizedUrl = "https://" + normalizedUrl.substring(9);
      } else if (normalizedUrl.startsWith("webcal:")) {
        normalizedUrl = "https:" + normalizedUrl.substring(7);
      } else if (normalizedUrl.startsWith("http://")) {
        normalizedUrl = "https://" + normalizedUrl.substring(7);
      }

      // Safe decodeURIComponent in case URL was double-encoded or passed with %2540
      try {
        normalizedUrl = decodeURIComponent(normalizedUrl);
      } catch (e) {
        // Ignore decode error if malformed
      }

      // Google Calendar path requirement: Replace @ with %40 in URL path
      if (normalizedUrl.includes("google.com")) {
        if (normalizedUrl.includes("/public/basic.ics")) {
          return res.status(400).json({
            error: "Google Takvim 'Genel adres' (.ics) bağlantılarına erişim engeli (404) koymaktadır. Lütfen Google Takvim Ayarları > 'Takvimi Entegre Et' altındaki 'iCal biçimindeki GİZLİ ADRES' bağlantısını kopyalayıp girin."
          });
        }

        if (normalizedUrl.includes("/embed") || normalizedUrl.includes("cid=") || normalizedUrl.includes("/calendar/u/") || normalizedUrl.includes("/calendar/r")) {
          return res.status(400).json({
            error: "Girdiğiniz bağlantı Google Takvim web arayüzü bağlantısıdır. Seansların otomatik çekilmesi için 'Takvimi Entegre Et' bölümündeki 'iCal biçimindeki gizli adres' (.ics) bağlantısını kullanmalısınız."
          });
        }

        // Convert any @ to %40 for google calendar URLs
        normalizedUrl = normalizedUrl.replace(/@/g, "%40");
      } else {
        // Safe encoding for non-Google calendars (iCloud, Outlook, custom)
        try {
          normalizedUrl = encodeURI(normalizedUrl);
        } catch (urlErr) {
          console.error("URL encoding error:", urlErr);
        }
      }

      console.log(`Fetching calendar from: ${normalizedUrl}`);
      const fetchResponse = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 iCal/1.0",
          "Accept": "text/calendar, text/plain, application/octet-stream, */*"
        }
      });

      if (!fetchResponse.ok) {
        let serverErrorDetails = "";
        try {
          const bodySnippet = await fetchResponse.text();
          if (bodySnippet && bodySnippet.length < 300) {
            serverErrorDetails = ` - ${bodySnippet}`;
          }
        } catch (e) {}

        if (fetchResponse.status === 404) {
          throw new Error(`Takvim bulunamadı (404). Google Takvim kullanıyorsanız 'Genel adres' yerine 'iCal biçimindeki gizli adres' bağlantısını girdiğinizden ve adresin eksiksiz kopyalandığından emin olun.`);
        } else if (fetchResponse.status === 403 || fetchResponse.status === 401) {
          throw new Error(`Takvim erişim yetkisi reddedildi (${fetchResponse.status}). Google Takvim'de 'iCal biçimindeki gizli adres'i kullandığınızdan veya takvimin herkese açık/paylaşılmış olduğundan emin olun.`);
        }
        throw new Error(`Takvim sunucusu hata döndürdü: HTTP ${fetchResponse.status} ${fetchResponse.statusText}${serverErrorDetails}`);
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
      const trimmed = icsData.trim();
      const isHtml = trimmed.startsWith("<html") || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<HTML");
      const hasCalendarHeaders = trimmed.toUpperCase().includes("BEGIN:VCALENDAR") || trimmed.toUpperCase().includes("BEGIN:VEVENT");

      if (isHtml && !hasCalendarHeaders) {
        if (calendarUrl.includes("google.com")) {
          throw new Error("Google sunucusu takvim verisi yerine web sayfası (HTML) döndürdü. Lütfen Google Takvim Ayarları > 'Takvimi Entegre Et' bölümündeki 'iCal biçimindeki gizli adres' bağlantısını eksiksiz kopyaladığınızdan emin olun.");
        } else {
          throw new Error("Takvim sunucusu takvim dosyası yerine bir web sayfası (HTML) döndürdü. Lütfen takviminizi herkese açık (Public) paylaştığınızdan ve gizli iCal/WebCal linkini eksiksiz kopyaladığınızdan emin olun.");
        }
      }

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
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
      res.status(500).json({ error: `${err?.message || err}` });
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
