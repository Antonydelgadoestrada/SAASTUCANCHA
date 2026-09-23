"use client"

import { useState, useEffect, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  CreditCardIcon,
  DollarSignIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
  SearchIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  FileSpreadsheetIcon,
  ExternalLinkIcon,
  InfoIcon,
  Building2Icon,
  ArrowUpRightIcon,
  ReceiptIcon,
  BadgeAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  getAdminMembershipPayments,
  AdminMembershipPaymentItem,
  AdminPaymentsSummary,
} from "@/lib/membership"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AdminPaymentsContent() {
  const [payments, setPayments] = useState<AdminMembershipPaymentItem[]>([])
  const [summary, setSummary] = useState<AdminPaymentsSummary>({
    totalPaidAmount: 0,
    monthPaidAmount: 0,
    totalTransactions: 0,
    paidCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    refundedCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [selectedPayment, setSelectedPayment] = useState<AdminMembershipPaymentItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = async (filterVal = statusFilter, searchVal = searchQuery) => {
    setIsLoading(true)
    try {
      const res = await getAdminMembershipPayments({
        status: filterVal === "ALL" ? undefined : filterVal,
        search: searchVal,
      })
      setPayments(res.payments || [])
      setSummary(res.summary || {
        totalPaidAmount: 0,
        monthPaidAmount: 0,
        totalTransactions: 0,
        paidCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        refundedCount: 0,
      })
    } catch (err: any) {
      console.error("Error al cargar pagos:", err)
      toast.error("Error al cargar historial de transacciones", {
        description: err?.response?.data?.message || err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(statusFilter, searchQuery)
  }, [statusFilter])

  // Filtrado local reactivo para agilidad inmediata
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments
    const q = searchQuery.toLowerCase().trim()
    return payments.filter(
      (p) =>
        p.clubName.toLowerCase().includes(q) ||
        p.clubEmail.toLowerCase().includes(q) ||
        (p.mpPaymentId && p.mpPaymentId.toLowerCase().includes(q)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q)
    )
  }, [payments, searchQuery])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    toast.success(`${label} copiado al portapapeles`)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const formatDateSafely = (dateStr?: string | null) => {
    if (!dateStr) return "N/A"
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy HH:mm", { locale: es })
    } catch (e) {
      return dateStr
    }
  }

  // Exportar a CSV para control contable
  const exportToCSV = () => {
    if (filteredPayments.length === 0) {
      toast.info("No hay transacciones para exportar")
      return
    }

    const headers = [
      "ID Transaccion",
      "Mercado Pago ID",
      "Club",
      "Email Club",
      "Plan",
      "Ciclo",
      "Monto",
      "Moneda",
      "Estado",
      "Metodo",
      "Fecha Pago",
      "Fecha Creacion",
    ]

    const rows = filteredPayments.map((p) => [
      p.id,
      p.mpPaymentId || "N/A",
      `"${p.clubName.replace(/"/g, '""')}"`,
      p.clubEmail,
      `"${p.planName.replace(/"/g, '""')}"`,
      p.interval,
      p.amount,
      p.currency,
      p.status,
      p.paymentMethod || "MP",
      p.paidAt ? formatDateSafely(p.paidAt) : "N/A",
      formatDateSafely(p.createdAt),
    ])

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `membresias_transacciones_${format(new Date(), "yyyyMMdd_HHmm")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Reporte CSV descargado correctamente")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCardIcon className="w-7 h-7 text-primary" />
            Gestor de Pagos de Membresías
          </h1>
          <p className="text-muted-foreground text-sm">
            Auditoría de todas las transacciones generadas por el cobro automático de membresías a clubes a través de Mercado Pago.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={filteredPayments.length === 0}
            className="flex items-center gap-2 shadow-xs"
          >
            <FileSpreadsheetIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(statusFilter, searchQuery)}
            disabled={isLoading}
            className="flex items-center gap-2 shadow-xs"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recaudado Membresías</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/. {summary.totalPaidAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.paidCount} transacciones aprobadas con éxito
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recaudación de Este Mes</CardTitle>
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/. {summary.monthPaidAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos del mes calendario en curso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Transacciones</CardTitle>
            <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalTransactions > 0
                ? `${Math.round((summary.paidCount / summary.totalTransactions) * 100)}% tasa de aprobación`
                : "Sin movimientos"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.rejectedCount} rechazados · {summary.refundedCount} reembolsados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador y Tabs de Filtrado */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por club, email, MP Payment ID o ID de transacción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <Tabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-full md:w-auto"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-auto h-auto p-1 gap-1">
              <TabsTrigger value="ALL" className="text-xs py-1.5 px-3">
                Todos ({summary.totalTransactions})
              </TabsTrigger>
              <TabsTrigger value="PAID" className="text-xs py-1.5 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                Aprobados ({summary.paidCount})
              </TabsTrigger>
              <TabsTrigger value="PENDING" className="text-xs py-1.5 px-3">
                Pendientes ({summary.pendingCount})
              </TabsTrigger>
              <TabsTrigger value="REJECTED" className="text-xs py-1.5 px-3">
                Rechazados ({summary.rejectedCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tabla de Transacciones */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[180px]">ID / MP Payment</TableHead>
                  <TableHead className="w-[240px]">Club Deportivo</TableHead>
                  <TableHead>Plan de Membresía</TableHead>
                  <TableHead>Monto Cobrado</TableHead>
                  <TableHead>Fecha de Pago</TableHead>
                  <TableHead>Pasarela / Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <RefreshCwIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Cargando transacciones de membresías...
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <CreditCardIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No se encontraron transacciones con los criterios seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => {
                    const isPaid = payment.status === "PAID"
                    const isPending = payment.status === "PENDING"
                    const isRejected = payment.status === "REJECTED"

                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        {/* ID y MP ID */}
                        <TableCell>
                          <div className="flex flex-col gap-1 font-mono text-xs">
                            {payment.mpPaymentId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">
                                  MP: {payment.mpPaymentId}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                  onClick={() => copyToClipboard(payment.mpPaymentId!, "ID de Mercado Pago")}
                                  title="Copiar MP Payment ID"
                                >
                                  {copiedId === payment.mpPaymentId ? (
                                    <CheckIcon className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <CopyIcon className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Sin ID MP</span>
                            )}
                            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={payment.id}>
                              Ref: {payment.id.substring(0, 8)}...
                            </span>
                          </div>
                        </TableCell>

                        {/* Club */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 border">
                              <AvatarImage src={payment.clubLogo || undefined} alt={payment.clubName} />
                              <AvatarFallback className="font-bold bg-primary/10 text-primary text-xs">
                                {payment.clubName.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col truncate">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {payment.clubName}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                {payment.clubEmail}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Plan */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">
                              {payment.planName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {payment.interval === "ANNUAL"
                                ? "Plan Anual"
                                : payment.interval === "SEMIANNUAL"
                                ? "Plan Semestral"
                                : "Plan Mensual"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Monto */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground">
                              S/. {Number(payment.amount).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {payment.currency}
                            </span>
                          </div>
                        </TableCell>

                        {/* Fecha */}
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {formatDateSafely(payment.paidAt || payment.createdAt)}
                            </span>
                            <span className="text-[10px]">
                              {payment.paidAt ? "Cobro confirmado" : "Creado"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Pasarela y Método */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className="text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                              Mercado Pago
                            </Badge>
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {payment.paymentType || payment.paymentMethod || "Automático"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Estado */}
                        <TableCell>
                          {isPaid && (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
                              <CheckCircle2Icon className="w-3 h-3" />
                              Aprobado
                            </Badge>
                          )}
                          {isPending && (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              Pendiente
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <XCircleIcon className="w-3 h-3" />
                              Rechazado
                            </Badge>
                          )}
                        </TableCell>

                        {/* Acción */}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs flex items-center gap-1"
                            onClick={() => {
                              setSelectedPayment(payment)
                              setIsDetailOpen(true)
                            }}
                          >
                            <InfoIcon className="w-3.5 h-3.5" />
                            Auditar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Auditoría de Transacción */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPayment && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                    <ReceiptIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      Transacción de Membresía
                      <Badge
                        className={
                          selectedPayment.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30"
                            : selectedPayment.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-700 border-amber-500/30"
                            : "bg-rose-500/20 text-rose-700 border-rose-500/30"
                        }
                      >
                        {selectedPayment.status}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      ID Interno: {selectedPayment.id}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Desglose principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="bg-muted/40 border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Detalle del Pago
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto:</span>
                        <span className="font-bold text-foreground">
                          S/. {Number(selectedPayment.amount).toFixed(2)} {selectedPayment.currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan:</span>
                        <span className="font-semibold text-foreground">
                          {selectedPayment.planName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ciclo:</span>
                        <span className="font-medium text-foreground">
                          {selectedPayment.interval}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha de Pago:</span>
                        <span className="font-medium text-foreground">
                          {formatDateSafely(selectedPayment.paidAt || selectedPayment.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/40 border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Datos del Club
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Club:</span>
                        <span className="font-semibold text-foreground">
                          {selectedPayment.clubName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium text-foreground truncate max-w-[180px]">
                          {selectedPayment.clubEmail}
                        </span>
                      </div>
                      {selectedPayment.clubDistrict && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Distrito:</span>
                          <span className="font-medium text-foreground">
                            {selectedPayment.clubDistrict}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Identificadores técnicos de pasarela */}
                <Card className="bg-muted/40 border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Datos de Mercado Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground font-sans">Payment ID (MP):</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-foreground">
                          {selectedPayment.mpPaymentId || "N/A"}
                        </span>
                        {selectedPayment.mpPaymentId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => copyToClipboard(selectedPayment.mpPaymentId!, "MP Payment ID")}
                          >
                            <CopyIcon className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground font-sans">Preference ID:</span>
                      <span className="text-foreground truncate max-w-[240px]">
                        {selectedPayment.mpPreferenceId || "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground font-sans">Order ID (MP):</span>
                      <span className="text-foreground">
                        {selectedPayment.mpMerchantOrderId || "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground font-sans">Tipo / Método:</span>
                      <span className="text-foreground font-sans font-medium">
                        {selectedPayment.paymentType || "N/A"} · {selectedPayment.paymentMethod || "N/A"}
                      </span>
                    </div>

                    {selectedPayment.comprobanteUrl && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground font-sans">Comprobante Adjunto:</span>
                        <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                          <a href={selectedPayment.comprobanteUrl} target="_blank" rel="noopener noreferrer">
                            Ver comprobante <ExternalLinkIcon className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Si existe payload de gatewayResponse, mostrar visor colapsado para soporte técnico */}
                {selectedPayment.gatewayResponse && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                      Respuesta del Gateway (Auditoría Técnica JSON)
                    </p>
                    <pre className="p-3 bg-zinc-950 text-zinc-100 rounded-md text-[11px] overflow-x-auto max-h-48 border font-mono">
                      {JSON.stringify(selectedPayment.gatewayResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setIsDetailOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
