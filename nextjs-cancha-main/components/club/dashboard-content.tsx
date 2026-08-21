"use client"

import { useEffect, useState, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarIcon,
  DownloadIcon,
  CalendarDaysIcon,
  SettingsIcon,
  MapPinIcon,
  PlusCircleIcon,
  ClockIcon,
  CreditCardIcon,
  TrophyIcon,
  ArrowRightIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns"

import { ClubBookingsChart } from "./bookings-chart"
import { ClubPopularCourts, formatSoles } from "./popular-courts"
import { DateRange } from "react-day-picker"
import { getBookingsReportByClub, getCountByClub, getDailyStatsByClub, getDashboardSummary, getPopularCourtsByClub } from "@/lib/dashboard"
import { getAllReservation } from "@/lib/reservation"
import { getAllCourtsByClub } from "@/lib/courts"
import { listCourtScheduleEvents } from "@/lib/schedule"

// --- Helpers de traducción ---
const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
}
const paymentStatusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  refunded: "bg-purple-100 text-purple-800",
}
const statusLabels: Record<string, string> = {
  confirmed: "Confirmada",
  pending: "Pendiente",
  cancelled: "Cancelada",
  completed: "Completada",
}
const paymentLabels: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  refunded: "Reembolsado",
}
const recurrenceLabels: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  custom: "Personalizado",
}

