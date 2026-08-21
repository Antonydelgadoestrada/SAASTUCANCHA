export type FeaturedCourtDto = {
  id: string | number;
  name: string;
  images: string[];
  priceDay: number;
  priceNight: number;
  promoDay: number | null;
  promoNight: number | null;
  rating?: number | null;
  reviews?: number | null;
  venue?: {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
    yapeNumero?: string;
    yapeQrUrl?: string;
    plinNumero?: string;
    plinQrUrl?: string;
    aceptaMercadopago?: boolean;
    porcentajeAdelantoDefault?: number;
    adelantoMinimo?: number | null;
    clubId?: string;
  };
  time: string;
};