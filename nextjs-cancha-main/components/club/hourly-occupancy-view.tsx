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
  CheckCircle2,
  Percent,
  Pencil,
  Trash2,
  Plus,
  Power,
  CalendarDays,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getHourlyOccupancyDemand } from "@/lib/dashboard"
import { getAllCourtsByClub } from "@/lib/courts"
import {
  Promotion,
  getClubPromotions,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  CreatePromotionDto,
  UpdatePromotionDto,
} from "@/lib/promotions"

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun", fullLabel: "Lunes" },
  { value: 2, label: "Mar", fullLabel: "Martes" },
  { value: 3, label: "Mié", fullLabel: "Miércoles" },
  { value: 4, label: "Jue", fullLabel: "Jueves" },
  { value: 5, label: "Vie", fullLabel: "Viernes" },
  { value: 6, label: "Sáb", fullLabel: "Sábado" },
  { value: 0, label: "Dom", fullLabel: "Domingo" },
]

const PROMO_HOURS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
]

export function HourlyOccupancyView() {
  const [loading, setLoading] = useState(true)
  const [selectedSport, setSelectedSport] = useState<string>("all")
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all")
  const [timePreset, setTimePreset] = useState<string>("30days")
  const [data, setData] = useState<any>(null)
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)
  const [clubCourts, setClubCourts] = useState<any[]>([])

  // Estado para gestión de Promociones de Horarios Muertos
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loadingPromotions, setLoadingPromotions] = useState<boolean>(true)

  // Estado para Modal de Creación / Edición de Promoción
  const [promoModalOpen, setPromoModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [promoName, setPromoName] = useState<string>("")
  const [promoDescription, setPromoDescription] = useState<string>("")
  const [promoCourtId, setPromoCourtId] = useState<string>("all")
  const [promoDiscountPercentage, setPromoDiscountPercentage] = useState<number>(20)
  const [promoStartTime, setPromoStartTime] = useState<string>("14:00")
  const [promoEndTime, setPromoEndTime] = useState<string>("17:00")
  const [promoDaysOfWeek, setPromoDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [promoIsActive, setPromoIsActive] = useState<boolean>(true)
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false)

  // Estado para confirmación de eliminación
  const [deleteConfirmPromo, setDeleteConfirmPromo] = useState<Promotion | null>(null)
  const [isDeletingPromo, setIsDeletingPromo] = useState<boolean>(false)

  // Cargar canchas del club
  useEffect(() => {
    getAllCourtsByClub()
      .then((res) => {
        if (Array.isArray(res)) setClubCourts(res)
      })
      .catch((err) => {
        console.error("Error cargando canchas del club:", err)
      })
  }, [])

  // Cargar promociones configuradas del club
  const fetchPromotions = async () => {
    setLoadingPromotions(true)
    try {
      const res = await getClubPromotions()
      if (Array.isArray(res)) {
        setPromotions(res)
      }
    } catch (err) {
      console.error("Error al cargar promociones del club:", err)
    } finally {
      setLoadingPromotions(false)
    }
  }

  useEffect(() => {
    fetchPromotions()
  }, [])

  // Abrir modal para crear nueva promoción
  const handleOpenCreatePromoModal = (params?: {
    timeRange?: string
    courtId?: string
    dayLabel?: string
    dayNumber?: number
    suggestedDiscount?: number
    name?: string
  }) => {
    setEditingPromotion(null)

    let start = "14:00"
    let end = "17:00"
    if (params?.timeRange) {
      const parts = params.timeRange.split("-").map((s) => s.trim())
      if (parts.length === 2) {
        start = parts[0].length === 5 ? parts[0] : parts[0].padStart(5, "0")
        end = parts[1].length === 5 ? parts[1] : parts[1].padStart(5, "0")
      }
    }
    setPromoStartTime(start)
    setPromoEndTime(end)

    if (typeof params?.dayNumber === "number") {
      setPromoDaysOfWeek([params.dayNumber])
    } else {
      setPromoDaysOfWeek([1, 2, 3, 4, 5])
    }

    const court = params?.courtId || selectedCourtId || "all"
    setPromoCourtId(court)

    const discount = params?.suggestedDiscount || 20
    setPromoDiscountPercentage(discount)

    const dayText = params?.dayLabel ? ` (${params.dayLabel})` : ""
    setPromoName(params?.name || `Promo Horario Muerto ${start} - ${end}${dayText}`)
    setPromoDescription("Descuento especial automático para incentivar ocupación en horario muerto.")
    setPromoIsActive(true)
    setPromoModalOpen(true)
  }

  // Abrir modal para editar promoción existente
  const handleOpenEditPromoModal = (promo: Promotion) => {
    setEditingPromotion(promo)
    setPromoName(promo.name)
    setPromoDescription(promo.description || "")
    setPromoCourtId(promo.applyToAllCourts || !promo.courtId ? "all" : String(promo.courtId))
    setPromoDiscountPercentage(Number(promo.discountPercentage))
    setPromoStartTime(promo.startTime)
    setPromoEndTime(promo.endTime)
    setPromoDaysOfWeek(Array.isArray(promo.daysOfWeek) ? promo.daysOfWeek : [1, 2, 3, 4, 5])
    setPromoIsActive(promo.isActive)
    setPromoModalOpen(true)
  }

  // Guardar (crear o actualizar) promoción
  const handleSavePromo = async () => {
    if (!promoName.trim()) {
      toast.error("Por favor ingresa un nombre para la promoción")
      return
    }

    const discount = Number(promoDiscountPercentage)
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      toast.error("El porcentaje de descuento debe ser mayor a 0% y como máximo 100%")
      return
    }

    if (!promoStartTime || !promoEndTime) {
      toast.error("Por favor especifica el horario de inicio y fin")
      return
    }

    if (promoStartTime >= promoEndTime) {
      toast.error("El horario de inicio debe ser anterior al horario de finalización")
      return
    }

    if (!promoDaysOfWeek || promoDaysOfWeek.length === 0) {
      toast.error("Selecciona al menos un día de la semana para la promoción")
      return
    }

    setIsSavingPromo(true)
    try {
      const applyToAllCourts = promoCourtId === "all"
      const courtId = applyToAllCourts ? null : Number(promoCourtId)

      if (editingPromotion) {
        const payload: UpdatePromotionDto = {
          name: promoName.trim(),
          description: promoDescription.trim() || undefined,
          discountPercentage: discount,
          startTime: promoStartTime,
          endTime: promoEndTime,
          daysOfWeek: promoDaysOfWeek,
          applyToAllCourts,
          courtId,
          isActive: promoIsActive,
        }
        await updatePromotion(editingPromotion.id, payload)
        toast.success("¡Promoción actualizada exitosamente!")
      } else {
        const payload: CreatePromotionDto = {
          name: promoName.trim(),
          description: promoDescription.trim() || undefined,
          discountPercentage: discount,
          startTime: promoStartTime,
          endTime: promoEndTime,
          daysOfWeek: promoDaysOfWeek,
          applyToAllCourts,
          courtId,
          isActive: promoIsActive,
        }
        await createPromotion(payload)
        toast.success("¡Promoción creada y guardada en base de datos!", {
          description: `Se aplicará automáticamente ${discount}% OFF en ${
            applyToAllCourts ? "todas las canchas" : "la cancha seleccionada"
          } de ${promoStartTime} a ${promoEndTime}.`,
        })
      }

      setPromoModalOpen(false)
      fetchPromotions()
      fetchData()
    } catch (err: any) {
      toast.error("Error al guardar la promoción", {
        description: err.response?.data?.message || err.message,
      })
    } finally {
      setIsSavingPromo(false)
    }
  }

  // Alternar estado activo / inactivo
  const handleTogglePromotion = async (promo: Promotion) => {
    try {
      const updated = await togglePromotion(promo.id)
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, isActive: updated.isActive } : p))
      )
      toast.success(
        updated.isActive
          ? `Promoción "${promo.name}" activada`
          : `Promoción "${promo.name}" pausada`
      )
      fetchData()
    } catch (err: any) {
      toast.error("Error al cambiar estado de la promoción", {
        description: err.response?.data?.message || err.message,
      })
    }
  }

  // Eliminar promoción
  const handleDeletePromotion = async () => {
    if (!deleteConfirmPromo) return
    setIsDeletingPromo(true)
    try {
      await deletePromotion(deleteConfirmPromo.id)
      setPromotions((prev) => prev.filter((p) => p.id !== deleteConfirmPromo.id))
      toast.success(`Promoción "${deleteConfirmPromo.name}" eliminada`)
      setDeleteConfirmPromo(null)
      fetchData()
    } catch (err: any) {
      toast.error("Error al eliminar la promoción", {
        description: err.response?.data?.message || err.message,
      })
    } finally {
      setIsDeletingPromo(false)
    }
  }

  // Toggle de un día en el selector de días
  const handleToggleDay = (dayValue: number) => {
    if (promoDaysOfWeek.includes(dayValue)) {
      if (promoDaysOfWeek.length === 1) {
        toast.error("Debe quedar al menos un día seleccionado")
        return
      }
      setPromoDaysOfWeek(promoDaysOfWeek.filter((d) => d !== dayValue))
    } else {
      setPromoDaysOfWeek([...promoDaysOfWeek, dayValue].sort((a, b) => a - b))
    }
  }

  // Selección rápida de días
  const handleSelectDaysPreset = (preset: "all" | "weekdays" | "weekends") => {
    if (preset === "all") {
      setPromoDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
    } else if (preset === "weekdays") {
      setPromoDaysOfWeek([1, 2, 3, 4, 5])
    } else if (preset === "weekends") {
      setPromoDaysOfWeek([6, 0])
    }
  }

  // Cancha objetivo para simulador de precios
  const targetCourtForPreview = useMemo(() => {
    if (promoCourtId !== "all") {
      return clubCourts.find((c) => String(c.id) === promoCourtId) || clubCourts[0]
    }
    return clubCourts[0]
  }, [promoCourtId, clubCourts])

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

  // Formato legible de días de la semana
  const formatDaysDisplay = (days: number[]) => {
    if (!days || days.length === 0) return "Ninguno"
    if (days.length === 7) return "Todos los días (Lun-Dom)"
    const sorted = [...days].sort((a, b) => a - b)
    if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) {
      return "Lunes a Viernes"
    }
    if (sorted.length === 2 && [0, 6].every((d) => sorted.includes(d))) {
      return "Fines de Semana (Sáb-Dom)"
    }
    const dayMap: Record<number, string> = {
      0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb",
    }
    return sorted.map((d) => dayMap[d]).join(", ")
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
            variant="default"
            size="sm"
            onClick={() => handleOpenCreatePromoModal()}
            className="h-9 text-xs gap-1.5 bg-primary font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Promoción
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchData(); fetchPromotions(); }}
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
                                  onClick={() => handleOpenCreatePromoModal({
                                    timeRange: `${hourLabel} - ${nextHourLabel}`,
                                    dayNumber: day,
                                    dayLabel: dayName,
                                    courtId: selectedCourtId,
                                  })}
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
                                  <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-200 dark:border-amber-900 mt-1 cursor-pointer">
                                    💡 <em>Haz clic en este bloque para configurar promoción de horario muerto aquí.</em>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCreatePromoModal({
                        timeRange: block.timeRange,
                        courtId: selectedCourtId,
                        name: `Promo ${block.timeRange}`,
                      })}
                      className="h-7 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 px-2.5"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      Configurar promoción <ArrowRight className="h-3 w-3 ml-0.5" />
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

      {/* SECCIÓN: GESTIÓN DE PROMOCIONES DE HORARIOS MUERTOS CONFIGURADAS */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Promociones Configuradas en Horarios Muertos
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {promotions.length} {promotions.length === 1 ? "configurada" : "configuradas"}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Reglas activas en PostgreSQL que se aplican automáticamente a las reservas de clientes y reservas manuales.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenCreatePromoModal()}
              className="h-8 text-xs gap-1.5 bg-primary font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva Promoción
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {loadingPromotions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : promotions.length === 0 ? (
            <div className="py-10 text-center space-y-3 border border-dashed rounded-xl p-6 bg-muted/20">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Tag className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Aún no tienes promociones configuradas
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Aprovecha las sugerencias de horarios muertos o haz clic en cualquier celda gris del mapa de calor para incentivar reservas con descuentos automáticos.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenCreatePromoModal()}
                className="text-xs gap-1.5 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear Mi Primera Promoción
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((promo) => {
                const courtName = promo.applyToAllCourts || !promo.court
                  ? "🏟️ Todas las canchas del club"
                  : `🏟️ ${promo.court.name} (${formatSportName(promo.court.sport || promo.court.type || "")})`

                return (
                  <div
                    key={promo.id}
                    className={`p-4 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      promo.isActive
                        ? "bg-card border-border hover:border-primary/50 shadow-xs"
                        : "bg-muted/40 border-muted opacity-70"
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {promo.name}
                        </span>
                        <Badge
                          variant={promo.isActive ? "default" : "secondary"}
                          className={`text-[10px] font-semibold ${
                            promo.isActive
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {promo.isActive ? "Activa" : "Pausada"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-bold">
                          {promo.discountPercentage}% OFF
                        </Badge>
                      </div>

                      {promo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {promo.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          {courtName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <strong className="text-foreground">{promo.startTime} - {promo.endTime}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          {formatDaysDisplay(promo.daysOfWeek)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-1.5 mr-2">
                        <Switch
                          checked={promo.isActive}
                          onCheckedChange={() => handleTogglePromotion(promo)}
                          aria-label="Alternar promoción activa"
                        />
                        <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                          {promo.isActive ? "Activa" : "Pausa"}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditPromoModal(promo)}
                        className="h-8 text-xs gap-1 px-2.5"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmPromo(promo)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL CONFIGURAR / EDITAR PROMOCIÓN */}
      <Dialog open={promoModalOpen} onOpenChange={setPromoModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {editingPromotion ? "Editar Promoción de Horario Muerto" : "Configurar Promoción para Horario Muerto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configura descuentos automáticos por franja horaria y días de la semana para impulsar reservas en horarios desocupados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Nombre de la Promoción */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre de la Promoción *</Label>
              <Input
                placeholder="Ej. Promo Tardes Muertas 20% OFF"
                className="text-xs"
                value={promoName}
                onChange={(e) => setPromoName(e.target.value)}
              />
            </div>

            {/* Alcance de Canchas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Canchas Aplicables</Label>
              <Select value={promoCourtId} onValueChange={setPromoCourtId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Seleccionar alcance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏟️ Todas las Canchas del Club</SelectItem>
                  {clubCourts.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name} {c.sport || c.type ? `(${formatSportName(c.sport || c.type)})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {promoCourtId === "all"
                  ? "Aplica a todas las canchas actuales y futuras pertenecientes a este club."
                  : "Aplica únicamente a la cancha específica seleccionada."}
              </p>
            </div>

            {/* Días de Aplicación con Selector Rápido */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Días de Aplicación *</Label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectDaysPreset("weekdays")}
                    className="text-primary hover:underline font-medium"
                  >
                    Lun-Vie
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectDaysPreset("weekends")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sáb-Dom
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectDaysPreset("all")}
                    className="text-primary hover:underline font-medium"
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = promoDaysOfWeek.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleToggleDay(d.value)}
                      className={`h-9 rounded-lg border text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted border-border"
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Franja Horaria (Inicio y Fin) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Hora de Inicio (Desde) *</Label>
                <Select value={promoStartTime} onValueChange={setPromoStartTime}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Inicio" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {PROMO_HOURS.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Hora de Fin (Hasta) *</Label>
                <Select value={promoEndTime} onValueChange={setPromoEndTime}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Fin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {PROMO_HOURS.map((hour) => (
                      <SelectItem key={hour} value={hour}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Porcentaje de Descuento */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Porcentaje de Descuento (%) *</Label>
                <span className="text-xs font-bold text-primary">
                  {promoDiscountPercentage}% de descuento
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">%</span>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  placeholder="Ej. 20"
                  className="pl-8 text-xs font-bold"
                  value={promoDiscountPercentage}
                  onChange={(e) => setPromoDiscountPercentage(Number(e.target.value))}
                />
              </div>

              {/* Botones rápidos de descuento */}
              <div className="flex items-center gap-1.5 pt-1">
                {[10, 15, 20, 25, 30, 40].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant={promoDiscountPercentage === pct ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPromoDiscountPercentage(pct)}
                    className="h-6 text-[10px] px-2"
                  >
                    {pct}%
                  </Button>
                ))}
              </div>
            </div>

            {/* SIMULADOR DE PRECIOS EN VIVO */}
            {targetCourtForPreview && (
              <div className="p-3 rounded-xl bg-muted/60 border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    Simulación de Tarifas con {promoDiscountPercentage}% OFF
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Cancha: {targetCourtForPreview.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  {/* Tarifa Día */}
                  <div className="p-2 rounded-lg bg-card border">
                    <p className="text-muted-foreground font-medium">Tarifa Diurna (antes 18:00)</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-muted-foreground line-through text-[10px]">
                        S/ {(Number(targetCourtForPreview.priceDay || 0) * 2).toFixed(2)}/h
                      </span>
                      <span className="font-bold text-emerald-600 text-xs">
                        S/ {(Number(targetCourtForPreview.priceDay || 0) * 2 * (1 - (Number(promoDiscountPercentage) || 0) / 100)).toFixed(2)}/h
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      S/ {(Number(targetCourtForPreview.priceDay || 0) * (1 - (Number(promoDiscountPercentage) || 0) / 100)).toFixed(2)} / bloque 30 min
                    </span>
                  </div>

                  {/* Tarifa Noche */}
                  <div className="p-2 rounded-lg bg-card border">
                    <p className="text-muted-foreground font-medium">Tarifa Nocturna (desde 18:00)</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-muted-foreground line-through text-[10px]">
                        S/ {(Number(targetCourtForPreview.priceNight || targetCourtForPreview.priceDay || 0) * 2).toFixed(2)}/h
                      </span>
                      <span className="font-bold text-emerald-600 text-xs">
                        S/ {(Number(targetCourtForPreview.priceNight || targetCourtForPreview.priceDay || 0) * 2 * (1 - (Number(promoDiscountPercentage) || 0) / 100)).toFixed(2)}/h
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      S/ {(Number(targetCourtForPreview.priceNight || targetCourtForPreview.priceDay || 0) * (1 - (Number(promoDiscountPercentage) || 0) / 100)).toFixed(2)} / bloque 30 min
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Interruptor de activación */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold cursor-pointer">Activar inmediatamente</Label>
                <p className="text-[11px] text-muted-foreground">
                  Si se desactiva, la promoción quedará guardada pero en pausa.
                </p>
              </div>
              <Switch
                checked={promoIsActive}
                onCheckedChange={setPromoIsActive}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPromoModalOpen(false)}
              disabled={isSavingPromo}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSavePromo}
              disabled={isSavingPromo}
              className="gap-1.5 bg-primary font-semibold"
            >
              {isSavingPromo ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isSavingPromo ? "Guardando en BD..." : editingPromotion ? "Actualizar Promoción" : "Guardar Promoción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <AlertDialog
        open={!!deleteConfirmPromo}
        onOpenChange={(open) => !open && setDeleteConfirmPromo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ¿Eliminar promoción de horario muerto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Estás a punto de eliminar la promoción <strong>&quot;{deleteConfirmPromo?.name}&quot;</strong>.
              Esta acción eliminará la regla de descuento de la base de datos PostgreSQL. Las reservas existentes ya emitidas no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPromo} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingPromo}
              onClick={handleDeletePromotion}
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPromo ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
