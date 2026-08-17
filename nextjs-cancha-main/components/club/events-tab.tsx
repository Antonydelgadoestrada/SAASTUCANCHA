"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SparklesIcon, CalendarIcon, PlusIcon, Trash2Icon, SaveIcon, XIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  createCourtScheduleEvent,
  deleteCourtScheduleEvent,
  listCourtScheduleEvents,
  type CreateCourtScheduleEventPayload,
} from "@/lib/schedule"

function getApiErrorMessage(e: unknown): string | null {
  if (typeof e !== "object" || e === null || !("response" in e)) return null
  const res = (e as { response?: { data?: { message?: unknown } } }).response
  const m = res?.data?.message
  if (typeof m === "string" && m.trim()) return m.trim()
  if (Array.isArray(m)) {
    const parts = m.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    if (parts.length) return parts.join(" ")
  }
  return null
}

/** Mensaje de `BadRequestException` al crear evento con horario solapado. */
function looksLikeEventOverlapError(message: string): boolean {
  const t = message.toLowerCase()
  return t.includes("solapa") && t.includes("evento")
}

export type EventsTabCourt = { id: string; name: string; venue?: { name?: string } }

export type EventsTabProps = {
  courts: EventsTabCourt[]
  /** Cancha seleccionada en el calendario (si no es "todas") */
  initialCourtId?: string
  templateId?: string | null
  /** Horas HH:mm de la plantilla (slots) para selects inicio/fin */
  templateSlotTimes: string[]
  /**
   * Días habilitados en la plantilla (`monday`…`sunday`, minúsculas).
   * Si viene vacío, se muestran los 7 días (plantilla sin filtro explícito).
   */
  templateWeekdayKeys?: string[]
  onEventsChanged?: () => void | Promise<void>
}

type TipoBloqueo = "dia" | "mes" | "personalizado"

type ApiEventRow = {
  id: string
  name: string
  description: string | null
  recurrenceType: string
  recurrenceConfig: Record<string, unknown>
  timeRanges: { start: string; until?: string; end?: string }[]
  isActive: boolean
}

const DIAS_SEMANA = [
  { id: "lunes", label: "Lunes", en: "monday" },
  { id: "martes", label: "Martes", en: "tuesday" },
  { id: "miercoles", label: "Miércoles", en: "wednesday" },
  { id: "jueves", label: "Jueves", en: "thursday" },
  { id: "viernes", label: "Viernes", en: "friday" },
  { id: "sabado", label: "Sábado", en: "saturday" },
  { id: "domingo", label: "Domingo", en: "sunday" },
]

const SPANISH_DAY_TO_EN: Record<string, string> = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.id, d.en]),
)

const EVENT_COLOR = "#a855f7"

