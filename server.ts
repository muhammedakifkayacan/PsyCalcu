import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import "dotenv/config";
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

let adminDb: any = null;

function foldTurkishAscii(str: string): string {
  if (!str) return "";
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/['’`.,;!?()-]/g, " ")
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
}

function normalizeSpokenTurkishNumbers(asciiText: string): string {
  let s = asciiText;
  const replacements: Array<[RegExp, string]> = [
    [/\biki bin bes yuz\b/g, "2500"],
    [/\biki bin iki yuz elli\b/g, "2250"],
    [/\biki bin iki yuz\b/g, "2200"],
    [/\biki bin yirmi alti\b/g, "2026"],
    [/\biki bin yirmi bes\b/g, "2025"],
    [/\biki bin yirmi dort\b/g, "2024"],
    [/\biki bin yirmi uc\b/g, "2023"],
    [/\biki bin yirmi iki\b/g, "2022"],
    [/\biki bin\b/g, "2000"],
    [/\buc bin bes yuz\b/g, "3500"],
    [/\buc bin\b/g, "3000"],
    [/\bdort bin\b/g, "4000"],
    [/\bbes bin\b/g, "5000"],
    [/\bbin dokuz yuz\b/g, "1900"],
    [/\bbin sekiz yuz\b/g, "1800"],
    [/\bbin yedi yuz elli\b/g, "1750"],
    [/\bbin yedi yuz\b/g, "1700"],
    [/\bbin alti yuz\b/g, "1600"],
    [/\bbin bes yuz\b/g, "1500"],
    [/\bbin dort yuz\b/g, "1400"],
    [/\bbin uc yuz\b/g, "1300"],
    [/\bbin iki yuz elli\b/g, "1250"],
    [/\bbin iki yuz\b/g, "1200"],
    [/\bbin yuz\b/g, "1100"],
    [/\bbin\b/g, "1000"],
    [/\bdokuz yuz\b/g, "900"],
    [/\bsekiz yuz\b/g, "800"],
    [/\byedi yuz elli\b/g, "750"],
    [/\byedi yuz\b/g, "700"],
    [/\balti yuz\b/g, "600"],
    [/\bbes yuz\b/g, "500"],
    [/\bdort yuz\b/g, "400"],
    [/\buc yuz elli\b/g, "350"],
    [/\buc yuz\b/g, "300"],
    [/\biki yuz elli\b/g, "250"],
    [/\biki yuz\b/g, "200"]
  ];
  for (const [regex, val] of replacements) {
    s = s.replace(regex, val);
  }

  // Convert spoken Turkish day numbers (1..31) when followed by a Turkish month name
  const monthNamesPattern = "(?:ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)";
  const spokenDays: Array<[string, string]> = [
    ["otuz bir", "31"], ["otuz", "30"],
    ["yirmi dokuz", "29"], ["yirmi sekiz", "28"], ["yirmi yedi", "27"], ["yirmi alti", "26"],
    ["yirmi bes", "25"], ["yirmi dort", "24"], ["yirmi uc", "23"], ["yirmi iki", "22"], ["yirmi bir", "21"], ["yirmi", "20"],
    ["on dokuz", "19"], ["on sekiz", "18"], ["on yedi", "17"], ["on alti", "16"], ["on bes", "15"],
    ["on dort", "14"], ["on uc", "13"], ["on iki", "12"], ["on bir", "11"], ["on", "10"],
    ["dokuz", "9"], ["sekiz", "8"], ["yedi", "7"], ["alti", "6"], ["bes", "5"], ["dort", "4"], ["uc", "3"], ["iki", "2"], ["bir", "1"]
  ];
  for (const [word, num] of spokenDays) {
    const r = new RegExp(`\\b${word}\\s+(?=${monthNamesPattern}\\b)`, "gi");
    s = s.replace(r, `${num} `);
  }

  return s;
}

const TURKISH_MONTHS_MAP: Record<string, { num: string; display: string }> = {
  ocak: { num: "01", display: "Ocak" },
  subat: { num: "02", display: "Şubat" },
  mart: { num: "03", display: "Mart" },
  nisan: { num: "04", display: "Nisan" },
  mayis: { num: "05", display: "Mayıs" },
  haziran: { num: "06", display: "Haziran" },
  temmuz: { num: "07", display: "Temmuz" },
  agustos: { num: "08", display: "Ağustos" },
  eylul: { num: "09", display: "Eylül" },
  ekim: { num: "10", display: "Ekim" },
  kasim: { num: "11", display: "Kasım" },
  aralik: { num: "12", display: "Aralık" }
};

interface ParsedCommandDate {
  targetDate?: string;       // YYYY-MM-DD when a specific day is spoken (e.g. "7 Ekim")
  targetMonth?: string;      // YYYY-MM when only a month is spoken (e.g. "Ekim'de")
  explicitYear?: number;
  resolvedYear: number;
  dateDisplayLabel?: string; // e.g. "7 Ekim 2026" or "Ekim 2026"
  cleanedMsgWithoutDate: string;
}

function parseTurkishDateFromCommand(asciiMsg: string): ParsedCommandDate {
  const currentYear = new Date().getFullYear();
  let explicitYear: number | undefined = undefined;

  const yearMatch = asciiMsg.match(/\b(202[0-9]|203[0-5])\b/);
  if (yearMatch) {
    explicitYear = parseInt(yearMatch[1], 10);
  } else if (asciiMsg.includes("gecen yil") || asciiMsg.includes("gecen sene") || asciiMsg.includes("onceki yil")) {
    explicitYear = currentYear - 1;
  } else if (asciiMsg.includes("gelecek yil") || asciiMsg.includes("seneye")) {
    explicitYear = currentYear + 1;
  }

  // Rule: If user didn't mention a year, ALWAYS assume the current calendar year
  const resolvedYear = explicitYear || currentYear;
  let cleaned = asciiMsg;

  if (/\bbugun(?:un|de|ki)?\b/.test(asciiMsg)) {
    const today = new Date().toISOString().split("T")[0];
    cleaned = cleaned.replace(/\bbugun(?:un|de|ki)?\b/g, " ");
    return {
      targetDate: today,
      explicitYear,
      resolvedYear,
      dateDisplayLabel: `Bugün (${today})`,
      cleanedMsgWithoutDate: cleaned
    };
  }
  if (/\bdun(?:un|de|ki)?\b/.test(asciiMsg)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split("T")[0];
    cleaned = cleaned.replace(/\bdun(?:un|de|ki)?\b/g, " ");
    return {
      targetDate: yesterday,
      explicitYear,
      resolvedYear,
      dateDisplayLabel: `Dün (${yesterday})`,
      cleanedMsgWithoutDate: cleaned
    };
  }
  if (/\byarin(?:in|da|ki)?\b/.test(asciiMsg)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split("T")[0];
    cleaned = cleaned.replace(/\byarin(?:in|da|ki)?\b/g, " ");
    return {
      targetDate: tomorrow,
      explicitYear,
      resolvedYear,
      dateDisplayLabel: `Yarın (${tomorrow})`,
      cleanedMsgWithoutDate: cleaned
    };
  }

  // Numeric date: DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const numericDateMatch = asciiMsg.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}))?\b/);
  if (numericDateMatch) {
    const dNum = parseInt(numericDateMatch[1], 10);
    const mNum = parseInt(numericDateMatch[2], 10);
    const yNum = numericDateMatch[3] ? parseInt(numericDateMatch[3], 10) : resolvedYear;
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
      const dd = String(dNum).padStart(2, "0");
      const mm = String(mNum).padStart(2, "0");
      cleaned = cleaned.replace(numericDateMatch[0], " ");
      return {
        targetDate: `${yNum}-${mm}-${dd}`,
        explicitYear: numericDateMatch[3] ? yNum : explicitYear,
        resolvedYear: yNum,
        dateDisplayLabel: `${dNum}.${mm}.${yNum}`,
        cleanedMsgWithoutDate: cleaned
      };
    }
  }

  for (const [mKey, mInfo] of Object.entries(TURKISH_MONTHS_MAP)) {
    const dayBeforeMonthRegex = new RegExp(
      `\\b(\\d{1,2})\\s*${mKey}(?:[a-z]{0,5})?(?:\\s+(20\\d{2}))?\\b`,
      "i"
    );
    const m1 = asciiMsg.match(dayBeforeMonthRegex);
    if (m1) {
      const dayInt = parseInt(m1[1], 10);
      if (dayInt >= 1 && dayInt <= 31) {
        const dayStr = String(dayInt).padStart(2, "0");
        const y = m1[2] ? parseInt(m1[2], 10) : resolvedYear;
        cleaned = cleaned.replace(m1[0], " ");
        return {
          targetDate: `${y}-${mInfo.num}-${dayStr}`,
          explicitYear: m1[2] ? y : explicitYear,
          resolvedYear: y,
          dateDisplayLabel: `${dayInt} ${mInfo.display} ${y}`,
          cleanedMsgWithoutDate: cleaned
        };
      }
    }

    const monthBeforeDayRegex = new RegExp(
      `\\b${mKey}(?:\\s+ayinin|\\s+ayi|\\s*in|\\s*un|\\s*nin|\\s*nun)?\\s+(\\d{1,2})(?:\\s*i|\\s*u|\\s*si|\\s*su|\\s*nda|\\s*nde|\\s*inde|\\s*unda)?(?:\\s+(20\\d{2}))?\\b`,
      "i"
    );
    const m2 = asciiMsg.match(monthBeforeDayRegex);
    if (m2) {
      const dayInt = parseInt(m2[1], 10);
      if (dayInt >= 1 && dayInt <= 31) {
        const dayStr = String(dayInt).padStart(2, "0");
        const y = m2[2] ? parseInt(m2[2], 10) : resolvedYear;
        cleaned = cleaned.replace(m2[0], " ");
        return {
          targetDate: `${y}-${mInfo.num}-${dayStr}`,
          explicitYear: m2[2] ? y : explicitYear,
          resolvedYear: y,
          dateDisplayLabel: `${dayInt} ${mInfo.display} ${y}`,
          cleanedMsgWithoutDate: cleaned
        };
      }
    }
  }

  for (const [mKey, mInfo] of Object.entries(TURKISH_MONTHS_MAP)) {
    const monthOnlyRegex = new RegExp(
      `\\b(?:(20\\d{2})\\s+)?${mKey}(?:\\s+ayi|\\s+ayinda|\\s+ayindaki|de|da|teki|taki|deki|daki|in|un|nin|nun)?(?:\\s+(20\\d{2}))?\\b`,
      "i"
    );
    const mm = asciiMsg.match(monthOnlyRegex);
    if (mm) {
      const y = mm[1] ? parseInt(mm[1], 10) : mm[2] ? parseInt(mm[2], 10) : resolvedYear;
      cleaned = cleaned.replace(mm[0], " ");
      return {
        targetMonth: `${y}-${mInfo.num}`,
        explicitYear: mm[1] || mm[2] ? y : explicitYear,
        resolvedYear: y,
        dateDisplayLabel: `${mInfo.display} ${y}`,
        cleanedMsgWithoutDate: cleaned
      };
    }
  }

  return {
    explicitYear,
    resolvedYear,
    cleanedMsgWithoutDate: cleaned
  };
}

