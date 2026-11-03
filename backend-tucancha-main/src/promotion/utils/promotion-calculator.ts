import { Promotion } from '../promotion.entity';

export interface CourtPricingContext {
  id: string;
  name?: string;
  priceDay: number;
  priceNight?: number | null;
  promoDay?: number | null;
  promoNight?: number | null;
}

export interface SlotCalculationDetail {
  time: string;
  isNight: boolean;
  basePrice: number;
  finalPrice: number;
  discount: number;
  appliedPromotion: {
    id: string;
    name: string;
    discountPercentage: number;
  } | null;
}

export interface CalculatePromotionInput {
  date: Date | string;
  startTime: string;
  duration: number; // En horas, ej. 1, 1.5, 2
  court: CourtPricingContext;
  promotions: Promotion[];
}

export interface PromotionCalculationResult {
  regularTotalPrice: number;
  finalTotalPrice: number;
  totalDiscount: number;
  hasPromotion: boolean;
  appliedPromotions: Array<{
    id: string;
    name: string;
    discountPercentage: number;
  }>;
  slotsDetail: SlotCalculationDetail[];
}

/**
 * Convierte cadena "HH:mm" a minutos transcurridos desde medianoche (0..1439).
 * Maneja casos especiales como "24:00" o fin de jornada.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hStr, mStr] = timeStr.trim().split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Convierte minutos a string "HH:mm".
 */
export function minutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60).toString().padStart(2, '0');
  const m = (norm % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Extrae el día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado) de forma determinista
 * sin sufrir desfases por zonas horarias.
 */
export function getDayOfWeek(dateInput: Date | string): number {
  if (typeof dateInput === 'string') {
    const cleanDate = dateInput.substring(0, 10);
    const parts = cleanDate.split('-').map(Number);
    if (parts.length === 3) {
      const [year, month, day] = parts;
      // Usar UTC con mediodía para evitar cualquier salto de día
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    }
  }
  const d = new Date(dateInput);
  return d.getDay();
}

/**
 * Genera el arreglo de tiempos por bloque de 30 minutos.
 * Ej. "10:00", 1.5 horas -> ["10:00", "10:30", "11:00"]
 */
export function generateTimeSlots(startTime: string, durationHours: number): string[] {
  const slotCount = Math.max(1, Math.round(Number(durationHours || 1) * 2));
  const startMins = timeToMinutes(startTime);
  const slots: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    slots.push(minutesToTime(startMins + i * 30));
  }
  return slots;
}

/**
 * Evalúa si un horario específico corresponde a tarifa nocturna (>= 18:00).
 */
export function isNightSlot(slotTime: string): boolean {
  const mins = timeToMinutes(slotTime);
  return mins >= 18 * 60; // 18:00 = 1080 minutos
}

/**
 * Verifica si un bloque de tiempo "slotTime" cae dentro del rango de una promoción.
 * El rango de la promoción se evalúa como intervalo semi-abierto [startTime, endTime),
 * salvo cuando endTime es "23:59" o "00:00" que cubre hasta el final de la noche.
 */
export function isSlotInPromotionRange(slotTime: string, promoStartTime: string, promoEndTime: string): boolean {
  const slotMins = timeToMinutes(slotTime);
  const startMins = timeToMinutes(promoStartTime);
  let endMins = timeToMinutes(promoEndTime);

  // Si endTime es "00:00" y startTime > 0, significa fin de la noche (24:00 = 1440)
  if (endMins === 0 && startMins > 0) {
    endMins = 1440;
  } else if (promoEndTime === '23:59') {
    endMins = 1440;
  }

  return slotMins >= startMins && slotMins < endMins;
}

/**
 * Comprueba si una promoción es elegible para una fecha, día de la semana y cancha específicos.
 */
