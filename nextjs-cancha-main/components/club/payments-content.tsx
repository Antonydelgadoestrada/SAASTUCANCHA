"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  ArrowDownIcon,
  CheckCircleIcon,
  ClockIcon,
  FilterIcon,
  SearchIcon,
  XCircleIcon,
  EyeIcon,
  ArrowUpDownIcon
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

// Datos de ejemplo
const paymentsData = [
  {
    id: 1,
    user: "Juan Pérez",
    userEmail: "juan@ejemplo.com",
    court: "Cancha de Fútbol 5",
    venue: "Sede Central",
    date: new Date(2025, 5, 15),
    bookingDate: new Date(2025, 5, 15, 18, 0),
    amount: 35,
    status: "completed",
    paymentMethod: "credit_card",
    transactionId: "txn_123456789",
  },
  // ... otros objetos omitidos por brevedad
]

export function PaymentsContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const filteredPayments = paymentsData
    .filter((payment) => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        payment.user.toLowerCase().includes(searchLower) ||
        payment.court.toLowerCase().includes(searchLower) ||
        payment.venue.toLowerCase().includes(searchLower) ||
        payment.userEmail.toLowerCase().includes(searchLower)

      const matchesStatus = statusFilter === "all" || payment.status === statusFilter
      const matchesPaymentMethod = paymentMethodFilter === "all" || payment.paymentMethod === paymentMethodFilter

      return matchesSearch && matchesStatus && matchesPaymentMethod
    })
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.date.getTime() - b.date.getTime()
      } else {
        return b.date.getTime() - a.date.getTime()
      }
    })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="border-green-500 text-green-500">Completado</Badge>
      case "pending":
        return <Badge className="border-yellow-500 text-yellow-500">Pendiente</Badge>
      case "failed":
        return <Badge className="border-red-500 text-red-500">Fallido</Badge>
      case "refunded":
        return <Badge className="border-blue-500 text-blue-500">Reembolsado</Badge>
      default:
        return null
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-2xl font-bold">Pagos</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar pagos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FilterIcon className="h-4 w-4" />
                Filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="failed">Fallido</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Método de Pago</label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="credit_card">Tarjeta de crédito</SelectItem>
                      <SelectItem value="cash">Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left">Usuario</th>
              <th className="p-3 text-left">Cancha</th>
              <th className="p-3 text-left cursor-pointer" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>Fecha <ArrowUpDownIcon className="inline h-4 w-4 ml-1" /></th>
              <th className="p-3 text-left">Monto</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr><td className="p-4 text-center" colSpan={6}>No hay resultados</td></tr>
            ) : (
              filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-t">
                  <td className="p-3">{payment.user}</td>
                  <td className="p-3">{payment.court}</td>
                  <td className="p-3">{format(payment.date, "yyyy-MM-dd")}</td>
                  <td className="p-3">S/. {payment.amount}</td>
                  <td className="p-3">{getStatusBadge(payment.status)}</td>
                  <td className="p-3">
                    <Button size="sm" variant="ghost">
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