export function ClubDashboardContent() {
  const [stats, setStats] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>()

  const [countCourts, setCountCourts] = useState(0)
  const [summary, setSummary] = useState({revenue: "1", bookings: "1"})
  const [popularCourts, setPopularCourts] = useState([])
  const [report, setReport] = useState([])
  
  const [timeRange, setTimeRange] = useState("week")
  const [activeTab, setActiveTab] = useState("overview")
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })
  const [isCustomDate, setIsCustomDate] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // --- Nuevos estados para Próximas Reservas y Eventos ---
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [isReservationsLoading, setIsReservationsLoading] = useState(true)
  const [isEventsLoading, setIsEventsLoading] = useState(true)

  // Función para exportar datos a CSV
  const exportToCSV = () => {
    setIsLoading(true)
    const data:any[] = report;
    if (data.length > 0) {
      // Convertir a CSV
      const headers = Object.keys(data[0]).join(",")
      const rows = data.map((item) => Object.values(item).join(","))
      const csv = [headers, ...rows].join("\n")

      // Crear y descargar el archivo
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const filename = `report_tucancha_${format(new Date(), "yyyy-MM-dd-HH-mm-ss")}.csv`

      link.setAttribute("href", url)
      link.setAttribute("download", `${filename}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`Reporte exportado correctamente`)
    } else {
      toast.error("No reporte para exportar")
    }

    setIsLoading(false)
  }

  const getDateRangeFromTimeRange = (range: string): { from: Date; to: Date } | null => {
    const today = new Date()
    switch (range) {
      case "day":
        return { from: subDays(today, 1), to: today }
      case "week":
        return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) }
      case "month":
        return { from: startOfMonth(today), to: endOfMonth(today) }
      case "year":
        return { from: startOfYear(today), to: endOfYear(today) }
      default:
        return null
    }
  }
  const fetchStats = async (from: Date, to: Date) => {
    // Aquí llama tu API real
    const startDate = format(from, "yyyy-MM-dd", { locale: es })
    const endDate = format(to, "yyyy-MM-dd", { locale: es })
    const range = {startDate, endDate}
    const popularCourtsResult = await getPopularCourtsByClub(range)
    const statsResult = await getDailyStatsByClub(range)
    const summaryResult = await getDashboardSummary(range)
    const reportResult = await getBookingsReportByClub(range)
    setStats(statsResult)
    setSummary(summaryResult)
    setPopularCourts(popularCourtsResult)
    setReport(reportResult)
  }
  
  useEffect(() => {
    if (timeRange !== "custom") {
      const range = getDateRangeFromTimeRange(timeRange)
      if (range) {
        fetchStats(range.from, range.to)
      }
    }
  }, [timeRange])
  useEffect(() => {
    const fetchCounts = async ()=>{
     try{
      const {courts}  = await getCountByClub()
      setCountCourts(courts)
     }catch(error){
       toast.error('Error al cargar canchas')
     }
    }
    fetchCounts()
  }, [])

  // --- Cargar Reservas y Eventos al montar ---
  useEffect(() => {
    const fetchReservations = async () => {
      setIsReservationsLoading(true)
      try {
        const res = await getAllReservation()
        setAllReservations(Array.isArray(res) ? res : [])
      } catch (err) {
        console.error("Error al cargar reservas para dashboard:", err)
      } finally {
        setIsReservationsLoading(false)
      }
    }

    const fetchEvents = async () => {
      setIsEventsLoading(true)
      try {
        const courts = await getAllCourtsByClub()
        const allEvts: any[] = []
        for (const court of courts) {
          try {
            const events = await listCourtScheduleEvents(court.id)
            if (Array.isArray(events)) {
              allEvts.push(...events.map((e: any) => ({ ...e, courtName: court.name })))
            }
          } catch {
            // Ignore individual court errors
          }
        }
        setAllEvents(allEvts)
      } catch (err) {
        console.error("Error al cargar eventos para dashboard:", err)
      } finally {
        setIsEventsLoading(false)
      }
    }

    fetchReservations()
    fetchEvents()
  }, [])

  // --- Próximas Reservas: filtradas y ordenadas ---
  const upcomingReservations = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return allReservations
      .filter((r) => {
        const d = new Date(r.date)
        d.setHours(0, 0, 0, 0)
        return d >= today && r.status !== "cancelled"
      })
      .sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
        if (dateCompare !== 0) return dateCompare
        return (a.startTime || "").localeCompare(b.startTime || "")
      })
      .slice(0, 10)
  }, [allReservations])

  // --- Eventos activos ---
  const activeEvents = useMemo(() => {
    return allEvents.filter((e) => e.isActive !== false)
  }, [allEvents])
  

  // Manejar cambio de rango de fechas
  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    if (range.from && range.to) {
      setIsCustomDate(true)
      setTimeRange("custom")
    }
  }
  // Manejar cambio de rango predefinido
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    if (value !== "custom") {
      setIsCustomDate(false)
      setDateRange({ from: undefined, to: undefined })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Cabecera y Resumen */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Resumen general de tu club deportivo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md">
            <Link href="/club/schedules">
              <CalendarIcon className="mr-2 h-4 w-4" /> Ver Horarios
            </Link>
          </Button>
          <Button asChild className="bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all duration-300 hover:shadow-md">
            <Link href="/club/bookings">
              <PlusCircleIcon className="mr-2 h-4 w-4" /> Nueva Reserva
            </Link>
          </Button>
        </div>
      </div>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de rango predefinido */}
          {/* isPopoverOpen */}
          <Select value={timeRange} onValueChange={handleTimeRangeChange} disabled={isPopoverOpen}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {/* Selector de rango personalizado */}

          <Popover open={isPopoverOpen} onOpenChange={(open) => {
            // Solo permitir cerrar desde los botones "Limpiar" o "Aplicar"
            if (open) {
              setIsPopoverOpen(true)

            }
            // No hacer nada al cerrar desde fuera
          }}>
            <PopoverTrigger asChild>
              <Button
                disabled={timeRange !== "custom"}
                variant="outline"
                className={`w-[240px] justify-start text-left font-normal ${
                  !dateRange.from && !isCustomDate ? "text-muted-foreground" : ""
                }`}
              >
                <CalendarDaysIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                  </>
                ) : (
                  <span>Seleccionar fechas</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={tempDateRange}
                onSelect={(range) => {
                  if (range) {
                    setTempDateRange(range)
                  }
                }}
                numberOfMonths={1}
                locale={es}
              />
              <div className="flex items-center justify-between border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange({ from: undefined, to: undefined })
                    setTempDateRange({ from: undefined, to: undefined })
                    setIsCustomDate(false)
                    setTimeRange("custom")
                    setIsPopoverOpen(false)
                  }}
                >
                  Limpiar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPopoverOpen(false)
                  }}
                >
                  Cerrar
                </Button>
                <Button
                  disabled={!(tempDateRange?.from && tempDateRange?.to)}
                  size="sm"
                  onClick={() => {
                    if (tempDateRange && tempDateRange?.from && tempDateRange?.to) {
                      setDateRange({ from: tempDateRange.from, to: tempDateRange.to })
                      setIsCustomDate(true)
                      setTimeRange("custom")
                      fetchStats(tempDateRange.from, tempDateRange.to)
                      setIsPopoverOpen(false)
                    }
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>

        </div>
      </section>

      {/* Mostrar el rango de fechas seleccionado */}
      {isCustomDate && dateRange.from && dateRange.to && (
        <div className="flex items-center">
          <Badge variant="outline" className="text-sm">
            Mostrando datos desde {format(dateRange.from, "d 'de' MMMM, yyyy", { locale: es })} hasta{" "}
            {format(dateRange.to, "d 'de' MMMM, yyyy", { locale: es })}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-6 w-6 p-0"
            onClick={() => {
              setDateRange({ from: undefined, to: undefined })
              setTempDateRange({ from: undefined, to: undefined })
              setIsCustomDate(false)
              setTimeRange("custom")
            }}
          >
            <span className="sr-only">Limpiar filtro</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>
      )}

      {/* Accesos rápidos a mantenimiento */}
      <section className="grid gap-4 md:grid-cols-2">

        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/club/courts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gestión de Canchas</CardTitle>
              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{countCourts}</div>
              <p className="text-xs text-muted-foreground">Canchas disponibles</p>
            </CardContent>
          </Link>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/club/schedules">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Configuración</CardTitle>
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <SettingsIcon className="h-6 w-6" />
              </div>
              <p className="text-xs text-muted-foreground">Horarios y precios</p>
            </CardContent>
          </Link>
        </Card>
      </section>

      {/* Estadísticas resumidas */}
      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              {/* <DollarSignIcon className="h-4 w-4 text-muted-foreground" /> */}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatSoles(+summary.revenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservas Totales</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.bookings}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ====== PRÓXIMAS RESERVAS ====== */}
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Próximas Reservas</CardTitle>
              <CardDescription>Reservas de hoy en adelante ordenadas por fecha y hora</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/club/bookings">
                Ver todas <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isReservationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-3 w-[180px]" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : upcomingReservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No hay reservas próximas</p>
                <p className="text-sm text-muted-foreground mt-1">Las nuevas reservas aparecerán aquí automáticamente</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/club/bookings">
                    <PlusCircleIcon className="mr-2 h-4 w-4" /> Crear Reserva
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Tabla escritorio */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente/Reserva</TableHead>
                        <TableHead>Cancha</TableHead>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingReservations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.customerInfo?.name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground">{r.customerInfo?.email || ""}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.court?.name || "N/A"}</div>

                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {format(new Date(r.date), "EEE d MMM", { locale: es })}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {r.startTime} - {r.endTime}
                            </div>
                          </TableCell>
                          <TableCell>{r.duration} {r.duration === 1 ? "hora" : "horas"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[r.status] || "bg-gray-100 text-gray-800"}>
                              {statusLabels[r.status] || r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={paymentStatusColors[r.paymentStatus] || "bg-gray-100 text-gray-800"}>
                              {paymentLabels[r.paymentStatus] || r.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            S/ {r.pricing?.totalPrice || r.price || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Tarjetas móvil */}
                <div className="md:hidden space-y-3">
                  {upcomingReservations.map((r) => (
                    <div key={r.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">{r.customerInfo?.name || "N/A"}</span>
                        </div>
                        <Badge className={statusColors[r.status] || "bg-gray-100"}>
                          {statusLabels[r.status] || r.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.court?.name}</div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono">{format(new Date(r.date), "EEE d MMM", { locale: es })} · {r.startTime} - {r.endTime}</span>
                        <Badge className={paymentStatusColors[r.paymentStatus] || "bg-gray-100"}>
                          {paymentLabels[r.paymentStatus] || r.paymentStatus}
                        </Badge>
                      </div>
                      <div className="text-right text-sm font-bold text-primary">S/ {r.pricing?.totalPrice || 0}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ====== PRÓXIMOS EVENTOS ====== */}
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Eventos Activos</CardTitle>
              <CardDescription>Alquileres recurrentes y academias registradas en tus canchas</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/club/schedules">
                Gestionar <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isEventsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <Skeleton className="h-5 w-[200px]" />
                    <Skeleton className="h-3 w-[140px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                ))}
              </div>
            ) : activeEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <TrophyIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No hay eventos activos</p>
                <p className="text-sm text-muted-foreground mt-1">Crea eventos recurrentes para academias u organizaciones</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/club/schedules">
                    <PlusCircleIcon className="mr-2 h-4 w-4" /> Crear Evento
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeEvents.map((evt) => (
                  <div key={evt.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-primary">{evt.name}</span>
                      <Badge variant="outline" className="text-purple-600 border-purple-300">
                        {recurrenceLabels[evt.recurrenceType] || evt.recurrenceType}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      🏟️ {evt.courtName}
                    </div>
                    {evt.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{evt.description}</div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs text-muted-foreground">Costo de alquiler</span>
                      <span className="font-bold text-purple-600">
                        {evt.price ? `S/ ${evt.price}` : "S/ 0.00"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Sección de exportación de datos */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-medium">Exportar Datos</h3>
            <p className="text-sm text-muted-foreground">Descarga los datos de tu club en formato CSV</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV()} disabled={isLoading}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Reporte
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 lg:col-span-4 shadow-sm border-0 ring-1 ring-border/50">
              <CardHeader>
                <CardTitle>Ingresos Estimados (Mensual)</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <ClubBookingsChart data={stats} />
              </CardContent>
            </Card>
          
          </div>
       
          <div className="grid gap-4 ">
            <Card className="">
              <CardHeader>
                <CardTitle>Canchas Populares</CardTitle>
              </CardHeader>
              <CardContent>
                <ClubPopularCourts popularCourts={popularCourts}/>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
