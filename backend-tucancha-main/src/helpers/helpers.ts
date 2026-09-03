import { toZonedTime } from 'date-fns-tz';
import { getHours } from 'date-fns';


export const isNight = (timeStr?: string): boolean => {
  if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
    const [h] = timeStr.split(':').map(Number);
    if (!isNaN(h)) {
      return h >= 18; // Noche a partir de las 18:00 (6:00 PM)
    }
  }
  const currentHourInLima = getHours(toZonedTime(new Date(), 'America/Lima'));
  return currentHourInLima >= 18;
};