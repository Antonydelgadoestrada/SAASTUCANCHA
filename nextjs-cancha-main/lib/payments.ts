import api from "./axios"

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export type PaymentMethodEnum =
  | "MERCADOPAGO"
  | "YAPE"
  | "PLIN"
  | "TRANSFERENCIA"
  | "EFECTIVO"

export type PaymentTypeEnum = "ADELANTO" | "SALDO" | "PAGO_COMPLETO"
export type PaymentStatusEnum =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "RECHAZADO"
  | "PAID"

export interface ClubPaymentConfig {
  aceptaMercadopago: boolean
  whatsapp?: string | null
  yapeNumero?: string | null
  yapeQrUrl?: string | null
  plinNumero?: string | null
  plinQrUrl?: string | null
  porcentajeAdelantoDefault: number
  adelantoMinimo?: number | null
}

export function formatWhatsAppNumber(phone?: string | null): string {
  if (!phone) return ""
  let clean = phone.replace(/[^\d]/g, "")
  if (clean.length === 9 && clean.startsWith("9")) {
    clean = `51${clean}`
  }
  return clean
}

export function getWhatsAppLink(phone?: string | null, message?: string): string {
  const cleanNumber = formatWhatsAppNumber(phone)
  if (!cleanNumber) return "#"
  const base = `https://wa.me/${cleanNumber}`
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`
  }
  return base
}

export interface PaymentItem {
  id: string
  amount: number
  method: PaymentMethodEnum
  type: PaymentTypeEnum
  status: PaymentStatusEnum
  comprobanteUrl?: string | null
  motivoRechazo?: string | null
  createdAt: string
  fechaConfirmacion?: string | null
  autoConfirmed?: boolean
  pendingAudit?: boolean
  // Liquidación del saldo restante
  saldoStatus?: "PENDIENTE" | "PAGADO" | "NO_APLICA" | null
  saldoAmount?: number | null
  saldoMethod?: PaymentMethodEnum | string | null
  saldoComprobanteUrl?: string | null
  saldoFechaConfirmacion?: string | null
  saldoNotas?: string | null
  saldoConfirmadoPor?: { id: string; name: string } | null
  booking?: {
    id: string
    bookingReference?: string
    date?: string
    startTime?: string
    endTime?: string
    pricing?: {
      basePrice?: number
      discounts?: number
      taxes?: number
      totalPrice?: number
    }
    court?: { id: string; name: string }
    customerInfo?: { name: string; email: string; phone?: string }
    autoConfirmed?: boolean
    pendingAudit?: boolean
  }
  user?: { id: string; name: string; email: string }
  confirmadoPor?: { id: string; name: string }
}

export interface PaymentMetrics {
  clubId: string
  totalRecaudado: number
  recaudadoMercadoPago: number
  recaudadoManual: number
  saldoPendienteTotal: number
  comprobantesPendientesCount: number
  totalConfirmadosCount: number
  totalRechazadosCount: number
  desgloseMetodos: {
    mercadopago: number
    yape: number
    plin: number
    transferencia: number
    efectivo: number
  }
}

export interface PaymentFilters {
  status?: string
  method?: string
  type?: string
  search?: string
}

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────

export const getClubPaymentMetrics = async (): Promise<PaymentMetrics> => {
  const res = await api.get("/payments/club/metrics")
  return res.data
}

// ─── LISTA DE PAGOS ───────────────────────────────────────────────────────────

export const getClubPaymentsList = async (
  filters?: PaymentFilters
): Promise<PaymentItem[]> => {
  const res = await api.get("/payments/club/list", { params: filters })
  return res.data
}

// ─── AUDITAR COMPROBANTE INICIAL ──────────────────────────────────────────────

export const confirmManualPayment = async (
  paymentId: string,
  action: "CONFIRMAR" | "RECHAZAR",
  motivoRechazo?: string
): Promise<{ status: string; message: string; payment: PaymentItem }> => {
  const res = await api.patch(`/payments/${paymentId}/confirm`, {
    action,
    motivoRechazo,
  })
  return res.data
}

// ─── LIQUIDAR / COBRAR SALDO RESTANTE ────────────────────────────────────────

export const settlePaymentSaldo = async (
  paymentId: string,
  data: {
    monto?: number
    metodo: PaymentMethodEnum | string
    comprobanteUrl?: string
    notas?: string
  }
): Promise<{ status: string; message: string; payment: PaymentItem }> => {
  const res = await api.patch(`/payments/${paymentId}/settle-saldo`, data)
  return res.data
}

// ─── CONFIGURACIÓN DEL CLUB ────────────────────────────────────────────────────

export const getClubPaymentConfig = async (
  clubId?: string
): Promise<ClubPaymentConfig> => {
  const endpoint = clubId
    ? `/clubs/${clubId}/config-pagos`
    : `/clubs/my/config-pagos`
  const res = await api.get(endpoint)
  return res.data
}

export const updateClubPaymentConfig = async (
  clubId: string | undefined,
  config: Partial<ClubPaymentConfig>
): Promise<ClubPaymentConfig> => {
  const endpoint = clubId
    ? `/clubs/${clubId}/config-pagos`
    : `/clubs/my/config-pagos`
  const res = await api.patch(endpoint, config)
  return res.data
}

// ─── SUBIDA DE QR (Yape o Plin) ──────────────────────────────────────────────

export const uploadClubQr = async (
  file: File,
  walletType: "yape" | "plin" = "yape"
): Promise<{ url: string; wallet: string }> => {
  const formData = new FormData()
  formData.append("file", file)
  const res = await api.post(
    `/clubs/my/upload-qr?type=${walletType}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return res.data
}

// ─── REGISTRAR PAGO DE RESERVA ────────────────────────────────────────────────

export const createBookingPayment = async (
  bookingId: string,
  data: {
    metodo?: PaymentMethodEnum | string
    method?: PaymentMethodEnum | string
    tipo?: PaymentTypeEnum | string
    type?: PaymentTypeEnum | string
    monto?: number
    amount?: number
    comprobanteUrl?: string
    currency?: string
  }
) => {
  const payload = {
    metodo: data.metodo || data.method,
    tipo: data.tipo || data.type,
    monto: data.monto ?? data.amount,
    comprobanteUrl: data.comprobanteUrl,
    currency: data.currency,
  }
  const res = await api.post(`/payments/booking/${bookingId}`, payload)
  return res.data
}

export const getBookingPayments = async (bookingId: string) => {
  const res = await api.get(`/payments/booking/${bookingId}`)
  return res.data
}

// ─── SUBIDA DE COMPROBANTE ───────────────────────────────────────────────────

export const uploadPaymentReceipt = async (
  file: File
): Promise<{ url: string }> => {
  const formData = new FormData()
  formData.append("file", file)
  const res = await api.post("/payments/upload-comprobante", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}