import { GoogleGenAI, Type } from "@google/genai";

function localTurkishCleanup(input) {
  if (!input) return "";
  let s = String(input)
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])(?=[^\s.,!?;:\d])/g, "$1 ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Capitalize first letter of text and first letter after sentence endings in Turkish
  s = s.replace(/(^|[.!?]\s+|\n\s*)([a-zçğıöşüi])/g, (_, prefix, ch) => {
    return prefix + ch.toLocaleUpperCase("tr-TR");
  });

  if (s && !/[.!?…:]$/.test(s)) {
    s += ".";
  }
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

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { text = "", phaseTitle = "", clientName = "", sessionDate = "", mode = "session_note" } = body;
  const rawText = String(text || "").trim();
  const rawTitle = String(phaseTitle || "").trim();

  if (!rawText) {
    return res.status(200).json({ correctedText: "", correctedTitle: rawTitle });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      correctedText: localTurkishCleanup(rawText),
      correctedTitle: rawTitle
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const systemInstruction =
      mode === "summary"
        ? `Sen uzman bir Türkçe klinik metin editörüsün. Verilen değerlendirme/öneri metninin anlamını ve içeriğini değiştirmeden yalnızca Türkçe imla, yazım, noktalama, büyük-küçük harf ve anlatım bozukluklarını düzelt. Kesinlikle psikolog adı veya ünvanı ekleme.`
        : `Sen uzman bir Türkçe klinik metin ve imla editörüsün.
GÖREVİN: Verilen psikolojik danışmanlık seans notunun anlamını, klinik detaylarını ve bilgi içeriğini HİÇBİR ŞEKİLDE değiştirmeden veya eksiltmeden; yalnızca Türkçe imla, yazım yanlışları, eksik Türkçe karakterler, noktalama işaretleri, cümle başı büyük harf uyumu ve cümle düşüklüklerini düzelterek profesyonel, yalın ve akıcı bir Türkçe metne dönüştürmek.

KESİN KURALLAR:
1. Notta bulunmayan hiçbir hayali bilgi, yorum veya kalıp ifade ("bu seansta", "takvim notuna göre", "online görüşmede", psikolog adı/ünvanı vb.) EKLEME.
2. Nottaki hiçbir klinik detayı veya bilgiyi SİLME, atlama.
3. Cümle başlarını mutlaka BÜYÜK HARFLE başlat, noktalama işaretlerini ve eksik Türkçe harfleri Türk Dil Kurumu (TDK) imla kurallarına uygun biçimde düzelt.
4. "correctedTitle" alanında, seans numarası içermeyen 2-4 kelimelik sade ve net bir odak başlığı döndür.`;

    const prompt =
      mode === "summary"
        ? `Düzeltilecek Metin:\n${rawText}`
        : `Danışan: ${clientName || "Danışan"}
Tarih: ${sessionDate || "-"}
Mevcut Başlık: ${rawTitle || "(Yok)"}
Düzeltilecek Seans Notu:
${rawText}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        correctedText: {
          type: Type.STRING,
          description: "İmla, yazım, büyük harf ve noktalama hataları düzeltilmiş, anlamı ve detayları korunmuş Türkçe metin."
        },
        correctedTitle: {
          type: Type.STRING,
          description: "Seans numarası içermeyen, 2-4 kelimelik imlası düzgün odak başlığı."
        }
      },
      required: ["correctedText", "correctedTitle"]
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });
    } catch (err0) {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });
    }

    const parsed = JSON.parse(response.text || "{}");
    const correctedText = localTurkishCleanup(String(parsed?.correctedText || "").trim() || rawText);
    const correctedTitle = String(parsed?.correctedTitle || "").trim() || rawTitle;

    return res.status(200).json({
      correctedText,
      correctedTitle
    });
  } catch (error) {
    return res.status(200).json({
      correctedText: localTurkishCleanup(rawText),
      correctedTitle: rawTitle
    });
  }
}
