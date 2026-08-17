import { MercadoPagoConfig } from "mercadopago";
// Solo para tu cuenta principal (tú como dueño del SaaS)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '', // Tu access_token
  options: { timeout: 5000 }
})

export default client
