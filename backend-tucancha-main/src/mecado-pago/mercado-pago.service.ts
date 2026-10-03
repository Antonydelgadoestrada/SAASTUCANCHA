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
    payerEmail?: string;
  }) {
    const webUrl = (process.env.WEB_SERVICES_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.vercel.app' : 'http://localhost:3000')).replace(/\/+$/, '');
    const servicesUrl = (process.env.SERVICES_URL || process.env.RENDER_EXTERNAL_URL || (process.env.NODE_ENV === 'production' ? 'https://saastucancha.onrender.com' : 'http://localhost:3001')).replace(/\/+$/, '');

    const isSandbox = (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-') || process.env.MP_SANDBOX === 'true';
    const testPayerEmail = process.env.MP_TEST_PAYER_EMAIL || (booking.payerEmail && booking.payerEmail.includes('testuser.com') ? booking.payerEmail : 'test_user_123@testuser.com');
    const payerEmail = isSandbox ? testPayerEmail : (booking.payerEmail || testPayerEmail);

    const preference = {
      items: [
        {
          id: String(booking.id),
          title: booking.title,
          description: booking.description,
          quantity: Number(booking.quantity || 1),
          unit_price: Number(Number(booking.unit_price).toFixed(2)),
          currency_id: 'PEN',
        },
      ],
      payer: {
        email: payerEmail,
      },
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
    const init_point = (isSandbox && response.sandbox_init_point) ? response.sandbox_init_point : response.init_point;

    return {
      id: response.id,
      init_point,
    };
  }
}

