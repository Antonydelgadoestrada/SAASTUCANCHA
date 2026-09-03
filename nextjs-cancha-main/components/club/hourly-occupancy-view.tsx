"use client"

import { useEffect, useState, useMemo } from "react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import {
  Flame,
  Snowflake,
  TrendingUp,
  DollarSign,
  Filter,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Info,
  Clock,
  RefreshCw,
  Tag,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getHourlyOccupancyDemand } from "@/lib/dashboard"

export function HourlyOccupancyView() {
  const [loading, setLoading] = useState(true)
  const [selectedSport, setSelectedSport] = useState<string>("all")
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all")
  const [timePreset, setTimePreset] = useState<string>("30days")
  const [data, setData] = useState<any>(null)
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)

  // Obtener fechas según preset
  const dateRange = useMemo(() => {
    const today = new Date()
    switch (timePreset) {
      case "7days":
        return {
          startDate: format(subDays(today, 7), "yyyy-MM-dd"),
          endDate: format(today, "yyyy-MM-dd"),
          label: "Últimos 7 días",
        }
      case "30days":
        return {
          startDate: format(subDays(today, 30), "yyyy-MM-dd"),
          endDate: format(today, "yyyy-MM-dd"),
          label: "Últimos 30 días",
        }
      case "60days":
        return {
          startDate: format(subDays(today, 60), "yyyy-MM-dd"),
          endDate: format(today, "yyyy-MM-dd"),
          label: "Últimos 60 días",
        }
      case "thisMonth":
        return {
          startDate: format(startOfMonth(today), "yyyy-MM-dd"),
          endDate: format(endOfMonth(today), "yyyy-MM-dd"),
          label: "Este Mes",
        }
      default:
        return {
          startDate: format(subDays(today, 30), "yyyy-MM-dd"),
          endDate: format(today, "yyyy-MM-dd"),
          label: "Últimos 30 días",
        }
    }
  }, [timePreset])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getHourlyOccupancyDemand({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sport: selectedSport === "all" ? undefined : selectedSport,
        courtId: selectedCourtId === "all" ? undefined : selectedCourtId,
      })
      setData(res)
    } catch (err) {
      console.error("Error fetching hourly demand:", err)
      toast.error("Error al cargar el análisis de horarios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateRange, selectedSport, selectedCourtId])

  // Helper de nombres de deportes capitalizados
  const formatSportName = (s: string) => {
    if (!s) return "Sin especificar"
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  }

  // Helper de colores para el Heatmap
  const getCellColor = (occupancyRate: number) => {
    if (occupancyRate >= 75) {
      return "bg-emerald-500 text-white font-bold border-emerald-600 shadow-sm"
    }
    if (occupancyRate >= 45) {
      return "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800"
    }
    if (occupancyRate >= 20) {
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800"
    }
    // Horario muerto
    return "bg-slate-100/70 dark:bg-slate-900/60 text-slate-400 border-slate-200 dark:border-slate-800 border-dashed"
  }

  const getCellBadge = (occupancyRate: number) => {
    if (occupancyRate >= 75) return "🔥 Pico"
    if (occupancyRate >= 45) return "⚡ Medio"
    if (occupancyRate >= 20) return "📉 Bajo"
    return "❄️ Muerto"
  }

  return (
    <div className="space-y-6">
      {/* Barra superior de Filtros Inteligentes */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border bg-card/60 backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Filter className="h-4 w-4 text-primary" />
            Filtros:
          </div>

          {/* Filtro por Deporte */}
          <div className="flex items-center gap-1.5">
            <Select value={selectedSport} onValueChange={(val) => { setSelectedSport(val); setSelectedCourtId("all"); }}>
              <SelectTrigger className="h-9 w-[180px] text-xs font-medium">
                <SelectValue placeholder="Deporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">⚽ Todos los Deportes</SelectItem>
                {data?.availableSports?.map((sport: string) => (
                  <SelectItem key={sport} value={sport}>
                    {formatSportName(sport)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Cancha */}
          <div className="flex items-center gap-1.5">
            <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
              <SelectTrigger className="h-9 w-[180px] text-xs font-medium">
                <SelectValue placeholder="Todas las Canchas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏟️ Todas las Canchas</SelectItem>
                {data?.filteredCourts?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.type ? `(${formatSportName(c.type)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Período */}
          <div className="flex items-center gap-1.5">
            <Select value={timePreset} onValueChange={setTimePreset}>
              <SelectTrigger className="h-9 w-[160px] text-xs font-medium">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 días</SelectItem>
                <SelectItem value="30days">Últimos 30 días</SelectItem>
                <SelectItem value="60days">Últimos 60 días</SelectItem>
                <SelectItem value="thisMonth">Este Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Ocupación Promedio */}
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ocupación Promedio
              </p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <div className="mt-2">
                <span className="text-2xl font-black text-foreground">
                  {data?.summary?.averageOccupancy ?? 0}%
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {data?.summary?.totalBookingsEvaluated ?? 0} reservas en {data?.summary?.courtCount ?? 1} cancha(s)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Horarios Muertos Identificados */}
        <Card className="border-l-4 border-l-slate-400 dark:border-l-slate-600 shadow-sm bg-slate-50/40 dark:bg-slate-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Horarios Muertos (&lt;20%)
              </p>
              <Snowflake className="h-4 w-4 text-sky-500" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <div className="mt-2">
                <span className="text-2xl font-black text-slate-700 dark:text-slate-200">
                  {data?.summary?.totalDeadHours ?? 0}
                  <span className="text-xs font-normal text-muted-foreground ml-1">horas / semana</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {data?.deadBlocks?.length ?? 0} bloques recurrentes vacíos
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Horarios Pico Identificados */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Horarios Pico (&ge;75%)
              </p>
              <Flame className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <div className="mt-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {data?.summary?.totalPeakHours ?? 0}
                  <span className="text-xs font-normal text-muted-foreground ml-1">horas / semana</span>
                </span>
                <p className="text-[11px] text-emerald-600/80 mt-0.5">
                  {data?.peakBlocks?.length ?? 0} franjas de alta demanda
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Oportunidad de Ingresos Estimada */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Oportunidad de Monetización
              </p>
              <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <div className="mt-2">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  S/ {data?.summary?.estimatedRevenueGain?.toLocaleString("es-PE", { minimumFractionDigits: 2 }) ?? "0.00"}
                </span>
                <p className="text-[11px] text-amber-700/80 mt-0.5">
                  Potencial llenando 30% de horas muertas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* HEATMAP SEMANAL DE OCUPACIÓN */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Mapa de Calor Semanal de Ocupación
              </CardTitle>
              <CardDescription className="text-xs">
                Muestra la saturación exacta por cada hora de la semana (Lunes a Domingo) para {selectedSport === "all" ? "todos los deportes" : formatSportName(selectedSport)}.
              </CardDescription>
            </div>

            {/* Leyenda de Colores */}
            <div className="flex items-center flex-wrap gap-2 text-[11px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 border-dashed" />
                <span className="text-muted-foreground">Muerto (&lt;20%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 border border-amber-300" />
                <span className="text-muted-foreground">Bajo (20-44%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-950 border border-sky-300" />
                <span className="text-muted-foreground">Medio (45-74%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pico (&ge;75%)</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !data?.matrix ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay datos disponibles para los filtros seleccionados.
            </div>
          ) : (
            <TooltipProvider delayDuration={100}>
              <div className="min-w-[700px]">
                {/* Cabecera de Días de la Semana */}
                <div className="grid grid-cols-8 gap-1.5 pb-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider border-b">
                  <div className="text-left font-semibold text-muted-foreground/70">Hora</div>
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                  <div>Dom</div>
                </div>

                {/* Filas de Horas (06:00 a 23:00) */}
                <div className="divide-y divide-border/40 pt-1">
                  {data.hoursRange?.map((hour: number) => {
                    const hourLabel = `${hour.toString().padStart(2, "0")}:00`
                    const nextHourLabel = `${(hour + 1).toString().padStart(2, "0")}:00`

                    return (
                      <div key={hour} className="grid grid-cols-8 gap-1.5 py-1 items-center">
                        {/* Etiqueta de Hora */}
                        <div className="text-xs font-mono font-medium text-muted-foreground">
                          {hourLabel}
                        </div>

                        {/* Celdas por Día (1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie, 6: Sáb, 0: Dom) */}
                        {data.daysOrder?.map((day: number) => {
                          const cell = data.matrix[day]?.[hour] || {
                            bookingsCount: 0,
                            revenue: 0,
                            capacity: 1,
                            occupancyRate: 0,
                            status: "DEAD",
                          }
                          const dayName = data.daysNameMap[day]

                          return (
                            <Tooltip key={day}>
                              <TooltipTrigger asChild>
                                <div
                                  onMouseEnter={() => setHoveredCell({ day, hour })}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  className={`h-9 rounded-lg border flex items-center justify-center text-xs cursor-pointer transition-all duration-150 hover:scale-105 hover:z-10 hover:shadow-md ${getCellColor(
                                    cell.occupancyRate
                                  )}`}
                                >
                                  <span className="text-[11px]">
                                    {cell.occupancyRate > 0 ? `${cell.occupancyRate}%` : "—"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="p-3 text-xs space-y-1.5 shadow-xl max-w-xs">
                                <div className="font-bold flex items-center justify-between border-b pb-1">
                                  <span>{dayName} {hourLabel} - {nextHourLabel}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      cell.occupancyRate >= 75
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : cell.occupancyRate < 20
                                        ? "bg-slate-100 text-slate-700"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {getCellBadge(cell.occupancyRate)}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
                                  <div>
                                    <span className="text-muted-foreground">Ocupación: </span>
                                    <strong className="text-foreground">{cell.occupancyRate}%</strong>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Reservas: </span>
                                    <strong className="text-foreground">{cell.bookingsCount}</strong>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Ingresos: </span>
                                    <strong className="text-emerald-600 font-semibold">
                                      S/ {cell.revenue?.toFixed(2)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Capacidad: </span>
                                    <span>{cell.capacity} turnos</span>
                                  </div>
                                </div>
                                {cell.occupancyRate < 20 && (
                                  <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-200 dark:border-amber-900 mt-1">
                                    💡 <em>Sugerencia:</em> Franja vacía. Considera habilitar precio promocional para captar clientes.
                                  </p>
                                )}
                                {cell.occupancyRate >= 75 && (
                                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-900 mt-1">
                                    🔥 <em>Alta demanda:</em> Puedes exigir 100% de pago o adelanto estricto.
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* DIAGNÓSTICO Y RECOMENDACIONES DE MONETIZACIÓN */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lista de Horarios Muertos Recurrentes */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-sky-500" />
              Horarios Muertos Recurrentes (Oportunidades de Promoción)
            </CardTitle>
            <CardDescription className="text-xs">
              Franjas horarias que consistentemente quedan vacías en tu club.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !data?.deadBlocks || data.deadBlocks.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                🎉 ¡Excelente! No se detectaron horarios muertos recurrentes con los filtros actuales.
              </div>
            ) : (
              data.deadBlocks.map((block: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      📅 {block.timeRange}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300">
                      {block.avgOccupancy}% ocupación
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {block.suggestion}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Capacidad ociosa: ~{block.lostSlotsEstimate} turnos
                    </span>
                    <Button variant="ghost" size="sm" asChild className="h-6 text-[11px] text-primary p-0 hover:bg-transparent">
                      <Link href="/club/schedules">
                        Configurar precio promo <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Lista de Horarios Pico */}
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-600" />
              Horarios Pico (Mayor Demanda &amp; Rentabilidad)
            </CardTitle>
            <CardDescription className="text-xs">
              Franjas de alta concurrencia donde maximizar precio y asegurar pagos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !data?.peakBlocks || data.peakBlocks.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No se detectaron horarios pico con más del 70% de ocupación en este período.
              </div>
            ) : (
              data.peakBlocks.map((block: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                      🔥 {block.timeRange}
                    </span>
                    <Badge className="text-[10px] bg-emerald-600 text-white hover:bg-emerald-700">
                      {block.avgOccupancy}% ocupación
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                    {block.suggestion}
                  </p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Ingresos generados: S/ {block.totalRevenue?.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
