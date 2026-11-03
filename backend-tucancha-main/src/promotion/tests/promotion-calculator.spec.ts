import {
  calculatePromotionPricing,
  getDayOfWeek,
  generateTimeSlots,
  isNightSlot,
  isSlotInPromotionRange,
  timeToMinutes,
} from '../utils/promotion-calculator';
import { Promotion } from '../promotion.entity';

describe('PromotionCalculator (RN1 - RN11)', () => {
  const mockCourt = {
    id: 'court-cancha-1',
    name: 'Cancha Principal',
    priceDay: 20,    // S/ 20 por bloque de 30 min -> S/ 40 por hora día
    priceNight: 30,  // S/ 30 por bloque de 30 min -> S/ 60 por hora noche
  };

  const createMockPromo = (overrides: Partial<Promotion>): Promotion => {
    return {
      id: overrides.id || 'promo-1',
      name: overrides.name || 'Promo Horario Muerto',
      description: overrides.description || 'Descuento mañanas',
      type: overrides.type || ('happy_hour' as any),
      clubId: overrides.clubId || 'club-1',
      courtId: overrides.courtId !== undefined ? overrides.courtId : 'court-cancha-1',
      applyToAllCourts: overrides.applyToAllCourts ?? false,
      startTime: overrides.startTime || '10:00',
      endTime: overrides.endTime || '12:00',
      daysOfWeek: overrides.daysOfWeek || [1, 2, 3, 4, 5, 6, 0], // Todos los días
      discountPercentage: overrides.discountPercentage ?? 20, // 20%
      isActive: overrides.isActive ?? true,
      startDate: overrides.startDate,
      endDate: overrides.endDate,
      currentUses: overrides.currentUses || 0,
      createdAt: overrides.createdAt || new Date('2026-01-01'),
      updatedAt: overrides.updatedAt || new Date('2026-01-01'),
    } as Promotion;
  };

  describe('Helpers de Horarios y Fechas', () => {
    it('timeToMinutes convierte adecuadamente horas a minutos', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('10:00')).toBe(600);
      expect(timeToMinutes('18:30')).toBe(1110);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('generateTimeSlots genera bloques de 30 minutos según duración', () => {
      expect(generateTimeSlots('10:00', 1)).toEqual(['10:00', '10:30']);
      expect(generateTimeSlots('10:00', 1.5)).toEqual(['10:00', '10:30', '11:00']);
      expect(generateTimeSlots('22:00', 2)).toEqual(['22:00', '22:30', '23:00', '23:30']);
    });

    it('isNightSlot identifica correctamente turnos nocturnos (>= 18:00)', () => {
      expect(isNightSlot('17:30')).toBe(false);
      expect(isNightSlot('17:59')).toBe(false);
      expect(isNightSlot('18:00')).toBe(true);
      expect(isNightSlot('21:30')).toBe(true);
    });

    it('isSlotInPromotionRange evalúa intervalo semiabierto [start, end)', () => {
      // Franja 10:00 a 12:00
      expect(isSlotInPromotionRange('10:00', '10:00', '12:00')).toBe(true);
      expect(isSlotInPromotionRange('10:30', '10:00', '12:00')).toBe(true);
      expect(isSlotInPromotionRange('11:30', '10:00', '12:00')).toBe(true);
      expect(isSlotInPromotionRange('12:00', '10:00', '12:00')).toBe(false);
      expect(isSlotInPromotionRange('09:30', '10:00', '12:00')).toBe(false);
    });

    it('getDayOfWeek devuelve el día correcto sin desviaciones de zona horaria', () => {
      // 2026-11-02 fue Lunes (1)
      expect(getDayOfWeek('2026-11-02')).toBe(1);
      // 2026-11-03 fue Martes (2)
      expect(getDayOfWeek('2026-11-03')).toBe(2);
      // 2026-11-08 fue Domingo (0)
      expect(getDayOfWeek('2026-11-08')).toBe(0);
    });
  });

  describe('RN3: Promociones Diurnas y Nocturnas', () => {
    it('Caso A: Promoción diurna simple con 20% de descuento en 1 hora', () => {
      // Tarifa día = S/ 20 por bloque (2 bloques = S/ 40)
      const promo = createMockPromo({
        startTime: '10:00',
        endTime: '12:00',
        discountPercentage: 20,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02', // Lunes
        startTime: '10:00',
        duration: 1, // 2 bloques (10:00, 10:30)
        court: mockCourt,
        promotions: [promo],
      });

      expect(res.regularTotalPrice).toBe(40);
      expect(res.totalDiscount).toBe(8); // 20% de 40 = 8
      expect(res.finalTotalPrice).toBe(32);
      expect(res.hasPromotion).toBe(true);
      expect(res.appliedPromotions.length).toBe(1);
      expect(res.slotsDetail[0].finalPrice).toBe(16);
      expect(res.slotsDetail[1].finalPrice).toBe(16);
    });

    it('Caso B: Promoción nocturna simple con 20% de descuento en 1 hora', () => {
      // Tarifa noche = S/ 30 por bloque (2 bloques = S/ 60)
      const promo = createMockPromo({
        startTime: '20:00',
        endTime: '22:00',
        discountPercentage: 20,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '20:00',
        duration: 1, // 2 bloques (20:00, 20:30)
        court: mockCourt,
        promotions: [promo],
      });

      expect(res.regularTotalPrice).toBe(60);
      expect(res.totalDiscount).toBe(12); // 20% de 60 = 12
      expect(res.finalTotalPrice).toBe(48);
      expect(res.slotsDetail[0].isNight).toBe(true);
      expect(res.slotsDetail[0].finalPrice).toBe(24);
      expect(res.slotsDetail[1].finalPrice).toBe(24);
    });

    it('Cálculo exacto para cruce de día y noche (17:00 a 19:00)', () => {
      // Bloques: 17:00 (Día=20), 17:30 (Día=20), 18:00 (Noche=30), 18:30 (Noche=30)
      // Total regular = 20 + 20 + 30 + 30 = 100 soles
      // Promo 10% en toda esa franja (17:00 a 19:00)
      const promo = createMockPromo({
        startTime: '17:00',
        endTime: '19:00',
        discountPercentage: 10,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '17:00',
        duration: 2,
        court: mockCourt,
        promotions: [promo],
      });

      expect(res.regularTotalPrice).toBe(100);
      expect(res.totalDiscount).toBe(10); // 10% de 100 = 10
      expect(res.finalTotalPrice).toBe(90);
      expect(res.slotsDetail[0].isNight).toBe(false);
      expect(res.slotsDetail[0].finalPrice).toBe(18); // 20 - 2 = 18
      expect(res.slotsDetail[2].isNight).toBe(true);
      expect(res.slotsDetail[2].finalPrice).toBe(27); // 30 - 3 = 27
    });
  });

  describe('RN8: Reservas Parcialmente Promocionales', () => {
    it('aplica descuento solo a los bloques que caen dentro de la franja horaria', () => {
      // Promo activa de 10:00 a 11:00 (2 bloques)
      // Reserva de 10:00 a 12:00 (4 bloques: 10:00, 10:30, 11:00, 11:30)
      const promo = createMockPromo({
        startTime: '10:00',
        endTime: '11:00',
        discountPercentage: 50, // 50% de descuento
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 2,
        court: mockCourt,
        promotions: [promo],
      });

      // Bloque 10:00: base 20, desc 50% = 10, final = 10
      // Bloque 10:30: base 20, desc 50% = 10, final = 10
      // Bloque 11:00: base 20, sin promo, final = 20
      // Bloque 11:30: base 20, sin promo, final = 20
      expect(res.regularTotalPrice).toBe(80);
      expect(res.totalDiscount).toBe(20);
      expect(res.finalTotalPrice).toBe(60);
      expect(res.slotsDetail[0].finalPrice).toBe(10);
      expect(res.slotsDetail[1].finalPrice).toBe(10);
      expect(res.slotsDetail[2].finalPrice).toBe(20);
      expect(res.slotsDetail[3].finalPrice).toBe(20);
    });
  });

  describe('RN1 & RN5: Alcance de Canchas y Días Aplicables', () => {
    it('promoción de cancha específica solo aplica a esa cancha', () => {
      const promo = createMockPromo({
        courtId: 'court-cancha-1',
        applyToAllCourts: false,
        discountPercentage: 25,
      });

      // Cotizar para Cancha 1 -> Aplica
      const resCancha1 = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });
      expect(resCancha1.hasPromotion).toBe(true);
      expect(resCancha1.totalDiscount).toBe(10);

      // Cotizar para Cancha 2 -> NO aplica
      const resCancha2 = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: { ...mockCourt, id: 'court-cancha-2' },
        promotions: [promo],
      });
      expect(resCancha2.hasPromotion).toBe(false);
      expect(resCancha2.totalDiscount).toBe(0);
      expect(resCancha2.finalTotalPrice).toBe(40);
    });

    it('promoción global (applyToAllCourts = true) aplica a cualquier cancha del club', () => {
      const promoGlobal = createMockPromo({
        courtId: null,
        applyToAllCourts: true,
        discountPercentage: 15,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: { ...mockCourt, id: 'otra-cancha-distinta' },
        promotions: [promoGlobal],
      });
      expect(res.hasPromotion).toBe(true);
      expect(res.totalDiscount).toBe(6); // 15% de 40 = 6
    });

    it('respeta estrictamente los días de la semana configurados', () => {
      // Promo configurada SOLO para Lunes (1) y Miércoles (3)
      const promo = createMockPromo({
        daysOfWeek: [1, 3],
        discountPercentage: 20,
      });

      // Lunes 2026-11-02 -> Aplica
      const resLunes = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });
      expect(resLunes.hasPromotion).toBe(true);

      // Martes 2026-11-03 -> NO aplica
      const resMartes = calculatePromotionPricing({
        date: '2026-11-03',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });
      expect(resMartes.hasPromotion).toBe(false);
      expect(resMartes.totalDiscount).toBe(0);
    });

    it('respeta fechas de vigencia (startDate y endDate)', () => {
      const promo = createMockPromo({
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-15'),
        discountPercentage: 30,
      });

      // Fecha dentro del rango -> Aplica
      const resValido = calculatePromotionPricing({
        date: '2026-11-10',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });
      expect(resValido.hasPromotion).toBe(true);

      // Fecha posterior al rango -> NO aplica
      const resExpirado = calculatePromotionPricing({
        date: '2026-11-20',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });
      expect(resExpirado.hasPromotion).toBe(false);
    });

    it('promoción inactiva (isActive = false) nunca aplica', () => {
      const promoInactiva = createMockPromo({
        isActive: false,
        discountPercentage: 50,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promoInactiva],
      });
      expect(res.hasPromotion).toBe(false);
      expect(res.totalDiscount).toBe(0);
      expect(res.finalTotalPrice).toBe(40);
    });
  });

  describe('RN9: Resolución de Conflictos y Prioridades', () => {
    it('promoción específica de cancha tiene mayor prioridad que promoción global del club', () => {
      const promoGlobal = createMockPromo({
        id: 'promo-global',
        name: 'Promo Global 10%',
        applyToAllCourts: true,
        courtId: null,
        discountPercentage: 10,
      });

      const promoEspecifica = createMockPromo({
        id: 'promo-especifica',
        name: 'Promo Específica Cancha 1 20%',
        applyToAllCourts: false,
        courtId: 'court-cancha-1',
        discountPercentage: 20,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promoGlobal, promoEspecifica],
      });

      // Debe ganar la específica de cancha (20%)
      expect(res.appliedPromotions[0].id).toBe('promo-especifica');
      expect(res.totalDiscount).toBe(8); // 20% de 40 = 8
      expect(res.finalTotalPrice).toBe(32);
    });

    it('a igual nivel de especificidad, gana la que ofrezca mayor descuento al cliente', () => {
      const promoA = createMockPromo({
        id: 'promo-a',
        name: 'Promo 15%',
        discountPercentage: 15,
      });
      const promoB = createMockPromo({
        id: 'promo-b',
        name: 'Promo 25%',
        discountPercentage: 25,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promoA, promoB],
      });

      expect(res.appliedPromotions[0].id).toBe('promo-b');
      expect(res.totalDiscount).toBe(10); // 25% de 40 = 10
      expect(res.finalTotalPrice).toBe(30);
    });
  });

  describe('RN4 & Casos Límite: Redondeo Monetario y Protección', () => {
    it('redondea correctamente decimales periódicos sin acumular errores', () => {
      // 33.33% de S/ 20 = 6.666 -> redondea a S/ 6.67 por bloque
      // 2 bloques = 2 * (20 - 6.67) = 2 * 13.33 = S/ 26.66 final
      const promo = createMockPromo({
        discountPercentage: 33.33,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo],
      });

      expect(res.regularTotalPrice).toBe(40);
      expect(res.slotsDetail[0].discount).toBe(6.67);
      expect(res.slotsDetail[0].finalPrice).toBe(13.33);
      expect(res.finalTotalPrice).toBe(26.66);
      expect(res.totalDiscount).toBe(13.34);
    });

    it('promoción con 100% de descuento deja el total en S/ 0 sin generar números negativos', () => {
      const promo100 = createMockPromo({
        discountPercentage: 100,
      });

      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [promo100],
      });

      expect(res.regularTotalPrice).toBe(40);
      expect(res.totalDiscount).toBe(40);
      expect(res.finalTotalPrice).toBe(0);
      expect(res.hasPromotion).toBe(true);
    });

    it('cuando no hay promociones disponibles o lista vacía, conserva precio base íntegro', () => {
      const res = calculatePromotionPricing({
        date: '2026-11-02',
        startTime: '10:00',
        duration: 1,
        court: mockCourt,
        promotions: [],
      });

      expect(res.regularTotalPrice).toBe(40);
      expect(res.finalTotalPrice).toBe(40);
      expect(res.totalDiscount).toBe(0);
      expect(res.hasPromotion).toBe(false);
      expect(res.appliedPromotions).toEqual([]);
    });
  });
});