export function isPromotionEligible(
  promo: Promotion,
  dateStr: string,
  dayOfWeek: number,
  courtId: string,
): boolean {
  if (!promo.isActive) return false;

  // 1. Validación de Cancha
  const appliesToCourt =
    promo.applyToAllCourts === true ||
    promo.courtId === courtId ||
    promo.court?.id === courtId ||
    !promo.courtId; // Si no tiene courtId y no se especificó, asume global

  if (!appliesToCourt) return false;

  // 2. Validación de Día de la Semana
  if (Array.isArray(promo.daysOfWeek) && promo.daysOfWeek.length > 0) {
    if (!promo.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  // 3. Validación de Vigencia por Fecha
  const targetDateOnly = dateStr.substring(0, 10);
  if (promo.startDate) {
    const promoStartStr =
      typeof promo.startDate === 'string'
        ? (promo.startDate as string).substring(0, 10)
        : promo.startDate.toISOString().substring(0, 10);
    if (targetDateOnly < promoStartStr) return false;
  }

  if (promo.endDate) {
    const promoEndStr =
      typeof promo.endDate === 'string'
        ? (promo.endDate as string).substring(0, 10)
        : promo.endDate.toISOString().substring(0, 10);
    if (targetDateOnly > promoEndStr) return false;
  }

  // 4. Validación de Descuento Positivo
  const pct = Number(promo.discountPercentage || 0);
  if (pct <= 0 || pct > 100) return false;

  return true;
}

/**
 * Resuelve conflictos de promociones concurrentes para un mismo bloque (RN9).
 * Criterio de Precedencia:
 * 1. Promoción específica para la cancha (applyToAllCourts === false) prevalece sobre global.
 * 2. Mayor porcentaje de descuento.
 * 3. Fecha de actualización más reciente.
 */
export function resolveBestPromotion(candidatePromos: Promotion[]): Promotion | null {
  if (!candidatePromos || candidatePromos.length === 0) return null;
  if (candidatePromos.length === 1) return candidatePromos[0];

  return candidatePromos.reduce((best, current) => {
    // 1. Especificidad de cancha
    const bestIsSpecific = !best.applyToAllCourts && !!best.courtId;
    const currentIsSpecific = !current.applyToAllCourts && !!current.courtId;

    if (currentIsSpecific && !bestIsSpecific) return current;
    if (!currentIsSpecific && bestIsSpecific) return best;

    // 2. Mayor porcentaje
    const currentPct = Number(current.discountPercentage || 0);
    const bestPct = Number(best.discountPercentage || 0);
    if (currentPct > bestPct) return current;
    if (bestPct > currentPct) return best;

    // 3. Más reciente
    const currentUpdated = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    const bestUpdated = best.updatedAt ? new Date(best.updatedAt).getTime() : 0;
    return currentUpdated > bestUpdated ? current : best;
  });
}

/**
 * MOTOR PRINCIPAL DE CÁLCULO DE PROMOCIONES POR BLOQUE (RN1 - RN11)
 * Función pura sin I/O, determinista y testeable.
 */
export function calculatePromotionPricing(input: CalculatePromotionInput): PromotionCalculationResult {
  const { date, startTime, duration, court, promotions = [] } = input;
  const slots = generateTimeSlots(startTime, duration);
  const dayOfWeek = getDayOfWeek(date);
  const dateStr = typeof date === 'string' ? date : date.toISOString();

  // Filtrar promociones activas y elegibles para la fecha, día y cancha
  const eligiblePromotions = promotions.filter((p) =>
    isPromotionEligible(p, dateStr, dayOfWeek, court.id),
  );

  const slotsDetail: SlotCalculationDetail[] = [];
  const appliedPromotionsMap = new Map<string, { id: string; name: string; discountPercentage: number }>();

  let regularSum = 0;
  let finalSum = 0;

  for (const slotTime of slots) {
    const isNight = isNightSlot(slotTime);
    // Base regular por bloque de 30 minutos
    const regularSlotPrice = Number(
      isNight ? (court.priceNight ?? court.priceDay) : court.priceDay,
    ) || 0;

    // Buscar promociones que cubran esta hora específica
    const matchingPromos = eligiblePromotions.filter((p) =>
      isSlotInPromotionRange(slotTime, p.startTime, p.endTime),
    );

    const winningPromo = resolveBestPromotion(matchingPromos);

    let slotDiscount = 0;
    let slotFinalPrice = regularSlotPrice;
    let appliedPromoInfo: { id: string; name: string; discountPercentage: number } | null = null;

    if (winningPromo) {
      const pct = Number(winningPromo.discountPercentage || 0);
      const rawDiscount = (regularSlotPrice * pct) / 100;
      slotDiscount = Math.round(rawDiscount * 100) / 100;
      slotFinalPrice = Math.max(0, Math.round((regularSlotPrice - slotDiscount) * 100) / 100);

      appliedPromoInfo = {
        id: winningPromo.id,
        name: winningPromo.name,
        discountPercentage: pct,
      };

      if (!appliedPromotionsMap.has(winningPromo.id)) {
        appliedPromotionsMap.set(winningPromo.id, appliedPromoInfo);
      }
    }

    regularSum += regularSlotPrice;
    finalSum += slotFinalPrice;

    slotsDetail.push({
      time: slotTime,
      isNight,
      basePrice: Number(regularSlotPrice.toFixed(2)),
      finalPrice: Number(slotFinalPrice.toFixed(2)),
      discount: Number(slotDiscount.toFixed(2)),
      appliedPromotion: appliedPromoInfo,
    });
  }

  const regularTotalPrice = Number(regularSum.toFixed(2));
  const finalTotalPrice = Number(finalSum.toFixed(2));
  const totalDiscount = Math.max(0, Number((regularTotalPrice - finalTotalPrice).toFixed(2)));

  return {
    regularTotalPrice,
    finalTotalPrice,
    totalDiscount,
    hasPromotion: totalDiscount > 0,
    appliedPromotions: Array.from(appliedPromotionsMap.values()),
    slotsDetail,
  };
}
