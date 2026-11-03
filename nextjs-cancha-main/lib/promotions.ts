import api from "./axios";

export interface Promotion {
  id: number;
  name: string;
  description?: string | null;
  discountPercentage: number;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  applyToAllCourts: boolean;
  courtId?: number | null;
  clubId: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  court?: {
    id: number;
    name: string;
    sport?: string;
    type?: string;
    priceDay?: number;
    priceNight?: number;
  } | null;
}

export interface CreatePromotionDto {
  name: string;
  description?: string;
  discountPercentage: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  daysOfWeek: number[]; // [0, 1, 2, 3, 4, 5, 6] (0 = Sunday)
  applyToAllCourts?: boolean;
  courtId?: number | null;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface UpdatePromotionDto {
  name?: string;
  description?: string;
  discountPercentage?: number;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  applyToAllCourts?: boolean;
  courtId?: number | null;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface SlotPriceSummary {
  time: string;
  originalPrice: number;
  promotionalPrice: number;
  discount: number;
  isNight: boolean;
  hasPromotion: boolean;
}

export interface CalculatePromotionPriceResult {
  hasPromotion: boolean;
  totalOriginalPrice: number;
  totalPromotionalPrice: number;
  totalDiscount: number;
  appliedPromotionId: number | null;
  appliedPromotionName: string | null;
  appliedDiscountPercentage: number;
  slotsSummary: SlotPriceSummary[];
}

export interface CalculatePromotionPriceDto {
  courtId: number;
  date: string; // "YYYY-MM-DD"
  slots: string[];
}

/**
 * Obtener todas las promociones del club autenticado
 */
export async function getClubPromotions(): Promise<Promotion[]> {
  const response = await api.get("/promotions");
  return response.data;
}

/**
 * Obtener promociones activas para una cancha específica
 */
export async function getCourtPromotions(courtId: number): Promise<Promotion[]> {
  const response = await api.get(`/promotions/court/${courtId}`);
  return response.data;
}

/**
 * Obtener una promoción por su ID
 */
export async function getPromotionById(id: number): Promise<Promotion> {
  const response = await api.get(`/promotions/${id}`);
  return response.data;
}

/**
 * Crear una nueva promoción para el club
 */
export async function createPromotion(data: CreatePromotionDto): Promise<Promotion> {
  const response = await api.post("/promotions", data);
  return response.data;
}

/**
 * Actualizar una promoción existente
 */
export async function updatePromotion(id: number, data: UpdatePromotionDto): Promise<Promotion> {
  const response = await api.put(`/promotions/${id}`, data);
  return response.data;
}

/**
 * Alternar estado activo / inactivo de una promoción
 */
export async function togglePromotion(id: number): Promise<Promotion> {
  const response = await api.patch(`/promotions/${id}/toggle`);
  return response.data;
}

/**
 * Eliminar una promoción
 */
export async function deletePromotion(id: number): Promise<void> {
  await api.delete(`/promotions/${id}`);
}

/**
 * Calcular en el backend el precio con descuento promocional para una cancha, fecha y turnos
 */
export async function calculatePromotionPrice(
  data: CalculatePromotionPriceDto
): Promise<CalculatePromotionPriceResult> {
  const response = await api.post("/promotions/calculate-price", data);
  return response.data;
}
