import { calculateCouponDiscount } from '../utils/discount-calculator';
import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';

describe('DiscountCalculator (RN1)', () => {
  describe('FIXED_DISCOUNT', () => {
    it('debe aplicar descuento fijo regular cuando es menor al total base', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: 25,
        courtPriceDay: 30,
        basePrice: 100,
      });
      expect(res.discountAmount).toBe(25);
      expect(res.netPrice).toBe(75);
      expect(res.originalPrice).toBe(100);
    });

    it('debe topar el descuento al total base si el descuento fijo es mayor que la reserva', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: 80,
        courtPriceDay: 30,
        basePrice: 50,
      });
      expect(res.discountAmount).toBe(50);
      expect(res.netPrice).toBe(0);
      expect(res.originalPrice).toBe(50);
    });

    it('debe redondear adecuadamente a 2 decimales', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: 33.33,
        courtPriceDay: 30,
        basePrice: 99.90,
      });
      expect(res.discountAmount).toBe(33.33);
      expect(res.netPrice).toBe(66.57);
    });
  });

  describe('PERCENT_DISCOUNT', () => {
    it('debe calcular porcentaje simple sin tope', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValue: 20,
        courtPriceDay: 30,
        basePrice: 100,
      });
      expect(res.discountAmount).toBe(20);
      expect(res.netPrice).toBe(80);
    });

    it('debe aplicar el tope maxDiscountAmount cuando el porcentaje lo excede', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValue: 50,
        maxDiscountAmount: 30,
        courtPriceDay: 30,
        basePrice: 150, // 50% de 150 = 75, topado a 30
      });
      expect(res.discountAmount).toBe(30);
      expect(res.netPrice).toBe(120);
    });

    it('no debe topar si el porcentaje calculado es menor al maxDiscountAmount', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValue: 10,
        maxDiscountAmount: 50,
        courtPriceDay: 30,
        basePrice: 200, // 10% de 200 = 20 < 50
      });
      expect(res.discountAmount).toBe(20);
      expect(res.netPrice).toBe(180);
    });

    it('debe permitir 100% de descuento dejando el neto en S/ 0', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.PERCENT_DISCOUNT,
        discountValue: 100,
        courtPriceDay: 30,
        basePrice: 85,
      });
      expect(res.discountAmount).toBe(85);
      expect(res.netPrice).toBe(0);
    });
  });

  describe('FREE_HOUR', () => {
    it('debe descontar exactamente 1 hora a tarifa día (2 bloques * courtPriceDay)', () => {
      // 1 bloque día = 25 soles -> 1 hora día = 50 soles
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FREE_HOUR,
        courtPriceDay: 25,
        basePrice: 50, // Reserva de 1 hora día
      });
      expect(res.discountAmount).toBe(50);
      expect(res.netPrice).toBe(0);
    });

    it('en reserva de noche debe descontar 1 hora a tarifa día y cobrar la diferencia nocturna', () => {
      // Cancha día = 30 por bloque (1 hr = 60). Reserva noche = 45 por bloque (1 hr = 90)
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FREE_HOUR,
        courtPriceDay: 30,
        basePrice: 90,
      });
      expect(res.discountAmount).toBe(60);
      expect(res.netPrice).toBe(30); // El cliente paga los S/ 30 de diferencia
    });

    it('en reserva mayor a 1 hora debe descontar el valor de 1 hora', () => {
      // Cancha día = 25 (1 hr = 50). Reserva 2 horas día = 100
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FREE_HOUR,
        courtPriceDay: 25,
        basePrice: 100,
      });
      expect(res.discountAmount).toBe(50);
      expect(res.netPrice).toBe(50);
    });

    it('en reserva menor a 1 hora (ej. 30 min) el descuento no debe superar el total de la reserva', () => {
      // Cancha día = 30 (1 hr = 60). Reserva de 30 min día = 30
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FREE_HOUR,
        courtPriceDay: 30,
        basePrice: 30,
      });
      expect(res.discountAmount).toBe(30);
      expect(res.netPrice).toBe(0);
    });
  });

  describe('TEXT_ONLY y Casos Límite', () => {
    it('premios TEXT_ONLY no descuentan nada', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.TEXT_ONLY,
        courtPriceDay: 35,
        basePrice: 120,
      });
      expect(res.discountAmount).toBe(0);
      expect(res.netPrice).toBe(120);
    });

    it('basePrice 0 retorna 0 en todos los campos', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: 50,
        courtPriceDay: 25,
        basePrice: 0,
      });
      expect(res.discountAmount).toBe(0);
      expect(res.netPrice).toBe(0);
      expect(res.originalPrice).toBe(0);
    });

    it('valores negativos o nulos se manejan de forma segura', () => {
      const res = calculateCouponDiscount({
        rewardType: LoyaltyRewardType.FIXED_DISCOUNT,
        discountValue: -20,
        courtPriceDay: 0,
        basePrice: 60,
      });
      expect(res.discountAmount).toBe(0);
      expect(res.netPrice).toBe(60);
    });
  });
});
