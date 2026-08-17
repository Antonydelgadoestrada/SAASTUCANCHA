"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarIcon,
  DownloadIcon,
  CalendarDaysIcon,
  SettingsIcon,
  MapPinIcon,
  BuildingIcon,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns"

import { ClubBookingsChart } from "./bookings-chart"
import { ClubPopularCourts, formatSoles } from "./popular-courts"
import { DateRange } from "react-day-picker"
import { getBookingsReportByClub, getCountByClub, getDailyStatsByClub, getDashboardSummary, getPopularCourtsByClub } from "@/lib/dashboard"

export function ClubDashboardContent() {
  const [stats, setStats] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>()
  const [countVenues, setCountVenues] = useState(0)
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
      const {venues,courts}  = await getCountByClub()
      setCountVenues(venues)
      setCountCourts(courts)
     }catch(error){
       toast.error('Error al cargar venues')
     }
    }
    fetchCounts()
  }, [])
  

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
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Club</h2>
          <p className="text-muted-foreground">Bienvenido al panel de control de tu club deportivo.</p>
        </div>
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
                      setDateRange(tempDateRange)
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
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer transition-colors hover:bg-muted/50">
          <Link href="/club/venues">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gestión de Sedes</CardTitle>
              <BuildingIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{countVenues}</div>
              <p className="text-xs text-muted-foreground">Sedes activas</p>
            </CardContent>
          </Link>
        </Card>
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
          <div className="grid gap-4 ">
            <Card className="">
              <CardHeader>
                <CardTitle>Reservas y Ingresos</CardTitle>
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
