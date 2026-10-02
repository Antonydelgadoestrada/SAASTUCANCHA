"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, DownloadIcon, ArrowRightIcon, ArrowLeftIcon, ReceiptIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getTransactions, getTransactionMetrics } from "@/lib/transactions"
import { Skeleton } from "@/components/ui/skeleton"

export function TransactionsContent() {
  const [page, setPage] = useState(1)
  const limit = 10

  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['transaction-metrics'],
    queryFn: () => getTransactionMetrics(),
  })

  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', page, limit],
    queryFn: () => getTransactions(page, limit),
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge className="bg-green-500">Aprobado</Badge>
      case 'PENDING': return <Badge variant="secondary">Pendiente</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rechazado</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'RESERVATION_FULL': return 'Reserva (Completo)'
      case 'RESERVATION_ADVANCE': return 'Reserva (Adelanto)'
      case 'RESERVATION_BALANCE': return 'Reserva (Saldo)'
      case 'MEMBERSHIP_PAYMENT': return 'Membresía Club'
      default: return cat
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ReceiptIcon className="w-8 h-8" />
          Transacciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial detallado de cobros, comisiones y liquidaciones.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ingresos Brutos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(metricsData?.totalIngresosBrutos || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total recibido antes de comisiones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-red-500">Comisiones MP</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-red-500">-{formatCurrency(metricsData?.totalComisiones || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Costos de procesamiento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-green-600">Ingresos Netos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetrics ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metricsData?.totalIngresosNetos || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Dinero real percibido</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Movimientos</CardTitle>
          <CardDescription>Visualiza y filtra todas las transacciones generadas en tu club.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : txData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No hay transacciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  txData?.data.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {tx.occurredAt ? format(new Date(tx.occurredAt), "dd MMM yyyy, HH:mm", { locale: es }) : format(new Date(tx.submittedAt || new Date()), "dd MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{getCategoryLabel(tx.category)}</span>
                          <span className="text-xs text-muted-foreground">{tx.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="capitalize">{tx.paymentMethod.toLowerCase()}</span>
                          <span className="text-xs text-muted-foreground">{tx.origin}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(tx.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        {tx.feeAmount > 0 ? `-${formatCurrency(tx.feeAmount)}` : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${tx.direction === 'OUT' ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.direction === 'OUT' ? '-' : ''}{formatCurrency(tx.netAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {txData && txData.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <div className="text-sm text-muted-foreground">
                Página {page} de {txData.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(txData.totalPages, p + 1))}
                disabled={page === txData.totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