function findBestClientMatchInPool(asciiMsgWithoutDate: string, pool: any[]): string {
  const uniqueClients = new Map<string, string>();
  (pool || []).forEach((s: any) => {
    if (s && s.clientName) {
      const cleanName = String(s.clientName).trim();
      const asciiName = foldTurkishAscii(cleanName);
      if (asciiName && !uniqueClients.has(asciiName)) {
        uniqueClients.set(asciiName, cleanName);
      }
    }
  });

  let matchedClientName = "";
  let bestMatchScore = 0;

  for (const [asciiClient, originalClient] of uniqueClients.entries()) {
    if (asciiClient.length >= 3 && asciiMsgWithoutDate.includes(asciiClient)) {
      const score = asciiClient.length + 100;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        matchedClientName = originalClient;
      }
    } else {
      const tokens = asciiClient.split(" ").filter((t) => t.length >= 2);
      if (tokens.length >= 2 && tokens.every((t) => asciiMsgWithoutDate.includes(t))) {
        const score = asciiClient.length + 50;
        if (score > bestMatchScore) {
          bestMatchScore = score;
          matchedClientName = originalClient;
        }
      } else if (tokens.length >= 1 && tokens[0].length >= 3) {
        const firstToken = tokens[0];
        const wordRegex = new RegExp(`\\b${firstToken}[a-z]{0,4}\\b`, "i");
        if (wordRegex.test(asciiMsgWithoutDate)) {
          const score = firstToken.length;
          if (score > bestMatchScore) {
            bestMatchScore = score;
            matchedClientName = originalClient;
          }
        }
      }
    }
  }

  return matchedClientName;
}

