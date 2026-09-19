"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createReservationManual } from "@/lib/reservation"

interface ManualBookingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courts: any[]
  initialCourtId?: string
  initialDate?: Date | string
  initialTime?: string
  onSuccess?: () => void
}

const ALL_TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
]

export function ManualBookingModal({
  open,
  onOpenChange,
  courts = [],
  initialCourtId,
  initialDate,
  initialTime,
  onSuccess,
}: ManualBookingModalProps) {
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), [])

  const [selectedCourtId, setSelectedCourtId] = useState<string>("")
  const [dateStr, setDateStr] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("")
  const [duration, setDuration] = useState<string>("1.0")
  const [userEmail, setUserEmail] = useState<string>("")
  const [customerName, setCustomerName] = useState<string>("")
  const [customerPhone, setCustomerPhone] = useState<string>("")
  const [totalPrice, setTotalPrice] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo")
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isManualPriceEdited, setIsManualPriceEdited] = useState<boolean>(false)

  // Filtrar slots para no permitir horas pasadas si la fecha es hoy
  const availableTimeSlots = useMemo(() => {
    if (!dateStr || dateStr > todayStr) {
      return ALL_TIME_SLOTS
    }

    if (dateStr === todayStr) {
      const now = new Date()
      const currentH = now.getHours()
      const currentM = now.getMinutes()

      return ALL_TIME_SLOTS.filter((t) => {
        const [h, m] = t.split(":").map(Number)
        return h > currentH || (h === currentH && m > currentM)
      })
    }

    // Fecha en el pasado: ningún slot disponible
    return []
  }, [dateStr, todayStr])

  // Inicializar estado al abrir el modal
  useEffect(() => {
    if (open) {
      const courtId = initialCourtId || (courts.length > 0 ? String(courts[0].id) : "")
      setSelectedCourtId(courtId)

      let dStr = ""
      if (initialDate instanceof Date) {
        dStr = format(initialDate, "yyyy-MM-dd")
      } else if (typeof initialDate === "string" && initialDate.trim() !== "") {
        dStr = initialDate.substring(0, 10)
      } else {
        dStr = todayStr
      }

      // Si la fecha inicial era pasada, fijar hoy
      if (dStr < todayStr) {
        dStr = todayStr
      }
      setDateStr(dStr)

      // Calcular slots válidos para esa fecha
      const now = new Date()
      const currentH = now.getHours()
      const currentM = now.getMinutes()
      const validSlots =
        dStr === todayStr
          ? ALL_TIME_SLOTS.filter((t) => {
              const [h, m] = t.split(":").map(Number)
              return h > currentH || (h === currentH && m > currentM)
            })
          : ALL_TIME_SLOTS

      if (initialTime && validSlots.includes(initialTime)) {
        setStartTime(initialTime)
      } else if (validSlots.length > 0) {
        setStartTime(validSlots[0])
      } else {
        setStartTime("08:00")
      }

      setDuration("1.0")
      setIsManualPriceEdited(false)
    }
  }, [open, initialCourtId, initialDate, initialTime, courts, todayStr])

  // Ajustar hora si la fecha cambia a hoy y la hora seleccionada quedó en el pasado
  useEffect(() => {
    if (availableTimeSlots.length > 0 && (!startTime || !availableTimeSlots.includes(startTime))) {
      setStartTime(availableTimeSlots[0])
    }
  }, [availableTimeSlots, startTime])

  const selectedCourt = useMemo(() => {
    return courts.find((c) => String(c.id) === String(selectedCourtId))
  }, [courts, selectedCourtId])

  // Cálculo de precio según tarifa de 30 min y duración
  const calculatedPricing = useMemo(() => {
    if (!selectedCourt) {
      return {
        unitSlotPrice: 0,
        totalPrice: 0,
        regularSlotPrice: 0,
        promoSlotPrice: 0,
        isNight: false,
        hasPromo: false,
        slotCount: 0,
      }
    }
    const [h] = (startTime || "08:00").split(":").map(Number)
    const isNight = !isNaN(h) ? h >= 18 : false

    const regularSlotPrice = Number(isNight ? (selectedCourt.priceNight ?? selectedCourt.priceDay) : selectedCourt.priceDay) || 0
    const promoSlotPrice = Number(isNight ? selectedCourt.promoNight : selectedCourt.promoDay)
    const hasPromo = !isNaN(promoSlotPrice) && promoSlotPrice > 0 && promoSlotPrice < regularSlotPrice
    const unitSlotPrice = hasPromo ? promoSlotPrice : regularSlotPrice

    const slotCount = Math.round(Number(duration) * 2)
    const total = Number((unitSlotPrice * slotCount).toFixed(2))

    return {
      unitSlotPrice,
      totalPrice: total,
      regularSlotPrice,
      promoSlotPrice,
      isNight,
      hasPromo,
      slotCount,
    }
  }, [selectedCourt, startTime, duration])

  // Actualizar precio automáticamente
  useEffect(() => {
    if (!isManualPriceEdited && calculatedPricing.totalPrice > 0) {
      setTotalPrice(String(calculatedPricing.totalPrice))
      setAmountPaid(String(calculatedPricing.totalPrice))
    }
  }, [calculatedPricing, isManualPriceEdited])

  // Cálculos de saldo
  const numTotal = Number(totalPrice || calculatedPricing.totalPrice || 0)
  const numPaid = Number(amountPaid !== "" ? amountPaid : numTotal)
  const saldoFaltante = Math.max(0, Number((numTotal - numPaid).toFixed(2)))
  const isFullPaid = numTotal > 0 && numPaid >= numTotal - 0.05
  const isPartial = !isFullPaid && numPaid > 0
  const isUnpaid = numPaid === 0

  const handleSave = async () => {
    if (!selectedCourtId) {
      toast.error("Por favor selecciona una cancha")
      return
    }
    if (!userEmail.trim()) {
      toast.error("El email del cliente es obligatorio (debe pertenecer a un usuario registrado)")
      return
    }
    if (!dateStr) {
      toast.error("Por favor selecciona una fecha válida")
      return
    }
    if (dateStr < todayStr) {
      toast.error("No se pueden registrar reservas en fechas pasadas")
      return
    }
    if (availableTimeSlots.length === 0 || (dateStr === todayStr && !availableTimeSlots.includes(startTime))) {
      toast.error("El horario seleccionado ya pasó. Selecciona un horario futuro.")
      return
    }

    setIsSaving(true)
    try {
      const [h, m] = startTime.split(":").map(Number)
      const totalMinutesToAdd = Number(duration) * 60
      const d = new Date()
      d.setHours(h, m, 0, 0)
      d.setMinutes(d.getMinutes() + totalMinutesToAdd)
      const endHours = d.getHours().toString().padStart(2, "0")
      const endMinutes = d.getMinutes().toString().padStart(2, "0")
      const endTime = `${endHours}:${endMinutes}`

      const payload = {
        courtId: selectedCourtId,
        date: dateStr,
        startTime,
        endTime,
        duration: Number(duration),
        price: String(numTotal),
        userEmail: userEmail.trim(),
        paymentMethod: paymentMethod.toLowerCase(),
        amountPaid: numPaid,
        customerInfo: {
          name: customerName.trim() || undefined,
          email: userEmail.trim(),
          phone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        pricing: {
          basePrice: numTotal / Number(duration),
          discounts: calculatedPricing.hasPromo
            ? (calculatedPricing.regularSlotPrice - calculatedPricing.unitSlotPrice) * calculatedPricing.slotCount
            : 0,
          taxes: 0,
          totalPrice: numTotal,
        },
      }

      await createReservationManual(payload)

      toast.success(
        isFullPaid
          ? "Reserva registrada y confirmada (Pago Completo)"
          : isPartial
          ? `Reserva registrada con adelanto de S/ ${numPaid.toFixed(2)}. Saldo pendiente: S/ ${saldoFaltante.toFixed(2)}`
          : "Reserva registrada (Pendiente de cobro)"
      )

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      const msg =
        err.response?.data?.message ||
        "Error al registrar la reserva. Verifica que el correo pertenezca a un usuario registrado."
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            <DialogTitle className="text-lg font-bold">
              Registrar Reserva
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Ingresa los datos para registrar la reserva directa en el club.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3.5 py-2 text-sm">
          {/* Fila 1: Cancha y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Cancha</Label>
              <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar cancha" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={String(court.id)}>
                      {court.name} {court.surface ? `(${court.surface})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Fecha</Label>
              <Input
                type="date"
                min={todayStr}
                className="h-9"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 2: Hora y Duración */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Hora de inicio</Label>
              <Select
                value={startTime}
                onValueChange={setStartTime}
                disabled={availableTimeSlots.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={
                      availableTimeSlots.length === 0
                        ? "Sin horarios disponibles"
                        : "Seleccionar hora"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {availableTimeSlots.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableTimeSlots.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Ya no quedan horarios disponibles para hoy. Selecciona otra fecha.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Duración</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Duración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 minutos (1 bloque)</SelectItem>
                  <SelectItem value="1.0">1 hora (2 bloques)</SelectItem>
                  <SelectItem value="1.5">1.5 horas (3 bloques)</SelectItem>
                  <SelectItem value="2.0">2 horas (4 bloques)</SelectItem>
                  <SelectItem value="2.5">2.5 horas (5 bloques)</SelectItem>
                  <SelectItem value="3.0">3 horas (6 bloques)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumen de Tarifa */}
          {selectedCourt && (
            <div className="p-2.5 bg-muted/40 border rounded-md flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                <span>
                  Tarifa: S/ {calculatedPricing.unitSlotPrice.toFixed(2)} por 30 min
                </span>
                <span className="block text-[11px]">
                  {calculatedPricing.slotCount} bloques de 30 min
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">Precio sugerido</span>
                <span className="font-semibold text-sm text-foreground">
                  S/ {calculatedPricing.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2 p-2.5 bg-muted/20 border rounded-md">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Email del cliente (registrado) *</Label>
              <Input
                type="email"
                placeholder="cliente@correo.com"
                className="h-8 text-xs"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Nombre (opcional)</Label>
                <Input
                  placeholder="Nombre y Apellido"
                  className="h-8 text-xs"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Teléfono (opcional)</Label>
                <Input
                  placeholder="999 888 777"
                  className="h-8 text-xs"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Sección de Pago */}
          <div className="space-y-2 p-2.5 bg-muted/30 border rounded-md">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-foreground">
                Detalle del Pago
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  isFullPaid
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : isPartial
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {isFullPaid ? "Pago Completo" : isPartial ? "Adelanto" : "Pendiente"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Precio Total (S/)</Label>
                <Input
                  type="number"
                  step="0.50"
                  className="h-8 text-xs"
                  value={totalPrice}
                  onChange={(e) => {
                    setTotalPrice(e.target.value)
                    setIsManualPriceEdited(true)
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="yape">Yape</SelectItem>
                    <SelectItem value="plin">Plin</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Monto Cobrado (S/)</Label>
                <Input
                  type="number"
                  step="0.50"
                  className="h-8 text-xs font-medium"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            {/* Mensaje de saldo */}
            <div className="text-xs pt-1">
              {isFullPaid && (
                <p className="text-emerald-700 dark:text-emerald-400">
                  Total cobrado: S/ {numPaid.toFixed(2)}. Saldo restante: S/ 0.00.
                </p>
              )}
              {isPartial && (
                <p className="text-amber-700 dark:text-amber-400">
                  Adelanto cobrado: S/ {numPaid.toFixed(2)}. Saldo restante por pagar: S/ {saldoFaltante.toFixed(2)}.
                </p>
              )}
              {isUnpaid && (
                <p className="text-muted-foreground">
                  Sin cobro inicial. Queda pendiente S/ {numTotal.toFixed(2)}.
                </p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Notas (opcional)</Label>
            <Textarea
              placeholder="Detalles adicionales de la reserva..."
              className="h-14 text-xs resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={isSaving || availableTimeSlots.length === 0}
            onClick={handleSave}
          >
            {isSaving ? "Guardando..." : "Guardar Reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
