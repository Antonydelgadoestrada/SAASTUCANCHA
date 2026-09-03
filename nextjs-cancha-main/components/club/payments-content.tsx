"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  DollarSignIcon, CreditCardIcon, SmartphoneIcon, ClockIcon,
  CheckCircle2Icon, XCircleIcon, EyeIcon, RefreshCwIcon,
  SearchIcon, ReceiptIcon, BanknoteIcon, ArrowRightIcon,
  UploadIcon, AlertCircleIcon, ShieldCheckIcon, DownloadIcon,
  Maximize2Icon, FileTextIcon, ExternalLinkIcon
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  getClubPaymentMetrics, getClubPaymentsList, confirmManualPayment,
  confirmSaldoPayment, settlePaymentSaldo, uploadPaymentReceipt,
  downloadImage, PaymentItem, PaymentMetrics, PaymentMethodEnum
} from "@/lib/payments"
import { PaymentSettingsTab } from "@/components/club/payment-settings-tab"
import { ReceiptLightboxModal } from "@/components/ui/receipt-lightbox-modal"

// ─── Helpers de cálculo y formato ─────────────────────────────────────────────

function fmt(val: number) {
  return `S/ ${(val || 0).toFixed(2)}`
}

export function computePaymentDetails(payment: PaymentItem) {
  const booking = payment.booking
  const totalBookingPrice = Number(booking?.pricing?.totalPrice ?? (payment.amount || 0))
  const paidInitial = Number(payment.amount || 0)
  const isAdvance =
    payment.type === "ADELANTO" ||
    String(payment.type).toUpperCase().includes("ADELANTO") ||
    (totalBookingPrice > paidInitial && totalBookingPrice > 0)
  const isSaldoPaid =
    payment.saldoStatus === "PAGADO" ||
    String(payment.saldoStatus).toUpperCase() === "PAGADO" ||
    String(payment.saldoStatus).toUpperCase() === "PAID"
  const isComprobanteRejected =
    String(payment.status).toUpperCase() === "RECHAZADO" ||
    String(payment.status).toUpperCase() === "REJECTED"
  
  // Saldo faltante exacto por pagar
  const saldoFaltante = (isAdvance && !isSaldoPaid && !isComprobanteRejected)
    ? Math.max(0, Number((totalBookingPrice - paidInitial).toFixed(2)))
    : 0

  const saldoSettledAmount = Number(
    payment.saldoAmount ?? (isSaldoPaid ? Math.max(0, totalBookingPrice - paidInitial) : 0)
  )

  const totalRecibido = isSaldoPaid 
    ? paidInitial + saldoSettledAmount
    : paidInitial

  const normalizedStatus = String(payment.status || "").toUpperCase()

  const isComprobantePending =
    normalizedStatus === "PENDIENTE" ||
    normalizedStatus === "PENDING" ||
    Boolean(payment.pendingAudit) ||
    Boolean(booking?.pendingAudit) ||
    Boolean(payment.autoConfirmed) ||
    Boolean(booking?.autoConfirmed)

  const isComprobanteApproved =
    normalizedStatus === "CONFIRMADO" ||
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "PAID" ||
    normalizedStatus === "PAGADO" ||
    normalizedStatus === "APPROVED"

  const normSaldo = String(payment.saldoStatus || "").toUpperCase()
  const isSaldoAuditPending =
    isAdvance &&
    !isSaldoPaid &&
    Boolean(payment.saldoComprobanteUrl) &&
    (normSaldo === "PENDIENTE" || normSaldo === "PENDING" || normSaldo === "")

  return {
    totalBookingPrice,
    paidInitial,
    isAdvance,
    isSaldoPaid,
    saldoSettledAmount,
    saldoFaltante,
    totalRecibido,
    isComprobantePending,
    isComprobanteApproved,
    isComprobanteRejected,
    isSaldoAuditPending,
  }
}

