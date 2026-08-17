// mercado-pago.service.ts
import { Injectable } from '@nestjs/common';

import { MercadoPagoConfig, Order } from "mercadopago";


@Injectable()
export class MercadoPagoService {
  private client;
  private order;
  constructor() {
   this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
    });
    this.order =  new Order(this.client);
  }

  async createPreference(booking: {
    id: string;
    title: string;
    description: string;
    quantity: number;
    unit_price: number;
  }) {
    const preference = {
      items: [
        {
          title: booking.title,
          description: booking.description,
          quantity: booking.quantity,
          unit_price: booking.unit_price,
          currency_id: 'PEN',
        },
      ],
      external_reference: booking.id,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/payment/success`,
        failure: `${process.env.FRONTEND_URL}/payment/failure`,
        pending: `${process.env.FRONTEND_URL}/payment/pending`,
      },
      auto_return: 'approved',
    };

    const response = await this.order.create(preference);
    return response.body;
  }
}
