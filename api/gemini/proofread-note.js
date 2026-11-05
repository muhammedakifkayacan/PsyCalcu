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
    if (ch === "i") return prefix + "İ";
    if (ch === "ı") return prefix + "I";
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

  let bodyObj = {};
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      bodyObj = JSON.parse(req.body);
    } catch (e) {}
  } else if (req.body && typeof req.body === "object") {
    bodyObj = req.body;
  }

  const source = Object.keys(bodyObj).length > 0 ? bodyObj : req.query || {};
  const { text = "", phaseTitle = "", clientName = "", sessionDate = "", mode = "session_note" } = source;
  const rawText = String(text || "").trim();
  const rawTitle = String(phaseTitle || "")
    .replace(/^Süreç Değerlendirmesi$/i, "")
    .trim();

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
        ? `Sen uzman bir Türkçe klinik metin ve imla editörüsün. Verilen değerlendirme/öneri metninin anlamını ve içeriğini değiştirmeden yanlış yazılmış kelimeleri, bitişik yazılmış kelimeleri, harf sürçmelerini, Türkçe karakter eksikliklerini, büyük-küçük harf uyumunu ve noktalama işaretlerini düzelt. Kesinlikle psikolog adı veya ünvanı ekleme.`
        : `Sen uzman bir Türkçe klinik metin ve imla editörüsün.
GÖREVİN: Verilen psikolojik danışmanlık seans notunun anlamını, klinik detaylarını ve bilgi içeriğini HİÇBİR ŞEKİLDE değiştirmeden veya eksiltmeden; yanlış yazılmış kelimeleri (typoları, harf yer değiştirmelerini, bitişik yazılmış kelimeleri, eksik harfleri), eksik Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü), noktalama işaretlerini, cümle başı büyük harf uyumunu ve devrik/düşük ifadeleri düzelterek Türk Dil Kurumu (TDK) kurallarına uygun, profesyonel ve akıcı bir Türkçe metne dönüştürmek.

KESİN KURALLAR:
1. KELİME DÜZELTME: Yanlış yazılmış, harfi eksik/fazla veya bitişik yazılmış tüm kelimeleri (ör. "kelimeyanlış" -> "kelime yanlış", "göürşme" -> "görüşme", "yerindki" -> "yerindeki", "konustk" -> "konuştuk") doğru Türkçe yazılışlarıyla düzelt.
2. İÇERİK KORUMA: Notta bulunmayan hiçbir hayali bilgi, yorum veya kalıp ifade ("bu seansta", "takvim notuna göre", "online görüşmede", psikolog adı/ünvanı vb.) EKLEME. Nottaki hiçbir klinik detayı SİLME.
3. NOTA ÖZEL BAŞLIK ("correctedTitle"): Kesinlikle "Süreç Değerlendirmesi", "Seans Notu", "Görüşme Değerlendirmesi" gibi genel/standart başlıklar KULLANMA. Doğrudan bu notta konuşulan spesifik konuyu özetleyen, seans numarası içermeyen 2-4 kelimelik özgün bir başlık üret (ör. "Kaygı ve Uyku Düzeni", "Aile İçi İletişim", "İş Stresi ve Sınırlar", "Özgüven ve Öz Şefkat").`;

    const prompt =
      mode === "summary"
        ? `Düzeltilecek Metin:\n${rawText}`
        : `Danışan: ${clientName || "Danışan"}
Tarih: ${sessionDate || "-"}
Düzeltilecek Seans Notu:
${rawText}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        correctedText: {
          type: Type.STRING,
          description: "Yanlış yazılmış kelimeleri, imla, büyük harf ve noktalama hataları düzeltilmiş, anlamı ve detayları korunmuş Türkçe metin."
        },
        correctedTitle: {
          type: Type.STRING,
          description: "Notta işlenen spesifik konuya uygun, 'Süreç Değerlendirmesi' gibi genel ifadeler içermeyen, 2-4 kelimelik özgün odak başlığı."
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

    const rawJson = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(rawJson || "{}");
    const correctedText = localTurkishCleanup(String(parsed?.correctedText || "").trim() || rawText);
    const correctedTitle = String(parsed?.correctedTitle || "")
      .replace(/^Süreç Değerlendirmesi$/i, "")
      .trim() || rawTitle;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
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
