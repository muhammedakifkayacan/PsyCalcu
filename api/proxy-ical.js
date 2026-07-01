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

    console.log(`Vercel Proxy fetching calendar from: ${normalizedUrl}`);
    const fetchResponse = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "iCal/1.0 (Macintosh; Intel Mac OS X 10.15; compatible;)",
        "Accept": "text/calendar, text/plain, */*"
      }
    });

    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({ 
        error: `Takvim sunucusu hata döndürdü: ${fetchResponse.status} ${fetchResponse.statusText}` 
      });
    }

    const icsData = await fetchResponse.text();
    
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
