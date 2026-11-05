import { GoogleGenAI, Type } from "@google/genai";

function cleanStutteredReportText(input) {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/\b[Aa][.,]?\s+(anne[a-zçğıöşü]*)\b/g, (match, word) => {
    const first = match.trim().charAt(0);
    return first === "A" ? "A" + word.slice(1) : word;
  });
  s = s.replace(
    /(^|[\s(.,;:"'“‘\-–—])([a-zçğıöşüA-ZÇĞİÖŞÜ])[.,]?\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]{3,})\b/gu,
    (full, prefix, singleCh, nextWord) => {
      const sLower = singleCh.toLocaleLowerCase("tr-TR");
      const wLower = nextWord.charAt(0).toLocaleLowerCase("tr-TR");
      if (
        sLower === wLower ||
        ((singleCh === "A" || singleCh === "a") &&
          nextWord.charAt(0) === nextWord.charAt(0).toLocaleLowerCase("tr-TR"))
      ) {
        const isUpper =
          singleCh === singleCh.toLocaleUpperCase("tr-TR") &&
          singleCh !== singleCh.toLocaleLowerCase("tr-TR");
        if (isUpper) {
          const firstW = nextWord.charAt(0);
          const upW = firstW === "i" ? "İ" : firstW === "ı" ? "I" : firstW.toLocaleUpperCase("tr-TR");
          return `${prefix}${upW}${nextWord.slice(1)}`;
        }
        return `${prefix}${nextWord}`;
      }
      return full;
    }
  );
  return s;
}

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

  let body = {};
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      body = JSON.parse(req.body);
    } catch (e) {}
  } else if (req.body && typeof req.body === "object") {
    body = req.body;
  }
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
      const raw = cleanStutteredReportText((s.rawNote || "").trim());
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
      sessionNote: cleanStutteredReportText(String(s.rawNote || "").trim())
    }));

    const prompt = `Minimalist, sade ve anlaşılır bir "Danışan Süreç ve İlerleme Raporu" hazırlayan uzman klinik editörsün.
Aşağıda "${clientName}" adlı danışanın YALNIZCA not bulunan seansları ("sessionNote") yer almaktadır.

KESİN YAZIM VE DİL KURALLARI:
1. İMLA, YAZIM VE CÜMLE DÜŞÜKLÜĞÜ DÜZELTME:
   - Notlardaki tüm yazım yanlışlarını, bitişik/ayrık yazılmış kelimeleri, "A anne" gibi klavye sürçmelerini (bunları kesinlikle "A." diye kısaltma yapma, fazladan harfi silerek "Anne" / "Annesi" olarak düzelt), cümle düşüklüklerini (anlatım bozukluklarını), devrik/kopuk ifadeleri ve noktalama hatalarını tamamen düzelt.
2. SADE VE TEKRARSIZ DİL: Metinlerde kesinlikle "takvim notuna göre", "takvim etkinlik kaydına göre", "online seans kapsamında", "50 dakikalık görüşmede" veya "X. seansta" gibi tekrar eden kalıp ibareler KULLANMA.
3. PSİKOLOG ADI VE ÜNVANI YASAĞI: Metinlerin ("executiveSummary", "formattedReportNote", "recommendations") içinde kesinlikle psikolog adını, klinik adını veya "Uzman Psikolog & Aile Danışmanı" ünvanını YAZMA.
4. BAŞLIKLAR ("phaseTitle"): Başlığın başına "1. Seans •" gibi numara EKLEME ve kesinlikle "Süreç Değerlendirmesi" gibi genel başlıklar KULLANMA. Doğrudan o görüşmenin notundaki spesifik konuyu anlatan 2-4 kelimelik özgün bir başlık yaz.
5. SEANS METNİ ("formattedReportNote"): Nottaki bilgileri hiçbir detayı atlamadan, cümle düşüklüklerini gidererek doğrudan akıcı, kurallı, yalın ve profesyonel 1-3 cümlelik bir paragrafa dönüştür. Notta olmayan hayali olaylar EKLEME.

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

    const candidateModels = [
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite"
    ];

    let response = null;
    let lastErr = null;
    for (const m of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema
          }
        });
        if (response && response.text) break;
      } catch (errModel) {
        lastErr = errModel;
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error("All Gemini models failed");
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
      const raw = cleanStutteredReportText(String(s.rawNote || "").trim());
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
      const aiFormatted = cleanStutteredReportText(String(aiItem?.formattedReportNote || "").trim());
      const aiTitle = String(aiItem?.phaseTitle || "")
        .replace(/^(süreç değerlendirmesi|genel değerlendirme|seans değerlendirmesi|seans notu|görüşme notu)$/i, "")
        .trim();
      return {
        sessionId: s.id,
        phaseTitle: aiTitle,
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
