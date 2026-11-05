import { GoogleGenAI, Type } from "@google/genai";

function cleanStutteredTypos(input) {
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

function localTurkishCleanup(input) {
  if (!input) return "";
  let s = cleanStutteredTypos(input)
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
  const rawText = cleanStutteredTypos(String(text || "").trim());
  const rawTitle = String(phaseTitle || "")
    .replace(/^(süreç değerlendirmesi|genel değerlendirme|seans değerlendirmesi|seans notu|görüşme notu)$/i, "")
    .trim();

  if (!rawText) {
    return res.status(200).json({ correctedText: "", correctedTitle: rawTitle, usedAi: false });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      correctedText: localTurkishCleanup(rawText),
      correctedTitle: rawTitle,
      usedAi: false
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
        ? `Sen uzman bir Türkçe klinik metin ve dil editörüsün. Verilen değerlendirme/öneri metnindeki tüm yazım yanlışlarını, bitişik/ayrık yazım hatalarını, "A anne" gibi klavye sürçmelerini, cümle düşüklüklerini (anlatım bozukluklarını), ek eksikliklerini, Türkçe karakter eksikliklerini ve noktalama hatalarını düzelterek akıcı, kurallı ve profesyonel bir Türkçe metin haline getir. Kesinlikle psikolog adı veya ünvanı ekleme.`
        : `Sen uzman bir Türkçe klinik metin, imla ve anlatım bozukluğu editörüsün.
GÖREVİN: Verilen psikolojik danışmanlık seans notundaki TÜM yazım hatalarını, harf/klavye sürçmelerini, cümle düşüklüklerini (anlatım bozukluklarını), devrik/kopuk ifadeleri ve noktalama eksikliklerini kapsamlı biçimde düzelterek, notu Türk Dil Kurumu (TDK) kurallarına uygun, kurallı, akıcı ve profesyonel bir Türkçe klinik seans notuna dönüştürmek.

KESİN DÜZELTME KURALLARI:
1. KLAVYE SÜRÇMELERİ VE KOPUK HARFLER ("A anne" vb.):
   - Kelimelerin önünde veya arasında yanlışlıkla yazılmış tek harfleri, mükerrer baş harfleri veya kopuk heceleri (örneğin "A anne" -> "Anne" veya "Annesi", "a anne" -> "anne", "B baba" -> "Baba", "d danışan" -> "danışan", "A., anne" -> "Annesi") KESİNLİKLE bir kişi adı kısaltması ("A.") sanma. Bunlar yazım hatasıdır; fazladan harfi tamamen kaldır ve kelimeyi doğru bağlamda yaz.
2. CÜMLE DÜŞÜKLÜĞÜ VE ANLATIM BOZUKLUĞU DÜZELTME:
   - Hızlı not alınırken oluşmuş düşük cümleleri, yarım bırakılmış ifadeleri, özne-yüklem uyumsuzluklarını, eksik hal/iyelik/tamlama eklerini ve ardışık fiil tekrarlarını (ör. "... söyledi konuştu", "... zorlanıyor anlattı", "anne ile sınır koyma zorlanıyor") düzelt.
   - Kopuk veya telgraf tarzı notları, nottaki gerçek bilgileri koruyarak dilbilgisi açısından tam, kurallı ve akıcı Türkçe cümlelere dönüştür.
3. YANLIŞ VE BİTİŞİK YAZILMIŞ KELİMELER:
   - Yanlış yazılmış, harfi eksik/fazla/yer değiştirmiş veya bitişik yazılmış tüm kelimeleri (ör. "kelimeyanlış" -> "kelime yanlış", "göürşme" -> "görüşme", "yerindki" -> "yerindeki", "konustk" -> "konuştuk") ve eksik Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) düzelt.
4. GERÇEK İÇERİĞE SADAKAT:
   - Notta yer almayan hayali bir olay uydurma; "takvim notuna göre", "50 dakikalık görüşmede" veya psikolog adı/ünvanı gibi kalıp ifadeler ekleme.
5. NOTA ÖZEL BAŞLIK ("correctedTitle"):
   - Kesinlikle "Süreç Değerlendirmesi", "Seans Notu", "Görüşme Değerlendirmesi" gibi genel başlıklar KULLANMA. Doğrudan bu notta işlenen spesifik konuyu özetleyen 2-4 kelimelik özgün bir odak başlığı üret (ör. "Anne ile Sınır Koyma", "Kaygı ve Nefes Egzersizi", "Aile İçi İletişim", "İş Stresi ve Öz Değer").`;

    const prompt =
      mode === "summary"
        ? `Aşağıdaki metnin imla, yazım ve cümle düşüklüğü hatalarını düzelt:\n${rawText}`
        : `Danışan: ${clientName || "Danışan"}
Tarih: ${sessionDate || "-"}
Düzeltilecek Ham Seans Notu:
${rawText}`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        correctedText: {
          type: Type.STRING,
          description: "Klavye sürçmeleri ('A anne' vb.), yanlış yazılmış kelimeler, cümle düşüklükleri (anlatım bozuklukları), büyük harf ve noktalama hataları tamamen düzeltilmiş, akıcı ve kurallı Türkçe metin."
        },
        correctedTitle: {
          type: Type.STRING,
          description: "Notta işlenen spesifik konuya uygun, 'Süreç Değerlendirmesi' gibi genel ifadeler içermeyen, 2-4 kelimelik özgün odak başlığı."
        }
      },
      required: ["correctedText", "correctedTitle"]
    };

    const candidateModels = [
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite"
    ];

    let response = null;
    let lastErr = null;
    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
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

    const rawJson = (response.text || "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(rawJson || "{}");
    const correctedText = localTurkishCleanup(String(parsed?.correctedText || "").trim() || rawText);
    const correctedTitle = String(parsed?.correctedTitle || "")
      .replace(/^(süreç değerlendirmesi|genel değerlendirme|seans değerlendirmesi|seans notu|görüşme notu)$/i, "")
      .trim() || rawTitle;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).json({
      correctedText,
      correctedTitle,
      usedAi: true
    });
  } catch (error) {
    return res.status(200).json({
      correctedText: localTurkishCleanup(rawText),
      correctedTitle: rawTitle,
      usedAi: false
    });
  }
}