function processSmartLocalCommand(message: string, pageContext: any, sessions: any[]): { reply: string; actions: any[] } {
  const rawMsg = (message || "").trim();
  const asciiMsg = normalizeSpokenTurkishNumbers(foldTurkishAscii(rawMsg));

  const defaultBabysitterFee = Number(pageContext?.defaultBabysitterFee) || 250;
  const defaultOfficeRentFee = Number(pageContext?.defaultOfficeRentFee) || 200;
  const selectedDate = pageContext?.selectedDate || new Date().toISOString().split("T")[0];
  const visibleMonth = pageContext?.visibleMonth || selectedDate.slice(0, 7);

  // 1. Parse date / month / year from command FIRST
  const parsedDateInfo = parseTurkishDateFromCommand(asciiMsg);
  const { targetDate, targetMonth, dateDisplayLabel, cleanedMsgWithoutDate } = parsedDateInfo;

  // 2. Check if user is asking a question / summary about current page or month
  if (
    (asciiMsg.includes("kac seans") || asciiMsg.includes("toplam gelir") || asciiMsg.includes("ozet") || asciiMsg.includes("durum ne") || asciiMsg.includes("ne kadar")) &&
    !asciiMsg.includes("odendi") &&
    !asciiMsg.includes("odemesi") &&
    !asciiMsg.includes("parasi") &&
    !asciiMsg.includes("fiyat") &&
    !asciiMsg.includes("ucret") &&
    !asciiMsg.includes("tamamlandi") &&
    !asciiMsg.includes("iptal")
  ) {
    const scopedForSummary = targetDate
      ? (sessions || []).filter((s: any) => s.date === targetDate)
      : targetMonth
      ? (sessions || []).filter((s: any) => (s.date || "").startsWith(targetMonth))
      : sessions || [];
    const activeList = scopedForSummary.filter((s: any) => s.type !== "cancelled" && s.type !== "non-session");
    const paidList = activeList.filter((s: any) => s.paymentStatus === "paid");
    const unpaidList = activeList.filter((s: any) => s.paymentStatus !== "paid");
    const gross = activeList.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
    const unpaidTotal = unpaidList.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
    const scopeTitle = dateDisplayLabel ? `**${dateDisplayLabel}** döneminde` : "Bu görünümde";
    return {
      reply: `${scopeTitle} toplam **${activeList.length} aktif seans** bulunuyor (${paidList.length} ödendi, ${unpaidList.length} bekliyor). Toplam brüt tutar **₺${gross.toLocaleString("tr-TR")}**, tahsilat bekleyen tutar ise **₺${unpaidTotal.toLocaleString("tr-TR")}**.`,
      actions: []
    };
  }

  // 3. Strictly filter session pool by targetDate or targetMonth BEFORE matching client
  let dateScopedPool = sessions || [];
  if (targetDate) {
    dateScopedPool = (sessions || []).filter((s: any) => s.date === targetDate);
  } else if (targetMonth) {
    dateScopedPool = (sessions || []).filter((s: any) => (s.date || "").startsWith(targetMonth));
  }

  let matchedClientName = findBestClientMatchInPool(cleanedMsgWithoutDate, dateScopedPool);
  const globalMatchedClientName = matchedClientName || findBestClientMatchInPool(cleanedMsgWithoutDate, sessions || []);

  if (!matchedClientName && !targetDate && !targetMonth && pageContext?.selectedClientName) {
    matchedClientName = pageContext.selectedClientName;
  }

  // Parse updates from Turkish command
  const updates: any = {};

  // Session type / status
  if (asciiMsg.includes("iptal") || asciiMsg.includes("gelmedi")) {
    updates.type = "cancelled";
    updates.price = 0;
    updates.hasBabysitterFee = false;
    updates.babysitterFeeAmount = 0;
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  } else if (asciiMsg.includes("yuz yuze") || asciiMsg.includes("yuzyuze")) {
    updates.type = "face-to-face";
  } else if (asciiMsg.includes("online") || asciiMsg.includes("onlayn") || asciiMsg.includes("goruntulu")) {
    updates.type = "online";
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  }

  // Payment status
  if (
    asciiMsg.includes("odenmedi") ||
    asciiMsg.includes("odemedi") ||
    asciiMsg.includes("alinmadi") ||
    asciiMsg.includes("borc olarak")
  ) {
    updates.paymentStatus = "unpaid";
    updates.paidAmount = 0;
  } else if (
    asciiMsg.includes("odendi") ||
    asciiMsg.includes("odemesi alindi") ||
    asciiMsg.includes("oden parasi alindi") ||
    asciiMsg.includes("odeme parasi alindi") ||
    asciiMsg.includes("parasi alindi") ||
    asciiMsg.includes("parasini verdi") ||
    asciiMsg.includes("ucreti alindi") ||
    asciiMsg.includes("tahsil edildi") ||
    asciiMsg.includes("odedi")
  ) {
    updates.paymentStatus = "paid";
  }

  // Payment method
  if (asciiMsg.includes("nakit")) {
    updates.paymentMethod = "cash";
    if (!updates.paymentStatus) updates.paymentStatus = "paid";
  } else if (asciiMsg.includes("kredi kart") || asciiMsg.includes("kartla") || asciiMsg.includes("kart")) {
    updates.paymentMethod = "card";
    if (!updates.paymentStatus) updates.paymentStatus = "paid";
  } else if (asciiMsg.includes("havale") || asciiMsg.includes("eft") || asciiMsg.includes("iban") || asciiMsg.includes("banka")) {
    updates.paymentMethod = "transfer";
    if (!updates.paymentStatus) updates.paymentStatus = "paid";
  }

  // Babysitter fee
  if (
    asciiMsg.includes("bakici parasi yok") ||
    asciiMsg.includes("bakici yok") ||
    asciiMsg.includes("bakici ucreti yok") ||
    asciiMsg.includes("bakicisiz") ||
    asciiMsg.includes("bakici olmasin")
  ) {
    updates.hasBabysitterFee = false;
    updates.babysitterFeeAmount = 0;
  } else if (
    asciiMsg.includes("bakici parasi var") ||
    asciiMsg.includes("bakici var") ||
    asciiMsg.includes("bakici ucreti var") ||
    asciiMsg.includes("bakici eklensin") ||
    /bakici(?:\s+parasi|\s+ucreti)?\s+\d{2,5}/.test(asciiMsg)
  ) {
    updates.hasBabysitterFee = true;
    const babyNumMatch = asciiMsg.match(/bakici(?:\s+parasi|\s+ucreti)?\s*(?:var\s*)?(\d{2,5})/);
    updates.babysitterFeeAmount = babyNumMatch ? parseInt(babyNumMatch[1], 10) : defaultBabysitterFee;
  }

  // Office rent fee
  if (
    asciiMsg.includes("ofis kirasi yok") ||
    asciiMsg.includes("oda kirasi yok") ||
    asciiMsg.includes("kira yok") ||
    asciiMsg.includes("ofis ucreti yok") ||
    asciiMsg.includes("ofis yok")
  ) {
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  } else if (
    asciiMsg.includes("ofis kirasi var") ||
    asciiMsg.includes("oda kirasi var") ||
    asciiMsg.includes("kira var") ||
    asciiMsg.includes("ofis ucreti var") ||
    /(?:ofis|oda)\s*(?:kirasi|ucreti)\s+\d{2,5}/.test(asciiMsg)
  ) {
    updates.hasOfficeRentFee = true;
    const rentNumMatch = asciiMsg.match(/(?:ofis|oda)\s*(?:kirasi|ucreti)?\s*(?:var\s*)?(\d{2,5})/);
    updates.officeRentFeeAmount = rentNumMatch ? parseInt(rentNumMatch[1], 10) : defaultOfficeRentFee;
    if (!updates.type) {
      updates.type = "face-to-face";
    }
  }

  // Price parsing (from cleanedMsgWithoutDate so day/year numbers are not mistaken for price)
  const msgWithoutFeeNumbers = cleanedMsgWithoutDate
    .replace(/(\d)\.(\d{3})\b/g, "$1$2")
    .replace(/bakici(?:\s+parasi|\s+ucreti)?\s*(?:var\s*)?\d{2,5}/g, "")
    .replace(/(?:ofis|oda)\s*(?:kirasi|ucreti)?\s*(?:var\s*)?\d{2,5}/g, "");

  const pricePatterns = [
    /(?:fiyati|fiyat|ucreti|ucret|seans ucreti|tutar|tutari)\s*(?:su kadar\s*)?(\d{3,5})/i,
    /(\d{3,5})\s*(?:tl|lira|₺|turk lirasi)/i,
    /(?:fiyati|ucreti|odendi|alindi)\s+(\d{3,5})\b/i,
    /\b(\d{3,5})\b/
  ];
  for (const pat of pricePatterns) {
    const pm = msgWithoutFeeNumbers.match(pat);
    if (pm && pm[1]) {
      const val = parseInt(pm[1], 10);
      const isYearLike = val >= 2020 && val <= 2035 && pat.source === "\\b(\\d{3,5})\\b";
      if (!isYearLike && val >= 200 && val <= 50000) {
        updates.price = val;
        break;
      }
    }
  }

  const mentionsCompleted =
    asciiMsg.includes("tamamlandi") ||
    asciiMsg.includes("yapildi") ||
    asciiMsg.includes("gerceklesti") ||
    asciiMsg.includes("bitti");

  // CRITICAL GUARD: If user explicitly specified a date ("7 Ekim") or month ("Ekim'de")
  // and no session exists in that date/month for the spoken client, NEVER touch another date/month!
  if ((targetDate || targetMonth) && (Object.keys(updates).length > 0 || mentionsCompleted)) {
    if (!matchedClientName) {
      if (globalMatchedClientName) {
        const otherDates = (sessions || [])
          .filter((s: any) => foldTurkishAscii(s.clientName) === foldTurkishAscii(globalMatchedClientName))
          .map((s: any) => s.date)
          .slice(0, 3);
        const otherHint = otherDates.length > 0 ? ` (Diğer kayıtlı seans tarihleri: ${otherDates.join(", ")})` : "";
        return {
          reply: `Belirttiğiniz **${dateDisplayLabel || targetDate || targetMonth}** tarihinde **${globalMatchedClientName}** adına kayıtlı bir seans bulunamadı. Başka tarihteki seansların bozulmaması için hiçbir işlem yapılmadı${otherHint}.`,
          actions: []
        };
      }
      return {
        reply: `Belirttiğiniz **${dateDisplayLabel || targetDate || targetMonth}** tarihinde eşleşen bir danışan seansı bulunamadı. Herhangi bir seans değiştirilmedi.`,
        actions: []
      };
    }
  }

  if (matchedClientName && (Object.keys(updates).length > 0 || mentionsCompleted)) {
    const clientFirstToken = foldTurkishAscii(matchedClientName).split(" ")[0];
    const matchesClient = (s: any) => {
      if (!s || !s.clientName) return false;
      const sc = foldTurkishAscii(s.clientName);
      const mc = foldTurkishAscii(matchedClientName);
      if (sc === mc) return true;
      if ( !targetDate && !targetMonth ) return false;
      const scFirst = sc.split(" ")[0];
      return scFirst.length >= 3 && scFirst === clientFirstToken;
    };

    let targetSessions: any[] = [];
    if (targetDate) {
      targetSessions = (sessions || []).filter((s: any) => s.date === targetDate && matchesClient(s));
      if (targetSessions.length === 0) {
        return {
          reply: `**${dateDisplayLabel || targetDate}** tarihinde **${matchedClientName}** için seans bulunamadı. Diğer tarihlerdeki seanslara dokunulmadı.`,
          actions: []
        };
      }
    } else if (targetMonth) {
      targetSessions = (sessions || []).filter((s: any) => (s.date || "").startsWith(targetMonth) && matchesClient(s));
      if (targetSessions.length === 0) {
        return {
          reply: `**${dateDisplayLabel || targetMonth}** ayında **${matchedClientName}** için seans bulunamadı. Diğer aylardaki seanslara dokunulmadı.`,
          actions: []
        };
      }
    } else {
      const clientSessions = (sessions || []).filter((s: any) => foldTurkishAscii(s.clientName) === foldTurkishAscii(matchedClientName));
      targetSessions = clientSessions;

      if (pageContext?.activeTab === "agenda") {
        if (pageContext?.agendaViewMode === "day" && selectedDate) {
          const onSelected = clientSessions.filter((s: any) => s.date === selectedDate);
          if (onSelected.length > 0) targetSessions = onSelected;
        } else if (pageContext?.agendaViewMode === "month" && visibleMonth) {
          const inVisibleMonth = clientSessions.filter((s: any) => (s.date || "").startsWith(visibleMonth));
          if (inVisibleMonth.length > 0) targetSessions = inVisibleMonth;
        }
      }
    }

    const wantsAll = asciiMsg.includes("tum ") || asciiMsg.includes("hepsi") || asciiMsg.includes("butun ");
    if (!wantsAll && targetSessions.length > 1) {
      const referenceDate =
        targetDate ||
        (targetMonth ? `${targetMonth}-15` : pageContext?.agendaViewMode === "month" && visibleMonth ? `${visibleMonth}-15` : selectedDate);
      const sorted = [...targetSessions].sort((a: any, b: any) => {
        const diffA = Math.abs(new Date(a.date).getTime() - new Date(referenceDate).getTime());
        const diffB = Math.abs(new Date(b.date).getTime() - new Date(referenceDate).getTime());
        return diffA - diffB;
      });
      targetSessions = [sorted[0]];
    }

    const sessionIds = targetSessions.map((s: any) => s.id).filter(Boolean);
    const firstSession = targetSessions[0];
    const effectiveClientName = firstSession?.clientName || matchedClientName;

    if (mentionsCompleted && !updates.type && firstSession?.type === "cancelled") {
      updates.type = updates.hasOfficeRentFee ? "face-to-face" : "online";
    }

    const summaryParts: string[] = [];
    if (mentionsCompleted || updates.type) {
      summaryParts.push(
        updates.type === "cancelled"
          ? "İptal Edildi"
          : updates.type === "face-to-face"
          ? "Yüz Yüze Seans (Tamamlandı)"
          : updates.type === "online"
          ? "Online Seans (Tamamlandı)"
          : "Seans Tamamlandı"
      );
    }
    if (typeof updates.price === "number") {
      summaryParts.push(`Ücret: ₺${updates.price.toLocaleString("tr-TR")}`);
    }
    if (updates.paymentStatus === "paid") {
      summaryParts.push("Ödeme: Ödendi");
    } else if (updates.paymentStatus === "unpaid") {
      summaryParts.push("Ödeme: Ödenmedi");
    }
    if (typeof updates.hasBabysitterFee === "boolean") {
      summaryParts.push(
        updates.hasBabysitterFee
          ? `Bakıcı Ücreti: Var (₺${(updates.babysitterFeeAmount || defaultBabysitterFee).toLocaleString("tr-TR")})`
          : "Bakıcı Ücreti: Yok (₺0)"
      );
    }
    if (typeof updates.hasOfficeRentFee === "boolean") {
      summaryParts.push(
        updates.hasOfficeRentFee
          ? `Ofis Kirası: Var (₺${(updates.officeRentFeeAmount || defaultOfficeRentFee).toLocaleString("tr-TR")})`
          : "Ofis Kirası: Yok (₺0)"
      );
    }

    const dateLabel = firstSession?.date || targetDate || selectedDate;
    return {
      reply: `**${effectiveClientName}** (${dateLabel}) seansı komutunuza göre güncellendi: ${summaryParts.join(" • ")}.`,
      actions: [
        {
          actionType: "UPDATE_SESSIONS",
          sessionIds,
          clientName: effectiveClientName,
          targetDate: dateLabel,
          applyToScope: wantsAll ? "visible_period" : "single",
          updates
        }
      ]
    };
  }

  return {
    reply:
      "Komutunuzu aldım ancak hangi danışan veya işlem için uygulanacağını tam eşleştiremedim. Örneğin: *\"7 Ekim Özlem seans tamamlandı, ödemesi alındı, fiyatı 1500 TL, bakıcı parası var, ofis kirası yok\"* şeklinde söyleyebilirsiniz.",
    actions: []
  };
}

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

  app.use(express.json({ limit: "15mb" }));

  // API Route for Audio Transcription (Fallback when browser SpeechRecognition is unavailable)
  app.post("/api/assistant/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Ses verisi bulunamadı." });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: "Ses çözümleme servisi için GEMINI_API_KEY tanımlanmamış." });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: audioBase64
            }
          },
          "Bu Türkçe ses kaydını kelimesi kelimesine metne dönüştür. Sadece konuşulan metni döndür, başka hiçbir açıklama ekleme."
        ]
      });

      return res.json({ text: (response.text || "").trim() });
    } catch (err: any) {
      console.error("Audio transcription error:", err);
      return res.status(500).json({ error: "Ses metne dönüştürülemedi." });
    }
  });

  // API Route for Page-Aware Voice & Chat Assistant
  app.post("/api/assistant/chat", async (req, res) => {
    const { message, pageContext, sessions, history } = req.body || {};
    const localFallback = processSmartLocalCommand(message || "", pageContext, sessions || []);

    try {
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Mesaj boş olamaz." });
      }

      // If local parser already matched a deterministic session update or date-not-found guard, return immediately
      const parsedCmdDate = parseTurkishDateFromCommand(normalizeSpokenTurkishNumbers(foldTurkishAscii(message || "")));
      if (localFallback.actions.length > 0 || parsedCmdDate.targetDate || parsedCmdDate.targetMonth) {
        if (localFallback.actions.length > 0 || localFallback.reply.includes("bulunamadı")) {
          return res.json(localFallback);
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json(localFallback);
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      const currentCalendarYear = new Date().getFullYear();
      const scopedInputSessions = parsedCmdDate.targetDate
        ? (sessions || []).filter((s: any) => s.date === parsedCmdDate.targetDate)
        : parsedCmdDate.targetMonth
        ? (sessions || []).filter((s: any) => (s.date || "").startsWith(parsedCmdDate.targetMonth!))
        : (sessions || []);

      const compactSessions = scopedInputSessions.slice(0, 85).map((s: any) => ({
        id: s.id,
        clientName: s.clientName,
        date: s.date,
        time: s.time,
        type: s.type,
        price: s.price,
        paymentStatus: s.paymentStatus || "unpaid",
        paidAmount: s.paidAmount || 0,
        paymentMethod: s.paymentMethod || null,
        hasBabysitterFee: Boolean(s.hasBabysitterFee),
        babysitterFeeAmount: s.babysitterFeeAmount || 0,
        hasOfficeRentFee: Boolean(s.hasOfficeRentFee),
        officeRentFeeAmount: s.officeRentFeeAmount || 0
      }));

      const recentHistory = Array.isArray(history)
        ? history.slice(-4).map((h: any) => `${h.role === "user" ? "Kullanıcı" : "Asistan"}: ${h.content}`).join("\n")
        : "";

      const systemPrompt = `Sen PsyCalcu klinik yönetim ve muhasebe uygulamasının her sayfada çalışan akıllı Sesli ve Yazılı Asistanısın.
Kullanıcı bir psikolog/klinisyendir. Bulunduğu sayfadaki verilere bakarak sana sesli veya yazılı komutlar verir.

MEVCUT SAYFA VE AYAR BAĞLAMI:
- Mevcut Takvim Yılı: ${currentCalendarYear} (Kullanıcı yıl belirtmeden "7 Ekim" veya "Ekim'de" derse KESİNLİKLE ${currentCalendarYear} yılını kastediyordur. Sadece açıkça eski bir yıl söylerse o yıla bakılır.)
- Komuttan Algılanan Hedef Tarih/Ay: ${parsedCmdDate.targetDate || parsedCmdDate.targetMonth || "Belirtilmedi"}
- Aktif Sekme (activeTab): ${pageContext?.activeTab || "agenda"} (${pageContext?.activeTabLabel || "Ajanda"})
- Ajanda Görünüm Modu (agendaViewMode): ${pageContext?.agendaViewMode || "day"} (day=Günlük, week=Haftalık, month=Aylık)
- Seçili Tarih (selectedDate): ${pageContext?.selectedDate || ""}
- Görüntülenen Ay (visibleMonth): ${pageContext?.visibleMonth || ""}
- Seçili Danışan Profili (selectedClientName): ${pageContext?.selectedClientName || "Yok"}
- Varsayılan Seans Ücreti: ₺${pageContext?.defaultSessionPrice || 1200} (Online: ₺${pageContext?.defaultOnlinePrice || 1200}, Yüzyüze: ₺${pageContext?.defaultFaceToFacePrice || 1200})
- Varsayılan Bakıcı Ücreti: ₺${pageContext?.defaultBabysitterFee || 250}
- Varsayılan Ofis Kira Ücreti: ₺${pageContext?.defaultOfficeRentFee || 200}

BU EKRANDA GÖRÜNEN / İLGİLİ SEANSLAR (${compactSessions.length} adet):
${JSON.stringify(compactSessions)}

${recentHistory ? `SON KONUŞMA GEÇMİŞİ:\n${recentHistory}\n` : ""}

GÖREVİN VE KESİN TARİH KURALLARI:
1. Kullanıcının Türkçe komutunu dikkatlice analiz et.
2. KESİN TARİH VE AY KURALI: Kullanıcı bir gün ("7 Ekim Özlem") veya ay ("Ekim'de Özlem") belirttiyse SADECE o tarihteki veya o aydaki seansı güncelle. O tarihte/ayda o isme ait seans yoksa KESİNLİKLE başka bir aydaki (örneğin Mayıs ayındaki) seansa dokunma, 'actions' dizisini boş döndür ve o tarihte seans bulunamadığını söyle.
3. YIL KURALI: Kullanıcı yıl söylemediyse (sadece "7 Ekim" dediyse) her zaman mevcut yılı (${currentCalendarYear}) baz al.
4. Örneğin kullanıcı: "7 Ekim Özlem seans tamamlandı, ödemesi alındı, fiyatı 1500, bakıcı parası var, ofis kirası yok" dediğinde:
   - Listeden ilgili tarihteki seansı bul ve 'sessionIds' dizisine o seansın 'id' değerini ekle.
   - 'updates' içinde:
     * Fiyat belirtildiyse: price = belirtilen tutar (örn. 1500).
     * "ödemesi alındı / ödendi / parası alındı / öden parası alındı" dendiyse: paymentStatus = "paid". "ödenmedi" dendiyse: paymentStatus = "unpaid".
     * Ödeme yöntemi belirtildiyse ("nakit" -> "cash", "kart/kredi kartı" -> "card", "havale/eft/banka" -> "transfer") paymentMethod alanını ayarla.
     * "bakıcı parası var / bakıcı var" dendiyse: hasBabysitterFee = true, babysitterFeeAmount = (belirtildiyse tutar, yoksa varsayılan ${pageContext?.defaultBabysitterFee || 250}).
     * "bakıcı parası yok / bakıcı yok" dendiyse: hasBabysitterFee = false, babysitterFeeAmount = 0.
     * "ofis kirası var / kira var / yüzyüze" dendiyse: hasOfficeRentFee = true, officeRentFeeAmount = (belirtildiyse tutar, yoksa varsayılan ${pageContext?.defaultOfficeRentFee || 200}).
     * "ofis kirası yok / kira yok / online" dendiyse: hasOfficeRentFee = false, officeRentFeeAmount = 0.
     * "seans iptal / gelmedi" dendiyse: type = "cancelled", price = 0, hasBabysitterFee = false, hasOfficeRentFee = false.
     * "seans tamamlandı" dendiyse ve mevcut seans "cancelled" ise type = "online" veya "face-to-face" yap.
5. Eğer kullanıcı yeni bir seans eklemek istiyorsa ("Yarın saat 14:00'e Ayşe Yılmaz için online seans ekle"), actionType = "CREATE_SESSION" kullan.
6. Eğer kullanıcı bir danışanın tüm borçlarını kapatmak istiyorsa ("Ahmet Yılmaz'ın tüm borçlarını ödendi yap"), actionType = "MARK_CLIENT_ALL_PAID" kullan.
7. Eğer kullanıcı klinik gideri eklemek istiyorsa ("Elektrik faturası 850 TL gider ekle"), actionType = "ADD_EXPENSE" kullan.
8. Eğer kullanıcı başka bir sayfaya geçmek istiyorsa ("Borç sayfasına git", "Aylık görünüme geç"), actionType = "NAVIGATE_TAB" kullan.
9. Eğer kullanıcı sadece sayfadaki verilerle ilgili soru soruyorsa ("Bu ay kaç seans var?", "Ahmet Yılmaz'ın borcu ne kadar?"), actions dizisini boş bırak ve 'reply' içinde net, doğru, Türkçe yanıt ver.

KULLANICI KOMUTU: "${message}"`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: "Psikoloğa gösterilecek ve sesli okunacak kısa, net, nazik Türkçe yanıt ve yapılan işlemin özeti."
          },
          actions: {
            type: Type.ARRAY,
            description: "Uygulanacak işlemlerin listesi.",
            items: {
              type: Type.OBJECT,
              properties: {
                actionType: {
                  type: Type.STRING,
                  description: "UPDATE_SESSIONS | CREATE_SESSION | DELETE_SESSION | MARK_CLIENT_ALL_PAID | ADD_EXPENSE | NAVIGATE_TAB | OPEN_CLIENT_PROFILE"
                },
                sessionIds: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Güncellenecek veya silinecek seansların tam ID listesi."
                },
                clientName: {
                  type: Type.STRING,
                  description: "İlgili danışanın adı."
                },
                targetDate: {
                  type: Type.STRING,
                  description: "YYYY-MM-DD formatında hedef tarih."
                },
                applyToScope: {
                  type: Type.STRING,
                  description: "single | date | visible_period | all_unpaid | all"
                },
                updates: {
                  type: Type.OBJECT,
                  properties: {
                    price: { type: Type.NUMBER },
                    paymentStatus: { type: Type.STRING, description: "paid | unpaid | partial" },
                    paidAmount: { type: Type.NUMBER },
                    paymentMethod: { type: Type.STRING, description: "card | cash | transfer" },
                    type: { type: Type.STRING, description: "online | face-to-face | cancelled" },
                    hasBabysitterFee: { type: Type.BOOLEAN },
                    babysitterFeeAmount: { type: Type.NUMBER },
                    hasOfficeRentFee: { type: Type.BOOLEAN },
                    officeRentFeeAmount: { type: Type.NUMBER },
                    notes: { type: Type.STRING },
                    date: { type: Type.STRING },
                    time: { type: Type.STRING }
                  }
                },
                newSession: {
                  type: Type.OBJECT,
                  properties: {
                    clientName: { type: Type.STRING },
                    date: { type: Type.STRING },
                    time: { type: Type.STRING },
                    type: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    paymentStatus: { type: Type.STRING },
                    hasBabysitterFee: { type: Type.BOOLEAN },
                    babysitterFeeAmount: { type: Type.NUMBER },
                    hasOfficeRentFee: { type: Type.BOOLEAN },
                    officeRentFeeAmount: { type: Type.NUMBER },
                    notes: { type: Type.STRING }
                  }
                },
                newExpense: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    date: { type: Type.STRING }
                  }
                },
                tab: {
                  type: Type.STRING,
                  description: "agenda | stats | debts | clients | audit | search | sync | backup | rooms"
                },
                viewMode: {
                  type: Type.STRING,
                  description: "day | week | month"
                },
                date: {
                  type: Type.STRING
                }
              },
              required: ["actionType"]
            }
          }
        },
        required: ["reply", "actions"]
      };

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: systemPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema
          }
        });
      } catch (err1: any) {
        console.warn("gemini-3.8-flash failed for assistant, trying gemini-3.5-flash:", err1?.message);
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: systemPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema
          }
        });
      }

      const rawText = response.text || "{}";
      const parsed = JSON.parse(rawText);
      const aiActions = Array.isArray(parsed.actions) ? parsed.actions : [];

      if (aiActions.length === 0 && localFallback.actions.length > 0) {
        return res.json(localFallback);
      }

      return res.json({
        reply: parsed.reply || localFallback.reply || "İşleminiz tamamlandı.",
        actions: aiActions
      });
    } catch (error: any) {
      console.error("Assistant API error, falling back to local Turkish command parser:", error);
      return res.json(localFallback);
    }
  });

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
      // Append cache-buster query parameter to URL to prevent Google/provider edge caching
      const separator = normalizedUrl.includes('?') ? '&' : '?';
      const cacheBustedUrl = `${normalizedUrl}${separator}_cb=${Date.now()}`;

      const fetchResponse = await fetch(cacheBustedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 iCal/1.0",
          "Accept": "text/calendar, text/plain, application/octet-stream, */*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
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
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
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
