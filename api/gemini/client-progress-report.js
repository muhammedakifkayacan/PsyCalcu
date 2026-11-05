import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { clientName, sessions = [], stats = {} } = body;

  const buildFallbackReport = () => {
    const completed = (sessions || []).filter((s) => s.type !== "cancelled").length;
    const notesWithContent = (sessions || []).filter((s) => s.rawNote && String(s.rawNote).trim().length > 0);
    const firstDateStr = stats?.firstDate || sessions[0]?.formattedDate || "Başlangıç";
    const lastDateStr = stats?.lastDate || sessions[sessions.length - 1]?.formattedDate || "Güncel";

    const executiveSummary = `${clientName} ile ${firstDateStr} – ${lastDateStr} tarihleri arasında toplam ${completed} görüşme gerçekleştirilmiştir.${
      notesWithContent.length > 0
        ? ` Görüşme kayıtları doğrultusunda danışanın süreç hedefleri ve klinik ilerlemesi aşağıda kronolojik olarak sunulmuştur.`
        : ``
    }`;

    const keyThemes =
      notesWithContent.length > 0
        ? ["Terapötik İş Birliği", "Duygusal Farkındalık", "Süreç Takibi"]
        : [];

    const timelineItems = (sessions || []).map((s) => {
      const raw = (s.rawNote || "").trim();
      return {
        sessionId: s.id,
        phaseTitle: "",
        progressBadge: "",
        formattedReportNote: raw,
        keyTakeaway: ""
      };
    });

    const recommendations =
      notesWithContent.length > 0
        ? `Görüşme sürekliliğinin korunması ve süreç hedeflerinin periyodik olarak değerlendirilmesi önerilmektedir.`
        : ``;

    return {
      reportTitle: `${clientName} — Süreç ve İlerleme Raporu`,
      executiveSummary,
      keyThemes,
      timelineItems,
      recommendations
    };
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!clientName || !Array.isArray(sessions) || sessions.length === 0 || !apiKey) {
      return res.status(200).json(buildFallbackReport());
    }

    const sessionsWithNotes = sessions.filter(
      (s) => s && s.rawNote && String(s.rawNote).trim().length > 0
    );

    if (sessionsWithNotes.length === 0) {
      return res.status(200).json(buildFallbackReport());
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const sessionDataForPrompt = sessionsWithNotes.map((s, idx) => ({
      sessionId: s.id,
      sessionNumber: s.sessionNumber || idx + 1,
      date: s.formattedDate || s.date,
      type: s.type === "face-to-face" ? "Yüz Yüze" : s.type === "cancelled" ? "İptal" : "Online",
      sessionNote: String(s.rawNote || "").trim()
    }));

    const prompt = `Minimalist, sade ve anlaşılır bir "Danışan Süreç ve İlerleme Raporu" hazırlayan klinik asistansın.
Aşağıda "${clientName}" adlı danışanın YALNIZCA not bulunan seansları ("sessionNote") yer almaktadır.

KESİN YAZIM KURALLARI:
1. SADE VE TEKRARSIZ DİL: Metinlerde kesinlikle "takvim notuna göre", "takvim etkinlik kaydına göre", "online seans kapsamında", "50 dakikalık görüşmede" veya "X. seansta" gibi tekrar eden kalıp ibareler KULLANMA.
2. PSİKOLOG ADI VE ÜNVANI YASAĞI: Metinlerin ("executiveSummary", "formattedReportNote", "recommendations") içinde kesinlikle psikolog adını, klinik adını veya "Uzman Psikolog & Aile Danışmanı" ünvanını YAZMA.
3. BAŞLIKLAR ("phaseTitle"): Başlığın başına "1. Seans •" gibi numara EKLEME. Doğrudan o görüşmenin notundaki odağı anlatan 2-4 kelimelik yalın bir başlık yaz.
4. SEANS METNİ ("formattedReportNote"): Nottaki bilgileri hiçbir detayı atlamadan, imla ve noktalama kurallarına uygun, büyük harfle başlayan akıcı ve yalın 1-3 cümlelik bir paragrafa dönüştür. Notta olmayan hayali veya kalıp cümleler EKLEME.

DANIŞAN ÖZETİ:
- Danışan: ${clientName}
- Toplam Görüşme: ${sessions.length} (Not bulunan görüşme: ${sessionsWithNotes.length})
- Dönem: ${stats?.firstDate || ""} – ${stats?.lastDate || ""}

NOT BULUNAN SEANS VERİLERİ:
${JSON.stringify(sessionDataForPrompt, null, 2)}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        reportTitle: { type: Type.STRING },
        executiveSummary: { type: Type.STRING },
        keyThemes: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        timelineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sessionId: { type: Type.STRING },
              phaseTitle: { type: Type.STRING },
              progressBadge: { type: Type.STRING },
              formattedReportNote: { type: Type.STRING },
              keyTakeaway: { type: Type.STRING }
            },
            required: ["sessionId", "phaseTitle", "progressBadge", "formattedReportNote", "keyTakeaway"]
          }
        },
        recommendations: { type: Type.STRING }
      },
      required: ["reportTitle", "executiveSummary", "keyThemes", "timelineItems", "recommendations"]
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema
        }
      });
    } catch (err0) {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema
        }
      });
    }

    const parsed = JSON.parse(response.text || "{}");
    if (!parsed || !Array.isArray(parsed.timelineItems)) {
      return res.status(200).json(buildFallbackReport());
    }

    const aiMapById = new Map();
    const aiMapByDate = new Map();
    parsed.timelineItems.forEach((item, idx) => {
      if (item && item.sessionId) {
        aiMapById.set(String(item.sessionId).trim(), item);
      }
      const promptItem = sessionDataForPrompt[idx];
      if (promptItem && item) {
        if (!aiMapById.has(promptItem.sessionId)) {
          aiMapById.set(promptItem.sessionId, item);
        }
        if (promptItem.date) {
          aiMapByDate.set(String(promptItem.date), item);
        }
      }
    });

    const mergedTimelineItems = sessions.map((s) => {
      const raw = String(s.rawNote || "").trim();
      if (!raw) {
        return {
          sessionId: s.id,
          phaseTitle: "",
          progressBadge: "",
          formattedReportNote: "",
          keyTakeaway: ""
        };
      }
      const aiItem =
        aiMapById.get(String(s.id || "").trim()) ||
        aiMapByDate.get(String(s.formattedDate || s.date || ""));
      const aiFormatted = String(aiItem?.formattedReportNote || "").trim();
      return {
        sessionId: s.id,
        phaseTitle: String(aiItem?.phaseTitle || "").trim(),
        progressBadge: String(aiItem?.progressBadge || "").trim(),
        formattedReportNote: aiFormatted || raw,
        keyTakeaway: ""
      };
    });

    return res.status(200).json({
      ...parsed,
      timelineItems: mergedTimelineItems
    });
  } catch (error) {
    return res.status(200).json(buildFallbackReport());
  }
}