/** Misma lógica que el backend: HH:mm con ceros a la izquierda. */
function normalizeHHmm(raw: string): string {
  const s = String(raw ?? "").trim()
  if (/^\d{1,2}$/.test(s)) {
    const h = Math.min(23, Math.max(0, parseInt(s, 10)))
    return `${String(h).padStart(2, "0")}:00`
  }
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return s
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function sortTimes(times: string[]): string[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const normalized = [...new Set(times.map((x) => normalizeHHmm(String(x).trim())).filter(Boolean))]
  return normalized.sort((a, b) => toMin(a) - toMin(b))
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Igual que el backend: tope 23:59 el mismo día. */
function minutesToHHmmLabel(totalMinutes: number): string {
  const capped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1))
  const hh = Math.floor(capped / 60)
  const mm = capped % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function add30MinutesLabel(time: string): string {
  return minutesToHHmmLabel(timeToMinutes(time) + 30)
}

function subtract30MinutesLabel(time: string): string {
  return minutesToHHmmLabel(timeToMinutes(time) - 30)
}

/** El API guarda `until` como fin exclusivo [start, until); en lista mostramos el inicio de la última media hora incluida. */
function rangeEndLabel(h: { until?: string; end?: string }): string {
  const raw = (h as { until?: string; end?: string }).until ?? (h as { end?: string }).end ?? ""
  const s = String(raw).trim()
  if (!s) return ""
  return subtract30MinutesLabel(normalizeHHmm(s))
}

function HorariosFinHint() {
  return (
    <p className="text-muted-foreground text-xs mt-2">
      En &quot;Fin&quot; elige la hora de inicio de la última fracción de 30 minutos que quieras cubrir (por ejemplo
      09:30 incluye el tramo hasta las 10:00).
    </p>
  )
}

export function EventsTab({
  courts,
  initialCourtId,
  templateId,
  templateSlotTimes,
  templateWeekdayKeys = [],
  onEventsChanged,
}: EventsTabProps) {
  const [events, setEvents] = useState<ApiEventRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const diasSemanaOpciones = useMemo(() => {
    const allowed = new Set(
      templateWeekdayKeys.map((k) => String(k).toLowerCase().trim()).filter(Boolean),
    )
    if (allowed.size === 0) return DIAS_SEMANA
    return DIAS_SEMANA.filter((d) => allowed.has(d.en))
  }, [templateWeekdayKeys])

  const slotTimes = useMemo(() => {
    const sorted = sortTimes(templateSlotTimes)
    if (sorted.length > 0) return sorted
    const fallback: string[] = []
    for (let h = 6; h <= 22; h++) {
      fallback.push(`${String(h).padStart(2, "0")}:00`)
      fallback.push(`${String(h).padStart(2, "0")}:30`)
    }
    return fallback
  }, [templateSlotTimes])

  const [eventCourtId, setEventCourtId] = useState<string>("")

  useEffect(() => {
    if (initialCourtId) {
      setEventCourtId(initialCourtId)
      return
    }
    if (courts.length === 1) setEventCourtId(courts[0].id)
  }, [initialCourtId, courts])

  const loadEvents = useCallback(async () => {
    if (!eventCourtId) {
      setEvents([])
      return
    }
    setListLoading(true)
    try {
      const data = await listCourtScheduleEvents(eventCourtId)
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      toast.error("No se pudieron cargar los eventos")
      setEvents([])
    } finally {
      setListLoading(false)
    }
  }, [eventCourtId])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    const allowed = new Set(
      templateWeekdayKeys.map((k) => String(k).toLowerCase().trim()).filter(Boolean),
    )
    if (allowed.size === 0) return
    setFormData((prev) => ({
      ...prev,
      diasSemana: prev.diasSemana.filter((id) => allowed.has(SPANISH_DAY_TO_EN[id] ?? "")),
    }))
  }, [templateWeekdayKeys])

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    tipoBloqueo: "dia" as TipoBloqueo,
    estado: "activo" as "activo" | "inactivo",
    diasSemana: [] as string[],
    horarios: [{ inicio: slotTimes[0] ?? "08:00", fin: slotTimes[1] ?? "10:00" }],
    diaMes: 1,
    fechasEspecificas: [] as Date[],
  })

  useEffect(() => {
    if (!slotTimes.length) return
    setFormData((prev) => ({
      ...prev,
      horarios: prev.horarios.map((h) => {
        const ni = normalizeHHmm(h.inicio)
        const nf = normalizeHHmm(h.fin)
        return {
          inicio: slotTimes.includes(ni) ? ni : slotTimes[0],
          fin: slotTimes.includes(nf) ? nf : slotTimes[Math.min(1, slotTimes.length - 1)],
        }
      }),
    }))
  }, [slotTimes])

  const resetForm = () => {
    const a = slotTimes[0] ?? "08:00"
    const b = slotTimes[1] ?? "10:00"
    setFormData({
      nombre: "",
      descripcion: "",
      tipoBloqueo: "dia",
      estado: "activo",
      diasSemana: [],
      horarios: [{ inicio: a, fin: b }],
      diaMes: 1,
      fechasEspecificas: [],
    })
  }

  const buildPayload = (): CreateCourtScheduleEventPayload | null => {
    if (!eventCourtId) {
      toast.error("Selecciona una cancha")
      return null
    }
    const timeRanges = formData.horarios.map((h) => {
      const start = normalizeHHmm(h.inicio)
      const finLastSlot = normalizeHHmm(h.fin)
      // "Fin" = inicio de la última celda de 30 min incluida; el backend usa [start, until) → until = instante tras esa celda.
      return { start, until: add30MinutesLabel(finLastSlot) }
    })
    for (const r of timeRanges) {
      if (timeToMinutes(r.until) <= timeToMinutes(r.start)) {
        toast.error("Cada horario debe tener fin posterior al inicio")
        return null
      }
    }

    if (formData.tipoBloqueo === "dia") {
      if (formData.diasSemana.length === 0) {
        toast.error("Selecciona al menos un día de la semana")
        return null
      }
      return {
        courtId: eventCourtId,
        templateId: templateId ?? null,
        name: formData.nombre.trim(),
        description: formData.descripcion.trim() || undefined,
        recurrenceType: "weekly",
        recurrenceConfig: {
          weekdays: formData.diasSemana.map((id) => SPANISH_DAY_TO_EN[id]).filter(Boolean),
        },
        timeRanges,
        isActive: formData.estado === "activo",
      }
    }

    if (formData.tipoBloqueo === "mes") {
      return {
        courtId: eventCourtId,
        templateId: templateId ?? null,
        name: formData.nombre.trim(),
        description: formData.descripcion.trim() || undefined,
        recurrenceType: "monthly",
        recurrenceConfig: { dayOfMonth: formData.diaMes },
        timeRanges,
        isActive: formData.estado === "activo",
      }
    }

    if (formData.fechasEspecificas.length === 0) {
      toast.error("Selecciona al menos una fecha")
      return null
    }
    const dates = formData.fechasEspecificas.map((d) => format(d, "yyyy-MM-dd"))
    return {
      courtId: eventCourtId,
      templateId: templateId ?? null,
      name: formData.nombre.trim(),
      description: formData.descripcion.trim() || undefined,
      recurrenceType: "custom",
      recurrenceConfig: { dates },
      timeRanges,
      isActive: formData.estado === "activo",
    }
  }

  const handleCreateEvent = async () => {
    if (!formData.nombre.trim()) return
    const payload = buildPayload()
    if (!payload) return
    setSaving(true)
    try {
      await createCourtScheduleEvent(payload)
      toast.success("Evento guardado")
      resetForm()
      setIsCreating(false)
      await loadEvents()
      await onEventsChanged?.()
    } catch (e: unknown) {
      console.error(e)
      const msg = getApiErrorMessage(e)
      if (msg && looksLikeEventOverlapError(msg)) {
        toast.error(`Interfiere con otro evento en esta cancha. ${msg}`)
      } else {
        toast.error(msg ?? "No se pudo guardar el evento")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCourtScheduleEvent(id)
      toast.success("Evento eliminado")
      await loadEvents()
      await onEventsChanged?.()
    } catch (e) {
      console.error(e)
      toast.error("No se pudo eliminar")
    }
  }

  const toggleDay = (dayId: string) => {
    setFormData((prev) => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dayId)
        ? prev.diasSemana.filter((d) => d !== dayId)
        : [...prev.diasSemana, dayId],
    }))
  }

  const addHorario = () => {
    const last = slotTimes[slotTimes.length - 1] ?? "22:00"
    const prevFin = formData.horarios[formData.horarios.length - 1]?.fin ?? last
    const idx = Math.max(0, slotTimes.indexOf(prevFin))
    const inicio = slotTimes[Math.min(idx, slotTimes.length - 2)] ?? slotTimes[0]
    const fin = slotTimes[Math.min(idx + 1, slotTimes.length - 1)] ?? last
    setFormData((prev) => ({
      ...prev,
      horarios: [...prev.horarios, { inicio, fin }],
    }))
  }

  const removeHorario = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      horarios: prev.horarios.filter((_, i) => i !== index),
    }))
  }

  const updateHorario = (index: number, field: "inicio" | "fin", value: string) => {
    setFormData((prev) => ({
      ...prev,
      horarios: prev.horarios.map((horario, i) =>
        i === index ? { ...horario, [field]: value } : horario,
      ),
    }))
  }

  const renderTimeRow = (horario: { inicio: string; fin: string }, index: number) => {
    const inicioN = normalizeHHmm(horario.inicio)
    const finN = normalizeHHmm(horario.fin)
    const endOptions = slotTimes.filter((t) => timeToMinutes(t) > timeToMinutes(inicioN))
    return (
      <div key={index} className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Inicio</Label>
            <Select
              value={inicioN}
              onValueChange={(v) => updateHorario(index, "inicio", v)}
            >
              <SelectTrigger className="h-8 min-w-[5.25rem] text-sm [&>span]:line-clamp-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slotTimes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fin</Label>
            <Select
              value={finN}
              onValueChange={(v) => updateHorario(index, "fin", v)}
            >
              <SelectTrigger className="h-8 min-w-[5.25rem] text-sm [&>span]:line-clamp-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(endOptions.length ? endOptions : slotTimes).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {formData.horarios.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeHorario(index)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2Icon className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  const renderConfiguracionTipo = (tipo: TipoBloqueo) => {
    switch (tipo) {
      case "dia":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Días de la semana</Label>
              {templateWeekdayKeys.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Solo los días marcados en la plantilla de horarios de esta cancha.
                </p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {diasSemanaOpciones.map((dia) => (
                  <div key={dia.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={dia.id}
                      checked={formData.diasSemana.includes(dia.id)}
                      onCheckedChange={() => toggleDay(dia.id)}
                    />
                    <Label htmlFor={dia.id} className="text-sm">
                      {dia.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Horarios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addHorario} className="h-7 text-xs">
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Agregar horario
                </Button>
              </div>
              <div className="space-y-2">{formData.horarios.map(renderTimeRow)}</div>
              <HorariosFinHint />
            </div>
          </div>
        )

      case "mes":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Día del mes</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={formData.diaMes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, diaMes: parseInt(e.target.value, 10) || 1 }))
                }
                placeholder="Ej: 15"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Horarios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addHorario} className="h-7 text-xs">
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Agregar horario
                </Button>
              </div>
              <div className="space-y-2">{formData.horarios.map(renderTimeRow)}</div>
              <HorariosFinHint />
            </div>
          </div>
        )

      case "personalizado":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Fechas específicas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.fechasEspecificas.length && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fechasEspecificas.length > 0
                      ? `${formData.fechasEspecificas.length} fecha(s) seleccionada(s)`
                      : "Selecciona fechas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    selected={formData.fechasEspecificas}
                    onSelect={(dates) => setFormData((prev) => ({ ...prev, fechasEspecificas: dates || [] }))}
                    locale={es}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
              {formData.fechasEspecificas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.fechasEspecificas.map((d, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {format(d, "dd/MM/yyyy", { locale: es })}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Horarios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addHorario} className="h-7 text-xs">
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Agregar horario
                </Button>
              </div>
              <div className="space-y-2">{formData.horarios.map(renderTimeRow)}</div>
              <HorariosFinHint />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const recurrenceLabel = (ev: ApiEventRow): string => {
    const t = String(ev.recurrenceType || "").toLowerCase()
    const cfg = ev.recurrenceConfig || {}
    if (t === "weekly") {
      const w = (cfg.weekdays as string[]) || []
      const labels = w.map((en) => DIAS_SEMANA.find((d) => d.en === en)?.label || en)
      return labels.length ? `Semanal: ${labels.join(", ")}` : "Semanal"
    }
    if (t === "monthly") return `Mensual: día ${cfg.dayOfMonth ?? "—"}`
    if (t === "custom") {
      const dates = cfg.dates as string[] | undefined
      if (Array.isArray(dates) && dates.length) return `Personalizado: ${dates.length} fecha(s)`
      return "Personalizado (rango o fechas)"
    }
    return t
  }

  const renderPreview = () => {
    if (!formData.nombre) return null
    return (
      <Card className="border-2 border-dashed border-muted-foreground/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_COLOR }} />
            {formData.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <div className="text-muted-foreground">
            {formData.tipoBloqueo === "dia" && formData.diasSemana.length > 0 && (
              <span>
                Días:{" "}
                {formData.diasSemana
                  .map((d) => DIAS_SEMANA.find((ds) => ds.id === d)?.label)
                  .join(", ")}
              </span>
            )}
            {formData.tipoBloqueo === "mes" && <span>Día {formData.diaMes} de cada mes</span>}
            {formData.tipoBloqueo === "personalizado" && formData.fechasEspecificas.length > 0 && (
              <span>{formData.fechasEspecificas.length} fecha(s) específica(s)</span>
            )}
          </div>
          <div className="text-muted-foreground">
            <span>
              Horarios:{" "}
              {formData.horarios
                .map((h) => `${normalizeHHmm(h.inicio)} - ${normalizeHHmm(h.fin)}`)
                .join(", ")}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const canPickCourt = courts.length > 1 || !initialCourtId

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-purple-600" />
            Eventos — bloqueo de horarios
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Los eventos se guardan por cancha y se muestran en el calendario como celdas moradas.
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          variant={isCreating ? "outline" : "default"}
          className="flex items-center gap-2"
        >
          {isCreating ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          {isCreating ? "Cancelar" : "Nuevo evento"}
        </Button>
      </div>

      {(canPickCourt || courts.length > 0) && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cancha</Label>
          <Select value={eventCourtId} onValueChange={setEventCourtId} disabled={courts.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cancha" />
            </SelectTrigger>
            <SelectContent>
              {courts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.venue?.name ? ` — ${c.venue.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!eventCourtId && courts.length > 0 && (
            <p className="text-xs text-muted-foreground">Elige una cancha para ver y crear eventos.</p>
          )}
        </div>
      )}

      {listLoading && <p className="text-sm text-muted-foreground">Cargando eventos…</p>}

      {events.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Eventos</h4>
          {events.map((ev) => (
            <Card key={ev.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLOR }} />
                    <CardTitle className="text-sm truncate">{ev.name}</CardTitle>
                    <Badge variant={ev.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                      {ev.isActive ? "activo" : "inactivo"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 shrink-0"
                    onClick={() => handleDeleteEvent(ev.id)}
                  >
                    <Trash2Icon className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {ev.description && <div>{ev.description}</div>}
                <div>{recurrenceLabel(ev)}</div>
                <div>
                  {ev.timeRanges
                    ?.map((h) => `${normalizeHHmm(String(h.start ?? ""))} - ${rangeEndLabel(h)}`)
                    .join(", ")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isCreating && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Crear evento</CardTitle>
            <CardDescription>Configura bloqueos recurrentes u ocasionales para la cancha seleccionada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre del evento *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Academia de pádel"
                />
              </div>
              <div>
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Describe el evento…"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="activo"
                  checked={formData.estado === "activo"}
                  onCheckedChange={(c) =>
                    setFormData((prev) => ({ ...prev, estado: c === true ? "activo" : "inactivo" }))
                  }
                />
                <Label htmlFor="activo" className="text-sm font-normal cursor-pointer">
                  Evento activo
                </Label>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Tipo de bloqueo</Label>
              <Tabs
                value={formData.tipoBloqueo}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, tipoBloqueo: value as TipoBloqueo }))}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dia">Por día</TabsTrigger>
                  <TabsTrigger value="mes">Por mes</TabsTrigger>
                  <TabsTrigger value="personalizado">Personalizado</TabsTrigger>
                </TabsList>
                <TabsContent value="dia" className="mt-4">
                  {renderConfiguracionTipo("dia")}
                </TabsContent>
                <TabsContent value="mes" className="mt-4">
                  {renderConfiguracionTipo("mes")}
                </TabsContent>
                <TabsContent value="personalizado" className="mt-4">
                  {renderConfiguracionTipo("personalizado")}
                </TabsContent>
              </Tabs>
            </div>

            {renderPreview() && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Vista previa</Label>
                {renderPreview()}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreating(false)} className="flex-1" disabled={saving}>
                Cerrar
              </Button>
              <Button
                onClick={() => void handleCreateEvent()}
                disabled={!formData.nombre.trim() || !eventCourtId || saving}
                className="flex-1"
              >
                <SaveIcon className="h-4 w-4 mr-2" />
                {saving ? "Guardando…" : "Guardar evento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !isCreating && !listLoading && (
        <div className="text-center py-12 px-4 bg-muted/30 rounded-lg">
          <SparklesIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay eventos</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {eventCourtId
              ? "Crea un evento para bloquear horarios en esta cancha."
              : "Selecciona una cancha arriba para ver o crear eventos."}
          </p>
          {eventCourtId && (
            <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2 mx-auto">
              <PlusIcon className="h-4 w-4" />
              Crear evento
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
