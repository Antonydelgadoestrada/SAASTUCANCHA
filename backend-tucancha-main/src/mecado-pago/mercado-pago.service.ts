// mercado-pago.service.ts
import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Preference } from "mercadopago";

@Injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private preference: Preference;

  constructor() {
    const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
    });
    this.preference = new Preference(this.client);
  }

  async createPreference(booking: {
    id: string;
    title: string;
    description: string;
    quantity: number;
    unit_price: number;
  }) {
    const webUrl = (process.env.WEB_SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://tucancha.com.pe' : 'http://localhost:3000')).replace(/\/+$/, '');
    const servicesUrl = (process.env.SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://api.tucancha.com.pe' : 'http://localhost:3001')).replace(/\/+$/, '');

    const preference = {
      items: [
        {
          id: booking.id,
          title: booking.title,
          description: booking.description,
          quantity: booking.quantity,
          unit_price: booking.unit_price,
          currency_id: 'PEN',
        },
      ],
      external_reference: booking.id,
      notification_url: `${servicesUrl}/payments/webhook`,
      back_urls: {
        success: `${webUrl}/user/payments/success`,
        failure: `${webUrl}/user/payments/failure`,
        pending: `${webUrl}/user/payments/pending`,
      },
      auto_return: 'approved',
    };

    const response = await this.preference.create({ body: preference });
    return {
      id: response.id,
      init_point: response.init_point,
    };
  }
}

