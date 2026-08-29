"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  DollarSignIcon, CreditCardIcon, SmartphoneIcon, ClockIcon,
  CheckCircle2Icon, XCircleIcon, EyeIcon, RefreshCwIcon,
  SearchIcon, ReceiptIcon, BanknoteIcon, ArrowRightIcon,
  UploadIcon, AlertCircleIcon, ShieldCheckIcon
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
  settlePaymentSaldo, uploadPaymentReceipt,
  PaymentItem, PaymentMetrics, PaymentMethodEnum
} from "@/lib/payments"
import { PaymentSettingsTab } from "@/components/club/payment-settings-tab"

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
  isRejected?: boolean
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
}: {
  payment: PaymentItem | null
  open: boolean
  onClose: () => void
  onOpenSettleModal: (p: PaymentItem) => void
}) {
  const queryClient = useQueryClient()
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ action, motivo }: { action: "CONFIRMAR" | "RECHAZAR"; motivo?: string }) => {
      if (!payment) throw new Error("No hay pago seleccionado")
      return confirmManualPayment(payment.id, action, motivo)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
      queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
      toast.success(vars.action === "CONFIRMAR" ? "Comprobante confirmado ✓" : "Comprobante rechazado")
      setShowRejectInput(false)
      setMotivoRechazo("")
      onClose()
    },
    onError: (err: any) => {
      toast.error("Error al procesar", { description: err.response?.data?.message || err.message })
    },
  })

  if (!payment) return null

  const details = computePaymentDetails(payment)
  const isAuditPending = details.isComprobantePending
  const isAutoConfirmed = payment.autoConfirmed || payment.booking?.autoConfirmed
  const booking = payment.booking
  const customer = booking?.customerInfo
  const customerName = customer?.name || payment.user?.name || "El cliente"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-emerald-600" />
            Detalle de Pago & Liquidación de Saldo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm pt-1">
          {/* Banner de Estado General */}
          {details.isAdvance && !details.isSaldoPaid && !details.isComprobanteRejected ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span>⚠️</span> Adelanto Recibido — Saldo Pendiente
                </p>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                  Falta: {fmt(details.saldoFaltante)}
                </Badge>
              </div>
              <p>
                El usuario <strong>{customerName}</strong> abonó un adelanto inicial de <strong>{fmt(details.paidInitial)}</strong> (Total reserva: {fmt(details.totalBookingPrice)}).
              </p>
              {details.isComprobanteApproved && (
                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 gap-1"
                    onClick={() => {
                      onClose()
                      onOpenSettleModal(payment)
                    }}
                  >
                    <BanknoteIcon className="w-3.5 h-3.5" />
                    Cobrar Restante Ahora
                  </Button>
                </div>
              )}
            </div>
          ) : details.isAdvance && details.isSaldoPaid ? (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>✓</span> Reserva Totalmente Liquidada (100% Pagada)
              </p>
              <p>
                El usuario inició con un adelanto de <strong>{fmt(details.paidInitial)}</strong> y completó el saldo restante de <strong>{fmt(details.saldoSettledAmount)}</strong> mediante <strong>{payment.saldoMethod || "Efectivo"}</strong>.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <span>✓</span> Pago Completo (100%)
              </p>
              <p>
                El usuario <strong>{customerName}</strong> realizó el pago completo de la reserva por <strong>{fmt(details.paidInitial)}</strong>.
              </p>
            </div>
          )}

          {isAutoConfirmed && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-xl text-xs text-sky-800 dark:text-sky-300">
              <strong>🛡️ Cancha Asegurada Automáticamente:</strong> El usuario subió su comprobante y pasaron más de 2 horas sin auditar. Por favor valida el comprobante inicial para cerrar la auditoría.
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
              <p className="font-mono text-xs text-slate-700 dark:text-slate-300">{booking?.bookingReference || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Fecha de registro</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
              </p>
            </div>
          </div>

          {/* SECCIÓN FASE 1: Comprobante Inicial */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Fase 1: Comprobante y Abono Inicial
              </h4>
              {comprobanteBadge(payment.status, payment.autoConfirmed, payment.pendingAudit)}
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div>
                <p className="text-xs text-slate-500">Monto Abonado</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(payment.amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Método Usado</p>
                {methodBadge(payment.method)}
                <p className="text-[11px] text-slate-400 mt-0.5">{typeLabel(payment.type)}</p>
              </div>
            </div>

            {payment.comprobanteUrl && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Comprobante inicial adjunto</p>
                <div className="border rounded-xl overflow-hidden bg-white">
                  <img
                    src={payment.comprobanteUrl}
                    alt="Comprobante inicial"
                    className="w-full max-h-56 object-contain p-2"
                  />
                </div>
                <a
                  href={payment.comprobanteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <EyeIcon className="w-3.5 h-3.5" /> Ver imagen en pantalla completa
                </a>
              </div>
            )}

            {payment.confirmadoPor && (
              <p className="text-xs text-slate-400">Auditado por {payment.confirmadoPor.name}</p>
            )}

            {payment.motivoRechazo && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-xs text-red-700">
                <strong>Motivo de rechazo:</strong> {payment.motivoRechazo}
              </div>
            )}
          </div>

          {/* SECCIÓN FASE 2: Liquidación de Saldo Restante */}
          {details.isAdvance && !details.isComprobanteRejected && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${details.isSaldoPaid ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                  Fase 2: Liquidación de Saldo Restante
                </h4>
                {saldoBadge(details.isAdvance, details.isSaldoPaid, details.saldoFaltante, payment.saldoMethod)}
              </div>

              {details.isSaldoPaid ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    <div>
                      <p className="text-xs text-slate-500">Monto Saldo Liquidado</p>
                      <p className="text-lg font-bold text-emerald-600">{fmt(details.saldoSettledAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Método de Liquidación</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{payment.saldoMethod || "Efectivo"}</p>
                    </div>
                    {payment.saldoFechaConfirmacion && (
                      <div>
                        <p className="text-xs text-slate-500">Fecha de Liquidación</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          {format(new Date(payment.saldoFechaConfirmacion), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                    )}
                    {payment.saldoConfirmadoPor && (
                      <div>
                        <p className="text-xs text-slate-500">Cobrado / Liquidado por</p>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{payment.saldoConfirmadoPor.name}</p>
                      </div>
                    )}
                  </div>

                  {payment.saldoNotas && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs text-slate-600 dark:text-slate-400">
                      <strong>Notas:</strong> {payment.saldoNotas}
                    </div>
                  )}

                  {payment.saldoComprobanteUrl && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Comprobante de saldo</p>
                      <div className="border rounded-xl overflow-hidden bg-white max-h-40">
                        <img
                          src={payment.saldoComprobanteUrl}
                          alt="Comprobante saldo"
                          className="w-full max-h-40 object-contain p-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Saldo pendiente por cobrar:</p>
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmt(details.saldoFaltante)}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      onClick={() => {
                        onClose()
                        onOpenSettleModal(payment)
                      }}
                    >
                      <BanknoteIcon className="w-4 h-4" />
                      Cobrar Saldo
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Puedes registrar la cancelación del restante en efectivo, Yape, Plin, transferencia o POS.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Formulario de Rechazo */}
          {isAuditPending && showRejectInput && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Motivo del rechazo de comprobante</Label>
              <Textarea
                placeholder="Ej. El monto del comprobante no coincide, código de operación ilegible..."
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          )}
        </div>

        {/* Acciones de Auditoría Inicial */}
        {isAuditPending && (
          <DialogFooter className="flex gap-2 pt-3 border-t">
            {!showRejectInput ? (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50 flex-1"
                  onClick={() => setShowRejectInput(true)}
                  disabled={mutation.isPending}
                >
                  <XCircleIcon className="w-4 h-4 mr-1.5" />
                  Rechazar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  onClick={() => mutation.mutate({ action: "CONFIRMAR" })}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                  ) : (
                    <CheckCircle2Icon className="w-4 h-4 mr-1.5" />
                  )}
                  Aprobar Comprobante
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowRejectInput(false)} disabled={mutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => mutation.mutate({ action: "RECHAZAR", motivo: motivoRechazo })}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 mr-1.5" />
                  )}
                  Confirmar Rechazo
                </Button>
              </>
            )}
          </DialogFooter>
        )}
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
              Bandeja de Transacciones y Comprobantes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audita comprobantes iniciales y confirma la liquidación de saldos faltantes.
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
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Cancha & Horario</th>
                  <th className="px-4 py-3 text-left">Monto Abonado</th>
                  <th className="px-4 py-3 text-left">Saldo Faltante</th>
                  <th className="px-4 py-3 text-left">Comprobante Inicial</th>
                  <th className="px-4 py-3 text-left">Estado Saldo</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => {
                  const customer = p.booking?.customerInfo
                  const details = computePaymentDetails(p)
                  const isAuditRequired = details.isComprobantePending
                  const hasPendingBalance = details.isAdvance && !details.isSaldoPaid && !details.isComprobanteRejected

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                        isAuditRequired ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {customer?.name || p.user?.name || "—"}
                        </p>
                        <p className="text-xs text-slate-400">{customer?.email || p.user?.email || ""}</p>
                      </td>

                      {/* Cancha & Horario */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">
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

                      {/* Monto Abonado */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-emerald-600">{fmt(p.amount)}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {methodBadge(p.method)}
                          <span className="text-[10px] text-slate-400">• {details.isAdvance ? "Adelanto" : "Total"}</span>
                        </div>
                      </td>

                      {/* Saldo Faltante (Columna destacada) */}
                      <td className="px-4 py-3">
                        {details.isComprobanteRejected ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : !details.isAdvance ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-emerald-600">S/ 0.00</span>
                            <p className="text-[10px] text-emerald-600 font-medium">100% Pagado</p>
                          </div>
                        ) : details.isSaldoPaid ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-emerald-600">S/ 0.00</span>
                            <p className="text-[10px] text-emerald-600 font-medium">
                              ✓ Liquidado ({p.saldoMethod || "Efectivo"})
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {fmt(details.saldoFaltante)}
                            </span>
                            <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 px-1.5 py-0.2 rounded">
                              Falta cancelar
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Estado Comprobante Inicial */}
                      <td className="px-4 py-3">
                        {comprobanteBadge(p.status, p.autoConfirmed || p.booking?.autoConfirmed, p.pendingAudit || p.booking?.pendingAudit)}
                      </td>

                      {/* Estado Saldo */}
                      <td className="px-4 py-3">
                        {saldoBadge(details.isAdvance, details.isSaldoPaid, details.saldoFaltante, p.saldoMethod, details.isComprobanteRejected)}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(new Date(p.createdAt), "dd/MM HH:mm")}
                      </td>

                      {/* Acciones Inteligentes */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Auditar Comprobante (si está pendiente) */}
                          {isAuditRequired && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => openDetail(p)}
                            >
                              <ShieldCheckIcon className="w-3.5 h-3.5 mr-1" />
                              Auditar
                            </Button>
                          )}

                          {/* Botón Cobrar Restante (si es adelanto aprobado y falta saldo) */}
                          {!isAuditRequired && hasPendingBalance && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-semibold border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              onClick={() => openSettle(p)}
                            >
                              <BanknoteIcon className="w-3.5 h-3.5 mr-1" />
                              Cobrar Restante
                            </Button>
                          )}

                          {/* Botón Ver Detalle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => openDetail(p)}
                          >
                            <EyeIcon className="w-3.5 h-3.5 mr-1" />
                            Ver
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
      />

      {/* Modal de Cobro / Liquidación de Saldo Restante */}
      <SettleSaldoModal
        payment={settleTargetPayment}
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
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
