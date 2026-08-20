"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  DollarSignIcon, CreditCardIcon, SmartphoneIcon, ClockIcon,
  CheckCircle2Icon, XCircleIcon, EyeIcon, RefreshCwIcon,
  SearchIcon, ChevronDownIcon, ReceiptIcon,
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
  PaymentItem, PaymentMetrics,
} from "@/lib/payments"
import { PaymentSettingsTab } from "@/components/club/payment-settings-tab"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number) {
  return `S/ ${val.toFixed(2)}`
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    PENDIENTE: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-300" },
    PENDING:   { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-300" },
    CONFIRMADO:{ label: "Confirmado", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    PAID:      { label: "Confirmado", className: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    RECHAZADO: { label: "Rechazado", className: "bg-red-100 text-red-700 border-red-300" },
    REJECTED:  { label: "Rechazado", className: "bg-red-100 text-red-700 border-red-300" },
  }
  const v = map[status] || { label: status, className: "bg-slate-100 text-slate-600 border-slate-300" }
  return <Badge variant="outline" className={`${v.className} font-medium text-xs`}>{v.label}</Badge>
}

function methodBadge(method: string) {
  const map: Record<string, { label: string; color: string }> = {
    MERCADOPAGO:   { label: "Mercado Pago", color: "text-blue-600" },
    YAPE:          { label: "Yape", color: "text-purple-600" },
    PLIN:          { label: "Plin", color: "text-teal-600" },
    TRANSFERENCIA: { label: "Transferencia", color: "text-indigo-600" },
    EFECTIVO:      { label: "Efectivo", color: "text-green-700" },
  }
  const v = map[method] || { label: method, color: "text-slate-500" }
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

// ─── Modal de detalle y auditoría de pago ────────────────────────────────────

function PaymentDetailModal({
  payment, open, onClose,
}: { payment: PaymentItem | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ action, motivo }: { action: "CONFIRMAR" | "RECHAZAR"; motivo?: string }) =>
      confirmManualPayment(payment!.id, action, motivo),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
      queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
      toast.success(vars.action === "CONFIRMAR" ? "Pago confirmado ✓" : "Pago rechazado")
      setShowRejectInput(false)
      setMotivoRechazo("")
      onClose()
    },
    onError: (err: any) => {
      toast.error("Error al procesar", { description: err.response?.data?.message || err.message })
    },
  })

  if (!payment) return null

  const isPending = payment.status === "PENDIENTE" || payment.status === "PENDING"
  const booking = payment.booking
  const customer = booking?.customerInfo

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-emerald-600" />
            Detalle de Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Info de reserva */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Cliente</p>
              <p className="font-semibold">{customer?.name || payment.user?.name || "—"}</p>
              <p className="text-xs text-slate-500">{customer?.email || payment.user?.email || ""}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Cancha</p>
              <p className="font-semibold">{booking?.court?.name || "—"}</p>
              {booking?.date && (
                <p className="text-xs text-slate-500">
                  {format(new Date(booking.date), "dd/MM/yyyy")} {booking.startTime?.slice(0,5)} - {booking.endTime?.slice(0,5)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Código de reserva</p>
              <p className="font-mono text-xs">{booking?.bookingReference || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Fecha de pago</p>
              <p className="text-xs">{format(new Date(payment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
            </div>
          </div>

          {/* Monto y método */}
          <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Monto</p>
              <p className="text-2xl font-bold text-emerald-600">{fmt(payment.amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-0.5">Método</p>
              {methodBadge(payment.method)}
              <p className="text-xs text-slate-500 mt-1">{payment.type}</p>
            </div>
          </div>

          {/* Comprobante */}
          {payment.comprobanteUrl && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Comprobante adjunto</p>
              <div className="border rounded-xl overflow-hidden">
                <img
                  src={payment.comprobanteUrl}
                  alt="Comprobante de pago"
                  className="w-full max-h-64 object-contain bg-white p-2"
                />
              </div>
              <a
                href={payment.comprobanteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <EyeIcon className="w-3 h-3" /> Ver en pantalla completa
              </a>
            </div>
          )}

          {/* Estado actual */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Estado:</p>
            {statusBadge(payment.status)}
            {payment.confirmadoPor && (
              <p className="text-xs text-slate-400 ml-auto">Auditado por {payment.confirmadoPor.name}</p>
            )}
          </div>

          {/* Motivo de rechazo */}
          {payment.motivoRechazo && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-xs text-red-700">
              <strong>Motivo de rechazo:</strong> {payment.motivoRechazo}
            </div>
          )}

          {/* Acciones de auditoría */}
          {isPending && (
            <>
              {showRejectInput && (
                <div className="space-y-2">
                  <Label className="text-xs">Motivo del rechazo (opcional)</Label>
                  <Textarea
                    placeholder="Ej. El monto no coincide, QR incorrecto..."
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {isPending && (
          <DialogFooter className="flex gap-2 pt-2">
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
                  {mutation.isPending
                    ? <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                    : <CheckCircle2Icon className="w-4 h-4 mr-1.5" />}
                  Confirmar Pago
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
                  {mutation.isPending
                    ? <span className="animate-spin mr-1.5 border-2 border-white border-t-transparent rounded-full w-4 h-4 inline-block" />
                    : <XCircleIcon className="w-4 h-4 mr-1.5" />}
                  Confirmar rechazo
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["club-payment-metrics"] })
    queryClient.invalidateQueries({ queryKey: ["club-payments-list"] })
    toast.info("Datos actualizados")
  }

  const openDetail = (p: PaymentItem) => {
    setSelectedPayment(p)
    setDetailOpen(true)
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
          sub={`Yape: ${fmt(metrics?.desgloseMetodos?.yape ?? 0)} | Plin: ${fmt(metrics?.desgloseMetodos?.plin ?? 0)}`}
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
            placeholder="Buscar cliente, cancha o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
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
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="ADELANTO">Adelanto</SelectItem>
            <SelectItem value="SALDO">Saldo</SelectItem>
            <SelectItem value="PAGO_COMPLETO">Pago Completo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bandeja de Transacciones */}
      <div className="rounded-xl border overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            Bandeja de Transacciones y Comprobantes
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {payments.length} registro{payments.length !== 1 ? "s" : ""} encontrado{payments.length !== 1 ? "s" : ""}
          </p>
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
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Cancha</th>
                  <th className="px-4 py-3 text-left">Monto</th>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((p) => {
                  const customer = p.booking?.customerInfo
                  const isPending = p.status === "PENDIENTE" || p.status === "PENDING"
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${isPending ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {customer?.name || p.user?.name || "—"}
                        </p>
                        <p className="text-xs text-slate-400">{customer?.email || p.user?.email || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {p.booking?.court?.name || "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">
                        {fmt(p.amount)}
                      </td>
                      <td className="px-4 py-3">{methodBadge(p.method)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{p.type}</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(new Date(p.createdAt), "dd/MM HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-3 text-xs font-medium ${isPending ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" : "text-slate-500"}`}
                          onClick={() => openDetail(p)}
                        >
                          <EyeIcon className="w-3.5 h-3.5 mr-1" />
                          {isPending ? "Auditar" : "Ver"}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
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
            Audita comprobantes de Yape/Plin, monitorea ingresos de Mercado Pago y gestiona saldos en tiempo real.
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
