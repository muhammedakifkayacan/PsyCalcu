// This file is used as a Serverless Function on Vercel deployment.
// Vercel hosts the app as a static frontend and doesn't run our custom server.ts,
// so we provide this serverless handler to proxy the iCal fetch requests.

export default async function handler(req, res) {
  // Add CORS headers so frontend can use it if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let calendarUrl = req.query.url;
  if (!calendarUrl) {
    return res.status(400).json({ error: "Lütfen geçerli bir takvim URL'si belirtin." });
  }

  if (Array.isArray(calendarUrl)) {
    calendarUrl = calendarUrl[0];
  }

  try {
    // Trim leading/trailing whitespaces and quotes
    calendarUrl = calendarUrl.trim().replace(/^["']|["']$/g, '');

    let normalizedUrl = calendarUrl;
    if (normalizedUrl.startsWith("webcal://")) {
      normalizedUrl = "https://" + normalizedUrl.substring(9);
    } else if (normalizedUrl.startsWith("webcal:")) {
      normalizedUrl = "https:" + normalizedUrl.substring(7);
    } else if (normalizedUrl.startsWith("http://")) {
      normalizedUrl = "https://" + normalizedUrl.substring(7);
    }

    // Safe decode in case of double encoding
    try {
      normalizedUrl = decodeURIComponent(normalizedUrl);
    } catch (e) {}

    // Check for common Google Calendar URL misconfigurations
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

      // Convert @ to %40 for Google Calendar path routing
      normalizedUrl = normalizedUrl.replace(/@/g, "%40");
    } else {
      try {
        normalizedUrl = encodeURI(normalizedUrl);
      } catch (urlErr) {
        console.error("URL encoding error:", urlErr);
      }
    }

    console.log(`Vercel Proxy fetching calendar from: ${normalizedUrl}`);
    const fetchResponse = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 iCal/1.0",
        "Accept": "text/calendar, text/plain, application/octet-stream, */*"
      }
    });

    if (!fetchResponse.ok) {
      if (fetchResponse.status === 404) {
        return res.status(404).json({
          error: "Takvim bulunamadı (404 Not Found). Google Takvim kullanıyorsanız 'Genel adres' yerine 'iCal biçimindeki GİZLİ ADRES' bağlantısını kopyaladığınızdan ve adresin eksiksiz olduğundan emin olun."
        });
      } else if (fetchResponse.status === 403 || fetchResponse.status === 401) {
        return res.status(fetchResponse.status).json({
          error: `Takvim erişim yetkisi reddedildi (${fetchResponse.status}). Google Takvim'de 'iCal biçimindeki gizli adres'i kullandığınızdan veya takvimin erişilebilir olduğundan emin olun.`
        });
      }
      return res.status(fetchResponse.status).json({ 
        error: `Takvim sunucusu hata döndürdü: ${fetchResponse.status} ${fetchResponse.statusText}` 
      });
    }

    const icsData = await fetchResponse.text();
    const trimmed = icsData.trim();
    const isHtml = trimmed.startsWith("<html") || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<HTML");
    const hasCalendarHeaders = trimmed.toUpperCase().includes("BEGIN:VCALENDAR") || trimmed.toUpperCase().includes("BEGIN:VEVENT");

    if (isHtml && !hasCalendarHeaders) {
      return res.status(400).json({
        error: "Takvim sunucusu takvim dosyası yerine bir web sayfası (HTML) döndürdü. Lütfen Google Takvim 'Takvimi Entegre Et' bölümündeki 'iCal biçimindeki gizli adres' bağlantısını kullandığınızdan emin olun."
      });
    }

    // Return standard iCal header
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    return res.status(200).send(icsData);
  } catch (error) {
    console.error("Vercel Proxy error:", error);
    return res.status(500).json({ 
      error: "Takvim verisi çekilirken bir hata oluştu: " + (error.message || error) 
    });
  }
}

