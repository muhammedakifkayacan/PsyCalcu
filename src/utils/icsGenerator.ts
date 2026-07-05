import { Session } from '../types';

/**
 * Generates an iCalendar (.ics) file for a given session and triggers the browser download.
 * Compatible with Apple Calendar, Google Calendar, Outlook, and mobile calendar applications.
 */
export function downloadSessionAsICS(session: Session) {
  const pad = (num: number) => String(num).padStart(2, '0');

  // Parse session date and time
  const [year, month, day] = session.date.split('-').map(Number);
  const [hour, min] = session.time.split(':').map(Number);

  // Calculate start and end times
  const startDate = new Date(year, month - 1, day, hour, min, 0);
  const endDate = new Date(startDate.getTime() + session.duration * 60000);

  // Format date to iCalendar format (floating timezone YYYYMMDDTHHMMSS)
  const formatICSDate = (date: Date) => {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  };

  const dtStart = formatICSDate(startDate);
  const dtEnd = formatICSDate(endDate);
  const dtStamp = formatICSDate(new Date());

  // Define details
  const typeText = session.type === 'online' ? 'Online' : session.type === 'face-to-face' ? 'Yüz Yüze' : 'İptal';
  const summary = `Seans: ${session.clientName} (${typeText})`;
  const location = session.type === 'online' ? 'Online Görüntülü Görüşme' : session.type === 'face-to-face' ? 'Terapi Ofisi' : 'İptal Edildi';
  
  // Format description
  const descriptionLines = [
    `Danışan: ${session.clientName}`,
    `Seans Tipi: ${typeText}`,
    `Süre: ${session.duration} dakika`,
    session.notes ? `Notlar: ${session.notes}` : '',
    `Fiyat: ₺${session.price}`,
    `Durum: ${session.paymentStatus === 'paid' ? 'Ödendi' : 'Ödenmedi'}`
  ].filter(Boolean);

  const description = descriptionLines.join('\\n');

  // Construct iCalendar contents
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PsyCalcu//Seans Takvimi//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${session.id}@psycalcu.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');

  // Create Blob and trigger download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  // Safe filename, replacing Turkish characters and spaces
  const safeClientName = session.clientName
    .replace(/I/g, 'i').replace(/İ/g, 'i')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u').replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g').replace(/ç/g, 'c').replace(/Ç/g, 'c')
    .replace(/\s+/g, '_');
    
  link.href = url;
  link.setAttribute('download', `${safeClientName}_Seans_${session.date}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