function comprobanteBadge(status: string, autoConfirmed?: boolean, pendingAudit?: boolean) {
  if (autoConfirmed || pendingAudit) {
    return (
      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 font-medium text-xs">
        🛡️ Auto-Confirmado
      </Badge>
    )
  }
  const normalized = String(status || "").toUpperCase().trim()
  const map: Record<string, { label: string; className: string }> = {
    PENDIENTE:  { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-300" },
    PENDING:    { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-300" },
    CONFIRMADO: { label: "Confirmado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    CONFIRMED:  { label: "Confirmado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    PAID:       { label: "Confirmado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    PAGADO:     { label: "Confirmado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    APPROVED:   { label: "Aprobado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    APROBADO:   { label: "Aprobado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    RECHAZADO:  { label: "Rechazado ✗", className: "bg-red-100 text-red-700 border-red-300" },
    REJECTED:   { label: "Rechazado ✗", className: "bg-red-100 text-red-700 border-red-300" },
    CANCELADO:  { label: "Cancelado", className: "bg-slate-100 text-slate-600 border-slate-300" },
    CANCELLED:  { label: "Cancelado", className: "bg-slate-100 text-slate-600 border-slate-300" },
  }
  const v = map[normalized] || { label: "Confirmado ✓", className: "bg-emerald-100 text-emerald-700 border-emerald-300" }
  return <Badge variant="outline" className={`${v.className} font-medium text-xs`}>{v.label}</Badge>
}

function typeLabel(type?: string | null) {
  const normalized = String(type || "").toUpperCase().trim()
  if (normalized.includes("ADELANTO") || normalized.includes("ADVANCE")) return "Adelanto"
  if (normalized.includes("SALDO")) return "Saldo Restante"
  return "Pago Completo"
}

function saldoBadge(
  isAdvance: boolean,
  isSaldoPaid: boolean,
  saldoFaltante: number,
  saldoMethod?: string | null,
  isRejected?: boolean,
  saldoStatus?: string | null,
  saldoComprobanteUrl?: string | null
) {
  if (isRejected) {
    return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 text-xs">Cancelado</Badge>
  }
  if (!isAdvance) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-xs">
        ✓ 100% Pagado
      </Badge>
    )
  }
  if (isSaldoPaid) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-xs">
        ✓ Liquidado ({saldoMethod || "Efectivo"})
      </Badge>
    )
  }
  const normSaldo = String(saldoStatus || "").toUpperCase().trim()
  if (normSaldo === "RECHAZADO" || normSaldo === "REJECTED") {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 font-medium text-xs">
        ✗ Saldo Rechazado
      </Badge>
    )
  }
  if (saldoComprobanteUrl && (normSaldo === "PENDIENTE" || normSaldo === "PENDING" || normSaldo === "")) {
    return (
      <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-300 font-semibold text-xs animate-pulse">
        🛡️ Saldo por Auditar
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-xs">
      ⚠️ Saldo Pendiente
    </Badge>
  )
}

function methodBadge(method: string) {
  const normalized = String(method || "").toUpperCase().trim()
  const map: Record<string, { label: string; color: string }> = {
    MERCADOPAGO:   { label: "Mercado Pago", color: "text-blue-600" },
    MERCADO_PAGO:  { label: "Mercado Pago", color: "text-blue-600" },
    MP:            { label: "Mercado Pago", color: "text-blue-600" },
    YAPE:          { label: "Yape", color: "text-purple-600" },
    PLIN:          { label: "Plin", color: "text-teal-600" },
    TRANSFERENCIA: { label: "Transferencia", color: "text-indigo-600" },
    TRANSFER:      { label: "Transferencia", color: "text-indigo-600" },
    EFECTIVO:      { label: "Efectivo", color: "text-green-700" },
    CASH:          { label: "Efectivo", color: "text-green-700" },
    CARD:          { label: "Tarjeta / POS", color: "text-blue-700" },
    CREDIT_CARD:   { label: "Tarjeta de Crédito", color: "text-blue-700" },
    DEBIT_CARD:    { label: "Tarjeta de Débito", color: "text-blue-700" },
    WHATSAPP:      { label: "WhatsApp", color: "text-emerald-600" },
  }
  const v = map[normalized] || { label: normalized || "Otro", color: "text-slate-500" }
  return <span className={`text-xs font-semibold ${v.color}`}>{v.label}</span>
}

// ─── Tarjetas de Métricas ─────────────────────────────────────────────────────

function MetricCard({
  title, value, sub, icon: Icon, iconClass, valueClass = "text-slate-900 dark:text-white", loading,
}: {
  title: string; value: string; sub: string
  icon: any; iconClass: string; valueClass?: string; loading?: boolean
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
          <div className={`p-2 rounded-lg ${iconClass}`}><Icon className="w-4 h-4" /></div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-28 mb-1" />
        ) : (
          <p className={`text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ─── Modal para Cobrar / Liquidar Saldo Restante ──────────────────────────────

function SettleSaldoModal({
  payment,
  open,
  onClose,
}: {
  payment: PaymentItem | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedMethod, setSelectedMethod] = useState<string>("EFECTIVO")
  const [montoCustom, setMontoCustom] = useState<string>("")
  const [notas, setNotas] = useState("")
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [comprobanteSaldoUrl, setComprobanteSaldoUrl] = useState<string | null>(null)

  const details = payment ? computePaymentDetails(payment) : null
  const defaultRemaining = details && details.saldoFaltante > 0 ? details.saldoFaltante : 0
  const effectiveMonto = montoCustom !== "" ? Number(montoCustom) : defaultRemaining

  const mutation = useMutation({
    mutationFn: (data: { monto: number; metodo: string; comprobanteUrl?: string; notas?: string }) => {
      if (!payment) throw new Error("No hay pago seleccionado")
      return settlePaymentSaldo(payment.id, {
        monto: data.monto,
        metodo: data.metodo,
        comprobanteUrl: data.comprobanteUrl,
        notas: data.notas,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
      queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
      toast.success("¡Saldo restante liquidado exitosamente!", {
        description: `Se registraron ${fmt(effectiveMonto)} vía ${selectedMethod}.`,
      })
      onClose()
      setMontoCustom("")
      setNotas("")
      setComprobanteSaldoUrl(null)
    },
    onError: (err: any) => {
      toast.error("Error al registrar liquidación", {
        description: err.response?.data?.message || err.message,
      })
    },
  })

  if (!payment) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingReceipt(true)
      const res = await uploadPaymentReceipt(file)
      setComprobanteSaldoUrl(res.url)
      toast.success("Comprobante del saldo adjuntado correctamente")
    } catch (err: any) {
      toast.error("Error al subir comprobante", { description: err.message })
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleConfirmSettle = () => {
    mutation.mutate({
      monto: effectiveMonto,
      metodo: selectedMethod,
      comprobanteUrl: comprobanteSaldoUrl || undefined,
      notas: notas || undefined,
    })
  }

  const customerName = payment.booking?.customerInfo?.name || payment.user?.name || "Cliente"
  const courtName = payment.booking?.court?.name || "Cancha"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanknoteIcon className="w-5 h-5 text-emerald-600" />
            Cobrar / Confirmar Saldo Restante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm pt-1">
          {/* Card Resumen de Deuda */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Cliente & Reserva</p>
                <p className="font-bold text-slate-900 dark:text-white">{customerName}</p>
                <p className="text-xs text-slate-500">{courtName} {payment.booking?.bookingReference ? `• Ref: ${payment.booking.bookingReference}` : ""}</p>
              </div>
              <Badge className="bg-emerald-600 text-white font-bold">
                Total: {fmt(details.totalBookingPrice)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 mt-2 text-xs">
              <div>
                <span className="text-slate-500">Abono inicial recibido:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{fmt(details.paidInitial)}</p>
              </div>
              <div>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">Monto faltante a cobrar:</span>
                <p className="font-bold text-base text-amber-600 dark:text-amber-400">{fmt(defaultRemaining)}</p>
              </div>
            </div>
          </div>

          {/* Monto a Cobrar */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Monto que cancela el cliente (S/)</Label>
            <Input
              type="number"
              step="0.10"
              placeholder={defaultRemaining.toString()}
              defaultValue={defaultRemaining > 0 ? defaultRemaining : ""}
              onChange={(e) => setMontoCustom(e.target.value)}
              className="font-bold text-base"
            />
            <p className="text-[11px] text-slate-400">
              Valor sugerido correspondiente al saldo pendiente exacto.
            </p>
          </div>

          {/* Método de Cobro */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Método de cobro del restante</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "EFECTIVO", label: "💵 Efectivo (Cancha/Caja)" },
                { id: "YAPE", label: "🟣 Yape" },
                { id: "PLIN", label: "🟢 Plin" },
                { id: "TRANSFERENCIA", label: "🏦 Transferencia" },
                { id: "CARD", label: "💳 POS / Tarjeta" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethod(m.id)}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                    selectedMethod === m.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subir comprobante del saldo (opcional) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Comprobante de cancelación de saldo (opcional)</span>
              {comprobanteSaldoUrl && (
                <span className="text-emerald-600 text-[11px] font-bold">✓ Adjuntado</span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadingReceipt}
                className="text-xs file:text-xs"
              />
              {uploadingReceipt && (
                <span className="animate-spin text-xs text-slate-500">⏳</span>
              )}
            </div>
          </div>

          {/* Notas de liquidación */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notas adicionales (opcional)</Label>
            <Textarea
              placeholder="Ej. Cobrado en recepción en efectivo al ingresar a la cancha..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1"
            onClick={handleConfirmSettle}
            disabled={mutation.isPending || effectiveMonto <= 0}
          >
            {mutation.isPending ? (
              <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
            ) : (
              <CheckCircle2Icon className="w-4 h-4" />
            )}
            Confirmar y Liquidar {fmt(effectiveMonto)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal de Detalle Completo y Auditoría (360°) ────────────────────────────

function PaymentDetailModal({
  payment,
  open,
  onClose,
  onOpenSettleModal,
  onOpenLightbox,
}: {
  payment: PaymentItem | null
  open: boolean
  onClose: () => void
  onOpenSettleModal: (p: PaymentItem) => void
  onOpenLightbox: (imageUrl: string, title: string, subtitle?: string, badge?: string) => void
}) {
  const queryClient = useQueryClient()
  
  // Estado para rechazo del 1er pago
  const [motivoRechazo1, setMotivoRechazo1] = useState("")
  const [showRejectInput1, setShowRejectInput1] = useState(false)

  // Estado para rechazo del 2do pago (saldo)
  const [motivoRechazo2, setMotivoRechazo2] = useState("")
  const [showRejectInput2, setShowRejectInput2] = useState(false)

  // Mutación para 1er Pago
  const mutation1 = useMutation({
    mutationFn: ({ action, motivo }: { action: "CONFIRMAR" | "RECHAZAR"; motivo?: string }) => {
      if (!payment) throw new Error("No hay pago seleccionado")
      return confirmManualPayment(payment.id, action, motivo)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
      queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
      toast.success(vars.action === "CONFIRMAR" ? "1er Comprobante confirmado ✓" : "1er Comprobante rechazado")
      setShowRejectInput1(false)
      setMotivoRechazo1("")
      onClose()
    },
    onError: (err: any) => {
      toast.error("Error al procesar 1er pago", { description: err.response?.data?.message || err.message })
    },
  })

  // Mutación para 2do Pago (Saldo)
  const mutationSaldo = useMutation({
    mutationFn: ({ action, motivo }: { action: "CONFIRMAR" | "RECHAZAR"; motivo?: string }) => {
      if (!payment) throw new Error("No hay pago seleccionado")
      return confirmSaldoPayment(payment.id, action, motivo)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
      queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
      toast.success(vars.action === "CONFIRMAR" ? "Comprobante de saldo aprobado ✓" : "Comprobante de saldo rechazado")
      setShowRejectInput2(false)
      setMotivoRechazo2("")
      onClose()
    },
    onError: (err: any) => {
      toast.error("Error al procesar saldo", { description: err.response?.data?.message || err.message })
    },
  })

  if (!payment) return null

  const details = computePaymentDetails(payment)
  const isAuditPending = details.isComprobantePending
  const isAutoConfirmed = payment.autoConfirmed || payment.booking?.autoConfirmed
  const booking = payment.booking
  const customer = booking?.customerInfo
  const customerName = customer?.name || payment.user?.name || "El cliente"

  const hasSaldoVoucher = Boolean(payment.saldoComprobanteUrl)
  const isSaldoPending = details.isSaldoAuditPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-emerald-600" />
            Auditoría de Pagos & Liquidación 360°
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm pt-1">
          {/* Banner de Estado General */}
          {details.isAdvance && !details.isSaldoPaid && !details.isComprobanteRejected ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span>⚠️</span> Modalidad: Adelanto — Saldo Pendiente
                </p>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                  Falta Saldo: {fmt(details.saldoFaltante)}
                </Badge>
              </div>
              <p>
                El usuario <strong>{customerName}</strong> registró un adelanto de <strong>{fmt(details.paidInitial)}</strong> de un precio total de <strong>{fmt(details.totalBookingPrice)}</strong>.
              </p>
            </div>
          ) : details.isAdvance && details.isSaldoPaid ? (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>✓</span> Reserva Totalmente Liquidada (100% Pagada)
              </p>
              <p>
                El usuario completó el 1er pago ({fmt(details.paidInitial)}) y el saldo restante ({fmt(details.saldoSettledAmount)}) mediante <strong>{payment.saldoMethod || "Efectivo"}</strong>.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>✓</span> Pago Completo (100%)
              </p>
              <p>
                El usuario <strong>{customerName}</strong> realizó el pago completo por <strong>{fmt(details.paidInitial)}</strong>.
              </p>
            </div>
          )}

          {isAutoConfirmed && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-xl text-xs text-sky-800 dark:text-sky-300">
              <strong>🛡️ Cancha Asegurada Automáticamente:</strong> Pasaron más de 2 horas sin auditar el comprobante inicial. Por favor valida los datos para cerrar la auditoría.
            </div>
          )}

          {/* Info de Reserva y Cliente */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Cliente</p>
              <p className="font-semibold text-slate-900 dark:text-white">{customer?.name || payment.user?.name || "—"}</p>
              <p className="text-xs text-slate-500">{customer?.email || payment.user?.email || ""}</p>
              {customer?.phone && <p className="text-xs text-slate-500">Tel: {customer.phone}</p>}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Cancha & Horario</p>
              <p className="font-semibold text-slate-900 dark:text-white">{booking?.court?.name || "—"}</p>
              {booking?.date && (
                <p className="text-xs text-slate-500">
                  {format(new Date(booking.date), "dd/MM/yyyy")} {booking.startTime?.slice(0,5)} - {booking.endTime?.slice(0,5)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Código de reserva</p>
              <p className="font-mono text-xs text-slate-700 dark:text-slate-300 font-bold">{booking?.bookingReference || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Fecha de registro</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CAMPO 1: PRIMER PAGO (ADELANTO / ABONO INICIAL)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Campo 1: Primer Pago (Abono Inicial / Adelanto)
                  </h4>
                  <p className="text-[11px] text-slate-400">Comprobante y detalles del pago inicial registrado</p>
                </div>
              </div>
              {comprobanteBadge(payment.status, payment.autoConfirmed, payment.pendingAudit)}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
              <div>
                <p className="text-slate-500">Monto Abonado</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(payment.amount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Método de Pago</p>
                <div className="mt-0.5">{methodBadge(payment.method)}</div>
              </div>
              <div>
                <p className="text-slate-500">Tipo de Pago</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{typeLabel(payment.type)}</p>
              </div>
            </div>

            {/* Visualizador de Comprobante 1 */}
            {payment.comprobanteUrl ? (
              <div className="space-y-2 p-3 bg-slate-50/70 dark:bg-slate-900/70 rounded-xl border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileTextIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Comprobante del 1er Pago
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={() =>
                        onOpenLightbox(
                          payment.comprobanteUrl!,
                          "Comprobante de 1er Pago",
                          `${customerName} • ${fmt(payment.amount)}`,
                          typeLabel(payment.type)
                        )
                      }
                    >
                      <Maximize2Icon className="w-3.5 h-3.5" />
                      Ampliar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1 text-slate-700 hover:text-slate-900"
                      onClick={() =>
                        downloadImage(
                          payment.comprobanteUrl!,
                          `comprobante-1er-pago-${payment.booking?.bookingReference || payment.id}.png`
                        )
                      }
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                      Descargar
                    </Button>
                  </div>
                </div>

                <div
                  className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-56 flex items-center justify-center p-2 cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() =>
                    onOpenLightbox(
                      payment.comprobanteUrl!,
                      "Comprobante de 1er Pago",
                      `${customerName} • ${fmt(payment.amount)}`,
                      typeLabel(payment.type)
                    )
                  }
                >
                  <img
                    src={payment.comprobanteUrl}
                    alt="Comprobante 1er pago"
                    className="max-h-52 w-auto object-contain rounded"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-500 text-center">
                Pago procesado automáticamente o sin imagen de comprobante adjunta.
              </div>
            )}

            {payment.confirmadoPor && (
              <p className="text-xs text-slate-400">
                Auditado por <strong>{payment.confirmadoPor.name}</strong> el {payment.fechaConfirmacion ? format(new Date(payment.fechaConfirmacion), "dd/MM/yyyy HH:mm") : ""}
              </p>
            )}

            {payment.motivoRechazo && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-xs text-red-700">
                <strong>Motivo de rechazo (1er Pago):</strong> {payment.motivoRechazo}
              </div>
            )}

            {/* Acciones dedicadas del 1er Pago */}
            <div className="pt-2 border-t flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Acciones del 1er Pago
              </span>

              {isAuditPending ? (
                !showRejectInput1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 flex-1 text-xs h-8"
                      onClick={() => setShowRejectInput1(true)}
                      disabled={mutation1.isPending}
                    >
                      <XCircleIcon className="w-4 h-4 mr-1.5" />
                      Rechazar 1er Pago
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 text-xs h-8"
                      onClick={() => mutation1.mutate({ action: "CONFIRMAR" })}
                      disabled={mutation1.isPending}
                    >
                      {mutation1.isPending ? (
                        <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                      ) : (
                        <CheckCircle2Icon className="w-4 h-4 mr-1.5" />
                      )}
                      Aprobar 1er Pago
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                    <Label className="text-xs font-semibold text-red-800">Motivo del rechazo del 1er Comprobante</Label>
                    <Textarea
                      placeholder="Ej. El monto no coincide con el abono registrado, comprobante ilegible..."
                      value={motivoRechazo1}
                      onChange={(e) => setMotivoRechazo1(e.target.value)}
                      rows={2}
                      className="text-xs bg-white"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setShowRejectInput1(false)} disabled={mutation1.isPending}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white text-xs"
                        onClick={() => mutation1.mutate({ action: "RECHAZAR", motivo: motivoRechazo1 })}
                        disabled={mutation1.isPending}
                      >
                        {mutation1.isPending ? "Procesando..." : "Confirmar Rechazo 1er Pago"}
                      </Button>
                    </div>
                  </div>
                )
              ) : details.isComprobanteApproved ? (
                <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                    1er Pago Aprobado y Validado
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setShowRejectInput1(true)}
                  >
                    Re-evaluar / Rechazar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-xs text-red-800 dark:text-red-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <XCircleIcon className="w-4 h-4 text-red-600" />
                    1er Pago Rechazado
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => mutation1.mutate({ action: "CONFIRMAR" })}
                    disabled={mutation1.isPending}
                  >
                    Re-aprobar 1er Pago
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CAMPO 2: SEGUNDO PAGO (SALDO RESTANTE Y LIQUIDACIÓN)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    details.isSaldoPaid ? "bg-emerald-500" : details.isAdvance ? "bg-amber-500" : "bg-slate-400"
                  }`}
                ></span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Campo 2: Segundo Pago (Saldo Restante y Liquidación)
                  </h4>
                  <p className="text-[11px] text-slate-400">Comprobante y cancelación del saldo pendiente</p>
                </div>
              </div>
              {saldoBadge(
                details.isAdvance,
                details.isSaldoPaid,
                details.saldoFaltante,
                payment.saldoMethod,
                details.isComprobanteRejected,
                payment.saldoStatus,
                payment.saldoComprobanteUrl
              )}
            </div>

            {!details.isAdvance ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700 dark:text-slate-300">No aplica saldo pendiente</p>
                <p className="text-[11px] text-slate-400 mt-0.5">La reserva fue pagada al 100% en el primer pago inicial.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                  <div>
                    <p className="text-slate-500">Monto del Saldo</p>
                    <p className={`text-lg font-bold ${details.isSaldoPaid ? "text-emerald-600" : "text-amber-600"}`}>
                      {details.isSaldoPaid ? fmt(details.saldoSettledAmount) : fmt(details.saldoFaltante)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Método de Saldo</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {payment.saldoMethod || (details.isSaldoPaid ? "Efectivo" : "Pendiente")}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estado Liquidación</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {details.isSaldoPaid ? "✓ Liquidado" : isSaldoPending ? "🛡️ Comprobante Recibido" : "⚠️ Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Visualizador de Comprobante de Saldo (2do pago) */}
                {payment.saldoComprobanteUrl ? (
                  <div className="space-y-2 p-3 bg-slate-50/70 dark:bg-slate-900/70 rounded-xl border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <FileTextIcon className="w-3.5 h-3.5 text-amber-600" />
                        Comprobante del 2do Pago (Saldo)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={() =>
                            onOpenLightbox(
                              payment.saldoComprobanteUrl!,
                              "Comprobante de 2do Pago (Saldo)",
                              `${customerName} • ${fmt(details.saldoSettledAmount || details.saldoFaltante)}`,
                              "Saldo Restante"
                            )
                          }
                        >
                          <Maximize2Icon className="w-3.5 h-3.5" />
                          Ampliar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 text-slate-700 hover:text-slate-900"
                          onClick={() =>
                            downloadImage(
                              payment.saldoComprobanteUrl!,
                              `comprobante-2do-pago-saldo-${payment.booking?.bookingReference || payment.id}.png`
                            )
                          }
                        >
                          <DownloadIcon className="w-3.5 h-3.5" />
                          Descargar
                        </Button>
                      </div>
                    </div>

                    <div
                      className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-56 flex items-center justify-center p-2 cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() =>
                        onOpenLightbox(
                          payment.saldoComprobanteUrl!,
                          "Comprobante de 2do Pago (Saldo)",
                          `${customerName} • ${fmt(details.saldoSettledAmount || details.saldoFaltante)}`,
                          "Saldo Restante"
                        )
                      }
                    >
                      <img
                        src={payment.saldoComprobanteUrl}
                        alt="Comprobante saldo"
                        className="max-h-52 w-auto object-contain rounded"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-500 text-center">
                    {details.isSaldoPaid
                      ? "Saldo liquidado directamente en efectivo/caja sin comprobante digital."
                      : "Aún no se ha adjuntado comprobante de saldo restante."}
                  </div>
                )}

                {payment.saldoConfirmadoPor && (
                  <p className="text-xs text-slate-400">
                    Liquidado / Auditado por <strong>{payment.saldoConfirmadoPor.name}</strong>{" "}
                    {payment.saldoFechaConfirmacion ? format(new Date(payment.saldoFechaConfirmacion), "dd/MM/yyyy HH:mm") : ""}
                  </p>
                )}

                {payment.saldoNotas && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-600 dark:text-slate-400">
                    <strong>Notas de saldo:</strong> {payment.saldoNotas}
                  </div>
                )}

                {/* Acciones dedicadas del 2do Pago */}
                <div className="pt-2 border-t flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Acciones del 2do Pago (Saldo)
                  </span>

                  {hasSaldoVoucher && !details.isSaldoPaid ? (
                    !showRejectInput2 ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50 text-xs h-8 flex-1"
                          onClick={() => setShowRejectInput2(true)}
                          disabled={mutationSaldo.isPending}
                        >
                          <XCircleIcon className="w-4 h-4 mr-1.5" />
                          Rechazar Saldo
                        </Button>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex-1"
                          onClick={() => mutationSaldo.mutate({ action: "CONFIRMAR" })}
                          disabled={mutationSaldo.isPending}
                        >
                          {mutationSaldo.isPending ? (
                            <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                          ) : (
                            <CheckCircle2Icon className="w-4 h-4 mr-1.5" />
                          )}
                          Aprobar Comprobante Saldo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-slate-700 text-xs h-8"
                          onClick={() => {
                            onClose()
                            onOpenSettleModal(payment)
                          }}
                        >
                          <BanknoteIcon className="w-4 h-4 mr-1" />
                          Liquidar Manual
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200">
                        <Label className="text-xs font-semibold text-red-800">Motivo de rechazo de comprobante de saldo</Label>
                        <Textarea
                          placeholder="Ej. Comprobante no corresponde al saldo faltante, no visible..."
                          value={motivoRechazo2}
                          onChange={(e) => setMotivoRechazo2(e.target.value)}
                          rows={2}
                          className="text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button variant="outline" size="sm" onClick={() => setShowRejectInput2(false)} disabled={mutationSaldo.isPending}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white text-xs"
                            onClick={() => mutationSaldo.mutate({ action: "RECHAZAR", motivo: motivoRechazo2 })}
                            disabled={mutationSaldo.isPending}
                          >
                            {mutationSaldo.isPending ? "Procesando..." : "Confirmar Rechazo Saldo"}
                          </Button>
                        </div>
                      </div>
                    )
                  ) : !details.isSaldoPaid ? (
                    <div className="flex items-center justify-between p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg border border-amber-200">
                      <div>
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Saldo pendiente por cobrar:</p>
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmt(details.saldoFaltante)}</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                        onClick={() => {
                          onClose()
                          onOpenSettleModal(payment)
                        }}
                      >
                        <BanknoteIcon className="w-4 h-4" />
                        Cobrar / Liquidar Saldo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                        Saldo 100% Liquidado ({payment.saldoMethod || "Efectivo"})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-emerald-700 hover:bg-emerald-100"
                        onClick={() => {
                          onClose()
                          onOpenSettleModal(payment)
                        }}
                      >
                        Modificar Liquidación
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar Ventana
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab de Métricas y Auditoría ─────────────────────────────────────────────

function MetricsAuditTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [settleTargetPayment, setSettleTargetPayment] = useState<PaymentItem | null>(null)

  // Lightbox de comprobantes
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxTitle, setLightboxTitle] = useState("Comprobante de Pago")
  const [lightboxSubtitle, setLightboxSubtitle] = useState<string | undefined>()
  const [lightboxBadge, setLightboxBadge] = useState<string | undefined>()

  const handleOpenLightbox = (
    imageUrl: string,
    title: string,
    subtitle?: string,
    badge?: string
  ) => {
    setLightboxImage(imageUrl)
    setLightboxTitle(title)
    setLightboxSubtitle(subtitle)
    setLightboxBadge(badge)
    setLightboxOpen(true)
  }

  const { data: metrics, isLoading: loadingMetrics } = useQuery<PaymentMetrics>({
    queryKey: ["club-payment-metrics"],
    queryFn: getClubPaymentMetrics,
    staleTime: 30_000,
  })

  const { data: payments = [], isLoading: loadingList } = useQuery<PaymentItem[]>({
    queryKey: ["club-payments-list", { status: statusFilter, method: methodFilter, type: typeFilter, search }],
    queryFn: () => getClubPaymentsList({ status: statusFilter, method: methodFilter, type: typeFilter, search }),
    staleTime: 15_000,
  })

  const openDetail = (p: PaymentItem) => {
    setSelectedPayment(p)
    setDetailOpen(true)
  }

  const openSettle = (p: PaymentItem) => {
    setSettleTargetPayment(p)
    setSettleOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total Recaudado"
          value={fmt(metrics?.totalRecaudado ?? 0)}
          sub={`${metrics?.totalConfirmadosCount ?? 0} transacciones confirmadas`}
          icon={DollarSignIcon}
          iconClass="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600"
          valueClass="text-emerald-600"
          loading={loadingMetrics}
        />
        <MetricCard
          title="Mercado Pago"
          value={fmt(metrics?.recaudadoMercadoPago ?? 0)}
          sub="Cobros automáticos procesados"
          icon={CreditCardIcon}
          iconClass="bg-blue-100 dark:bg-blue-950/50 text-blue-600"
          loading={loadingMetrics}
        />
        <MetricCard
          title="Yape / Plin / Manual"
          value={fmt(metrics?.recaudadoManual ?? 0)}
          sub={`Yape: ${fmt(metrics?.desgloseMetodos?.yape ?? 0)} | Plin: ${fmt(metrics?.desgloseMetodos?.plin ?? 0)} | Efec: ${fmt(metrics?.desgloseMetodos?.efectivo ?? 0)}`}
          icon={SmartphoneIcon}
          iconClass="bg-purple-100 dark:bg-purple-950/50 text-purple-600"
          loading={loadingMetrics}
        />
        <MetricCard
          title="Saldo por Cobrar"
          value={fmt(metrics?.saldoPendienteTotal ?? 0)}
          sub="A cobrar en cancha / reservas activas"
          icon={ClockIcon}
          iconClass="bg-amber-100 dark:bg-amber-950/50 text-amber-600"
          valueClass="text-amber-600"
          loading={loadingMetrics}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente, cancha o código de reserva..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado Comprobante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes de Auditar</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los métodos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="MERCADOPAGO">Mercado Pago</SelectItem>
            <SelectItem value="YAPE">Yape</SelectItem>
            <SelectItem value="PLIN">Plin</SelectItem>
            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo de Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="ADELANTO">Adelanto</SelectItem>
            <SelectItem value="SALDO">Saldo</SelectItem>
            <SelectItem value="PAGO_COMPLETO">Pago Completo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bandeja de Transacciones y Comprobantes */}
      <div className="rounded-xl border overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Bandeja de Transacciones y Auditoría de Comprobantes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audita el 1er y 2do comprobante de forma independiente y confirma la liquidación de saldos en tiempo real.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-semibold bg-white dark:bg-slate-800">
            {payments.length} registro{payments.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {loadingList ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
            <DollarSignIcon className="w-12 h-12 opacity-25" />
            <p className="font-semibold text-sm">No se encontraron pagos con los filtros aplicados</p>
            <p className="text-xs">Intenta cambiar los filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wide border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente & Reserva</th>
                  <th className="px-4 py-3 text-left">1er Pago (Inicial / Adelanto)</th>
                  <th className="px-4 py-3 text-left">2do Pago (Saldo Restante)</th>
                  <th className="px-4 py-3 text-left">Total Reserva</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => {
                  const customer = p.booking?.customerInfo
                  const customerName = customer?.name || p.user?.name || "Cliente"
                  const details = computePaymentDetails(p)
                  const isAuditRequired1 = details.isComprobantePending
                  const isAuditRequired2 = details.isSaldoAuditPending
                  const hasPendingBalance = details.isAdvance && !details.isSaldoPaid && !details.isComprobanteRejected

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                        isAuditRequired1 || isAuditRequired2 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Cliente & Cancha */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {customerName}
                        </p>
                        <p className="font-semibold text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {p.booking?.court?.name || "—"}
                        </p>
                        {p.booking?.date && (
                          <p className="text-[11px] text-slate-500">
                            {format(new Date(p.booking.date), "dd/MM")} • {p.booking.startTime?.slice(0,5)} - {p.booking.endTime?.slice(0,5)}
                          </p>
                        )}
                        {p.booking?.bookingReference && (
                          <p className="font-mono text-[10px] text-slate-400">Ref: {p.booking.bookingReference}</p>
                        )}
                      </td>

                      {/* 1er Pago (Inicial / Adelanto) */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-600">{fmt(p.amount)}</span>
                            {methodBadge(p.method)}
                          </div>

                          <div className="flex items-center gap-2">
                            {comprobanteBadge(p.status, p.autoConfirmed || p.booking?.autoConfirmed, p.pendingAudit || p.booking?.pendingAudit)}
                          </div>

                          {/* Miniatura y Acciones de 1er Comprobante */}
                          {p.comprobanteUrl ? (
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                className="relative group w-12 h-12 rounded-lg border overflow-hidden bg-white shrink-0 shadow-sm"
                                onClick={() =>
                                  handleOpenLightbox(
                                    p.comprobanteUrl!,
                                    "1er Comprobante de Pago",
                                    `${customerName} • ${fmt(p.amount)}`,
                                    typeLabel(p.type)
                                  )
                                }
                                title="Hacer clic para ampliar comprobante"
                              >
                                <img
                                  src={p.comprobanteUrl}
                                  alt="1er Comprobante"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Maximize2Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                              </button>

                              <div className="flex flex-col gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start"
                                  onClick={() =>
                                    handleOpenLightbox(
                                      p.comprobanteUrl!,
                                      "1er Comprobante de Pago",
                                      `${customerName} • ${fmt(p.amount)}`,
                                      typeLabel(p.type)
                                    )
                                  }
                                >
                                  <EyeIcon className="w-3 h-3 mr-1" />
                                  Ampliar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px] text-slate-600 hover:text-slate-800 justify-start"
                                  onClick={() =>
                                    downloadImage(
                                      p.comprobanteUrl!,
                                      `comprobante-1er-pago-${p.booking?.bookingReference || p.id}.png`
                                    )
                                  }
                                >
                                  <DownloadIcon className="w-3 h-3 mr-1" />
                                  Descargar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Sin archivo adjunto</span>
                          )}

                          {isAuditRequired1 && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-6 px-2 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1"
                              onClick={() => openDetail(p)}
                            >
                              <ShieldCheckIcon className="w-3 h-3" />
                              Auditar 1er Pago
                            </Button>
                          )}
                        </div>
                      </td>

                      {/* 2do Pago (Saldo Restante) */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          {!details.isAdvance ? (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium text-xs">
                                ✓ 100% Pagado
                              </Badge>
                              <p className="text-[10px] text-slate-400">No aplica saldo</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${details.isSaldoPaid ? "text-emerald-600" : "text-amber-600"}`}>
                                  {details.isSaldoPaid ? fmt(details.saldoSettledAmount) : fmt(details.saldoFaltante)}
                                </span>
                                {p.saldoMethod && (
                                  <span className="text-[11px] text-slate-500 font-medium">({p.saldoMethod})</span>
                                )}
                              </div>

                              <div>
                                {saldoBadge(
                                  details.isAdvance,
                                  details.isSaldoPaid,
                                  details.saldoFaltante,
                                  p.saldoMethod,
                                  details.isComprobanteRejected,
                                  p.saldoStatus,
                                  p.saldoComprobanteUrl
                                )}
                              </div>

                              {/* Miniatura y Acciones de 2do Comprobante (Saldo) */}
                              {p.saldoComprobanteUrl ? (
                                <div className="flex items-center gap-2 pt-0.5">
                                  <button
                                    type="button"
                                    className="relative group w-12 h-12 rounded-lg border overflow-hidden bg-white shrink-0 shadow-sm"
                                    onClick={() =>
                                      handleOpenLightbox(
                                        p.saldoComprobanteUrl!,
                                        "2do Comprobante (Saldo)",
                                        `${customerName} • ${fmt(details.saldoSettledAmount || details.saldoFaltante)}`,
                                        "Saldo Restante"
                                      )
                                    }
                                    title="Hacer clic para ampliar comprobante de saldo"
                                  >
                                    <img
                                      src={p.saldoComprobanteUrl}
                                      alt="Comprobante Saldo"
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Maximize2Icon className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </button>

                                  <div className="flex flex-col gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start"
                                      onClick={() =>
                                        handleOpenLightbox(
                                          p.saldoComprobanteUrl!,
                                          "2do Comprobante (Saldo)",
                                          `${customerName} • ${fmt(details.saldoSettledAmount || details.saldoFaltante)}`,
                                          "Saldo Restante"
                                        )
                                      }
                                    >
                                      <EyeIcon className="w-3 h-3 mr-1" />
                                      Ampliar
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] text-slate-600 hover:text-slate-800 justify-start"
                                      onClick={() =>
                                        downloadImage(
                                          p.saldoComprobanteUrl!,
                                          `comprobante-2do-pago-saldo-${p.booking?.bookingReference || p.id}.png`
                                        )
                                      }
                                    >
                                      <DownloadIcon className="w-3 h-3 mr-1" />
                                      Descargar
                                    </Button>
                                  </div>
                                </div>
                              ) : details.isSaldoPaid ? (
                                <span className="text-[10px] text-slate-400">Liquidado en caja</span>
                              ) : null}

                              {/* Botones de acción para Saldo */}
                              {isAuditRequired2 ? (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] font-semibold bg-sky-600 hover:bg-sky-700 text-white gap-1"
                                  onClick={() => openDetail(p)}
                                >
                                  <ShieldCheckIcon className="w-3 h-3" />
                                  Auditar Saldo
                                </Button>
                              ) : hasPendingBalance && !isAuditRequired1 ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] font-semibold border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                                  onClick={() => openSettle(p)}
                                >
                                  <BanknoteIcon className="w-3 h-3" />
                                  Cobrar Saldo
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Total Reserva */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {fmt(details.totalBookingPrice)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Recibido: {fmt(details.totalRecibido)}
                          </p>
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(new Date(p.createdAt), "dd/MM HH:mm")}
                      </td>

                      {/* Acciones Generales */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs font-semibold gap-1 text-slate-700 hover:text-slate-950 dark:text-slate-200"
                            onClick={() => openDetail(p)}
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            Detalle 360°
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle Completo 360° */}
      <PaymentDetailModal
        payment={selectedPayment}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onOpenSettleModal={(p) => openSettle(p)}
        onOpenLightbox={handleOpenLightbox}
      />

      {/* Modal de Cobro / Liquidación de Saldo Restante */}
      <SettleSaldoModal
        payment={settleTargetPayment}
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
      />

      {/* Lightbox para Comprobantes */}
      <ReceiptLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxImage}
        title={lightboxTitle}
        subtitle={lightboxSubtitle}
        badgeLabel={lightboxBadge}
      />
    </div>
  )
}

// ─── Componente Principal (página completa) ───────────────────────────────────

export function PaymentsContent() {
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
    queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
    toast.info("Datos actualizados")
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Control de Pagos y Recaudación
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audita comprobantes de Yape/Plin, monitorea ingresos de Mercado Pago y gestiona la liquidación de saldos en tiempo real.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2 shrink-0">
          <RefreshCwIcon className="w-4 h-4" />
          Actualizar Datos
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="metricas" className="space-y-6">
        <TabsList className="h-10">
          <TabsTrigger value="metricas" className="gap-2 text-sm">
            <ReceiptIcon className="w-4 h-4" />
            Métricas y Auditoría
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 text-sm">
            <CreditCardIcon className="w-4 h-4" />
            Medios de Pago y MP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metricas" className="mt-0">
          <MetricsAuditTab />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <PaymentSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
