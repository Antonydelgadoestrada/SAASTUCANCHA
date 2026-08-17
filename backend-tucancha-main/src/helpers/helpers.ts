import { toZonedTime } from 'date-fns-tz';
import { getHours } from 'date-fns';


 export const isNight = ()=>{
    const currentHourInLima = getHours(toZonedTime(new Date(), 'America/Lima'));
    return currentHourInLima>= 18;
}