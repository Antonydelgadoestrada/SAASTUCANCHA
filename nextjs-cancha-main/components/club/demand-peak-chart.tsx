"use client"

import { useEffect, useState } from "react"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"
import {
  Flame,
  Snowflake,
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  CalendarDays,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDemandTrendStats } from "@/lib/dashboard"
import { toast } from "sonner"

interface DemandPeakChartProps {
  courts?: any[]
}

export function DemandPeakChart({ courts = [] }: DemandPeakChartProps) {
  const [startDate, setStartDate] = useState<string>(() =>
    format(subDays(new Date(), 6), "yyyy-MM-dd")
  )
  const [endDate, setEndDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd")
  )
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all")
  const [loading, setLoading] = useState<boolean>(true)
  const [trendData, setTrendData] = useState<any>(null)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await getDemandTrendStats({
        startDate,
        endDate,
        courtId: selectedCourtId === "all" ? undefined : selectedCourtId,
      })
      setTrendData(res)
    } catch (err) {
      console.error("Error al cargar tendencia de demanda:", err)
      toast.error("Error al cargar la curva de picos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate, selectedCourtId])

  const availableCourts = trendData?.courts || courts || []

  // Custom Tooltip estilizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload
      const isPeak =
        trendData?.summary?.peakPoint &&
        trendData.summary.peakPoint.label === dataPoint?.name &&
        dataPoint?.ingresos > 0
      const isValley =
        trendData?.summary?.valleyPoint &&
        trendData.summary.valleyPoint.label === dataPoint?.name

      return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              {dataPoint?.label || label}
            </span>
            {isPeak && (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] px-1.5 py-0 h-4">
                🔥 Pico Máximo
              </Badge>
            )}
            {isValley && !isPeak && (
              <Badge variant="outline" className="text-slate-400 border-slate-600 text-[10px] px-1.5 py-0 h-4">
                ❄️ Horario Valle
              </Badge>
            )}
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-orange-400 flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" />
                Ingresos Recaudados:
              </span>
              <strong className="text-orange-300 font-mono text-sm">
                S/ {Number(dataPoint?.ingresos || 0).toFixed(2)}
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                Turnos Reservados:
              </span>
              <strong className="text-emerald-300 font-mono text-sm">
                {dataPoint?.reservas || 0} {dataPoint?.reservas === 1 ? "reserva" : "reservas"}
              </strong>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3 border-b space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Curva de Demanda e Ingresos (Diagrama de Picos y Valles)
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Analiza la evolución de recaudación y reservas para detectar franjas pico y horarios de baja concurrencia.
            </CardDescription>
          </div>

          {/* Filtros de Fecha Inicial, Fecha Final, Accesos Rápidos y Canchas */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Fecha Inicial */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Fecha Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-2.5 py-1 text-xs rounded-lg border border-input bg-background font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
              />
            </div>

            {/* Fecha Final */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Fecha Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 px-2.5 py-1 text-xs rounded-lg border border-input bg-background font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
              />
            </div>

            {/* Selector de Canchas */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cancha
              </label>
              <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                <SelectTrigger className="h-9 w-[180px] text-xs font-medium">
                  <SelectValue placeholder="Todas las Canchas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏟️ Todas las Canchas</SelectItem>
                  {availableCourts.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.type ? `(${c.type})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={fetchStats}
              disabled={loading}
              title="Actualizar datos"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Tarjetas resumen del gráfico */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40">
            <span className="text-[11px] text-orange-700 dark:text-orange-300 font-semibold flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" /> Total Recaudado
            </span>
            <p className="text-base font-bold text-orange-600 dark:text-orange-400 mt-0.5">
              S/ {trendData?.summary?.totalRevenue?.toFixed(2) ?? "0.00"}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Reservas Totales
            </span>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {trendData?.summary?.totalBookings ?? 0} turnos
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> Pico Máximo
            </span>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-0.5 truncate">
              {trendData?.summary?.peakPoint && trendData.summary.peakPoint.ingresos > 0 ? (
                <>
                  {trendData.summary.peakPoint.label} (S/ {trendData.summary.peakPoint.ingresos})
                </>
              ) : (
                "Sin reservas aún"
              )}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Snowflake className="h-3.5 w-3.5 text-sky-400" /> Horario / Día Valle
            </span>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
              {trendData?.summary?.valleyPoint ? (
                <>
                  {trendData.summary.valleyPoint.label} (S/ {trendData.summary.valleyPoint.ingresos})
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="h-[320px] flex items-center justify-center">
            <div className="space-y-3 w-full">
              <Skeleton className="h-[260px] w-full rounded-xl" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ) : !trendData?.series || trendData.series.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-xs">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p>No se encontraron datos registrados para el período seleccionado.</p>
          </div>
        ) : (
          <div className="h-[330px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData.series}
                margin={{
                  top: 15,
                  right: 25,
                  left: 10,
                  bottom: 10,
                }}
              >
                <defs>
                  {/* Gradiente para Ingresos (Coral / Naranja) */}
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Gradiente para Reservas (Esmeralda / Teal) */}
                  <linearGradient id="colorReservas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#475569", opacity: 0.3 }}
                />

                {/* Eje Y Izquierdo: Ingresos (S/) */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "#f97316" }}
                  tickLine={false}
                  axisLine={{ stroke: "#f97316", opacity: 0.4 }}
                  tickFormatter={(val) => `S/ ${val}`}
                />

                {/* Eje Y Derecho: Reservas (N° de turnos) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#10b981" }}
                  tickLine={false}
                  axisLine={{ stroke: "#10b981", opacity: 0.4 }}
                  tickFormatter={(val) => `${val} res`}
                />

                <Tooltip content={<CustomTooltip />} />

                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
                  formatter={(value) => (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {value}
                    </span>
                  )}
                />

                {/* Curva 1: Ingresos (S/) con Picos y Valles */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="ingresos"
                  name="Ingresos (S/)"
                  stroke="#f97316"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIngresos)"
                  activeDot={{ r: 6, stroke: "#ea580c", strokeWidth: 2 }}
                />

                {/* Curva 2: Reservas (Cantidad) */}
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="reservas"
                  name="Turnos Reservados"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorReservas)"
                  activeDot={{ r: 5, stroke: "#059669", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
