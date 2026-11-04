import { LoyaltyRewardType } from '../enums/loyalty-reward-type.enum';

export interface CalculateDiscountParams {
  rewardType: LoyaltyRewardType;
  discountValue?: number | null;
  maxDiscountAmount?: number | null;
  courtPriceDay: number; // Tarifa por bloque de 30 minutos a precio de día
  basePrice: number; // Precio total base antes del descuento
}

export interface CalculateDiscountResult {
  discountAmount: number;
  netPrice: number;
  originalPrice: number;
}

/**
 * Función pura y aislada para calcular el descuento de un cupón de fidelidad (RN1).
 * Reglas:
 * - FIXED_DISCOUNT: Descuenta monto en soles (<= total base).
 * - PERCENT_DISCOUNT: Descuenta porcentaje (1 a 100), con tope opcional maxDiscountAmount.
 * - FREE_HOUR: Descuenta el valor de 1 hora a tarifa de día (2 bloques * courtPriceDay).
 * - TEXT_ONLY: Descuento 0.
 * - El descuento nunca supera el total base y el neto nunca es negativo.
 * - Todos los valores se redondean estrictamente a 2 decimales.
 */
export function calculateCouponDiscount(params: CalculateDiscountParams): CalculateDiscountResult {
  const base = Math.max(0, Number(Number(params.basePrice || 0).toFixed(2)));
  if (base === 0) {
    return { discountAmount: 0, netPrice: 0, originalPrice: 0 };
  }

  let calculatedDiscount = 0;

  switch (params.rewardType) {
    case LoyaltyRewardType.FIXED_DISCOUNT: {
      const fixedVal = Math.max(0, Number(params.discountValue || 0));
      calculatedDiscount = fixedVal;
      break;
    }

    case LoyaltyRewardType.PERCENT_DISCOUNT: {
      const pct = Math.min(100, Math.max(0, Number(params.discountValue || 0)));
      calculatedDiscount = (base * pct) / 100;
      if (params.maxDiscountAmount && Number(params.maxDiscountAmount) > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, Number(params.maxDiscountAmount));
      }
      break;
    }

    case LoyaltyRewardType.FREE_HOUR: {
      // 1 hora a tarifa de día = 2 bloques de 30 min x precio bloque de día
      const slotPriceDay = Math.max(0, Number(params.courtPriceDay || 0));
      calculatedDiscount = slotPriceDay * 2;
      break;
    }

    case LoyaltyRewardType.TEXT_ONLY:
    default: {
      calculatedDiscount = 0;
      break;
    }
  }

  const effectiveDiscount = Math.min(calculatedDiscount, base);
  const netPrice = Math.max(0, Number((base - effectiveDiscount).toFixed(2)));
  const finalDiscount = Number((base - netPrice).toFixed(2));

  return {
    discountAmount: finalDiscount,
    netPrice,
    originalPrice: base,
  };
}
