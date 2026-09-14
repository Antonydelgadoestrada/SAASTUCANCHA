"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CalendarIcon, ClockIcon, DollarSignIcon, UserIcon,
  CreditCardIcon, CheckCircle2Icon, AlertCircleIcon,
  BanknoteIcon, ShieldCheckIcon, SparklesIcon
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
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

const TIME_SLOTS = [
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
  initialTime = "08:00",
  onSuccess,
}: ManualBookingModalProps) {
  const [selectedCourtId, setSelectedCourtId] = useState<string>("")
  const [dateStr, setDateStr] = useState<string>("")
  const [startTime, setStartTime] = useState<string>("08:00")
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

  // Sincronizar estado inicial al abrir modal
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
        dStr = format(new Date(), "yyyy-MM-dd")
      }
      setDateStr(dStr)

      setStartTime(initialTime || "08:00")
      setDuration("1.0")
      setIsManualPriceEdited(false)
    }
  }, [open, initialCourtId, initialDate, initialTime, courts])

  const selectedCourt = useMemo(() => {
    return courts.find((c) => String(c.id) === String(selectedCourtId))
  }, [courts, selectedCourtId])

  // Cálculo de precio según cancha, hora y duración
  const calculatedPricing = useMemo(() => {
    if (!selectedCourt) return { unitSlotPrice: 0, totalPrice: 0, isNight: false, hasPromo: false, slotCount: 0 }
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

  // Actualizar precio sugerido automáticamente
  useEffect(() => {
    if (!isManualPriceEdited && calculatedPricing.totalPrice > 0) {
      setTotalPrice(String(calculatedPricing.totalPrice))
      setAmountPaid(String(calculatedPricing.totalPrice))
    }
  }, [calculatedPricing, isManualPriceEdited])

  // Análisis de faltante y balance
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
          discounts: calculatedPricing.hasPromo ? (calculatedPricing.regularSlotPrice - calculatedPricing.unitSlotPrice) * calculatedPricing.slotCount : 0,
          taxes: 0,
          totalPrice: numTotal,
        },
      }

      await createReservationManual(payload)

      toast.success(
        isFullPaid
          ? "✓ Reserva registrada y pagada al 100% exitosamente"
          : isPartial
          ? `✓ Reserva registrada con adelanto de S/ ${numPaid.toFixed(2)}. Saldo restante: S/ ${saldoFaltante.toFixed(2)}`
          : "✓ Reserva registrada pendiente de cobro exitosamente"
      )

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      const msg =
        err.response?.data?.message ||
        "Error al registrar la reserva. Verifica que el correo pertenezca a un usuario registrado en la plataforma."
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Registrar Nueva Reserva (Club)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Crea una reserva directa en tu club con método de cobro inmediato y control de saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-3 text-sm">
          {/* Fila 1: Cancha y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cancha *</Label>
              <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar Cancha" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={String(court.id)}>
                      {court.name} ({court.surface || "Cancha"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fecha *</Label>
              <Input
                type="date"
                className="h-9"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 2: Hora de Inicio y Duración */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Hora de Inicio *</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar hora" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} {Number(t.split(":")[0]) >= 18 ? "🌙 (Noche)" : "☀️ (Día)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Duración *</Label>
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

          {/* Tarjeta de Resumen de Tarifa Calculada */}
          {selectedCourt && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-foreground">
                  Tarifa {calculatedPricing.isNight ? "🌙 Noche" : "☀️ Día"}:
                </span>{" "}
                <span className="text-muted-foreground">
                  S/ {calculatedPricing.unitSlotPrice.toFixed(2)} por 30 min{" "}
                  {calculatedPricing.hasPromo && (
                    <Badge variant="outline" className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 py-0">
                      Promo activa
                    </Badge>
                  )}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {calculatedPricing.slotCount} bloques de 30 min = S/ {calculatedPricing.totalPrice.toFixed(2)}
                </p>
              </div>
              <div className="text-right w-full sm:w-auto">
                <span className="text-[11px] text-muted-foreground block">Precio sugerido</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  S/ {calculatedPricing.totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Fila 3: Email del Cliente (Obligatorio) y Nombre/Teléfono */}
          <div className="space-y-3 p-3 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Email del Cliente (Usuario Registrado) *</Label>
                <span className="text-[11px] text-muted-foreground">Recibirá confirmación por email</span>
              </div>
              <Input
                type="email"
                placeholder="ejemplo@deportista.com"
                className="h-9"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Nombre del Cliente (Opcional)</Label>
                <Input
                  placeholder="Juan Pérez"
                  className="h-8 text-xs"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Teléfono / WhatsApp (Opcional)</Label>
                <Input
                  placeholder="999888777"
                  className="h-8 text-xs"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Fila 4: SECCIÓN DE PAGO DIRECTO */}
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                <DollarSignIcon className="w-4 h-4" />
                Registro de Cobro y Método de Pago
              </div>
              {isFullPaid ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]">
                  ✓ Pago Completo
                </Badge>
              ) : isPartial ? (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                  ⚠️ Adelanto Parcial
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[10px]">
                  ⏳ Pendiente de Pago
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Precio Total de la Reserva */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Precio Total (S/)</Label>
                <Input
                  type="number"
                  step="0.50"
                  className="h-9 font-semibold"
                  value={totalPrice}
                  onChange={(e) => {
                    setTotalPrice(e.target.value)
                    setIsManualPriceEdited(true)
                  }}
                />
              </div>

              {/* Método de Pago */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                    <SelectItem value="yape">📱 Yape</SelectItem>
                    <SelectItem value="plin">📱 Plin</SelectItem>
                    <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                    <SelectItem value="mercadopago">💳 Mercado Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Monto Cobrado / Pagado */}
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Monto Cobrado (S/)</Label>
                <Input
                  type="number"
                  step="0.50"
                  placeholder="0.00"
                  className="h-9 font-semibold"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            {/* Visualizador de Faltante / Saldo reactivo */}
            <div className="pt-2 border-t border-emerald-500/15">
              {isFullPaid && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Cobro 100% completado:</strong> Se han registrado <strong>S/ {numPaid.toFixed(2)}</strong>. La cancha se confirmará y ocupará automáticamente. Saldo restante: <strong>S/ 0.00</strong>.
                  </span>
                </div>
              )}

              {isPartial && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircleIcon className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Adelanto recibido:</strong> Se cobraron <strong>S/ {numPaid.toFixed(2)}</strong>. El sistema registrará un <strong>saldo faltante de S/ {saldoFaltante.toFixed(2)}</strong> pendiente por liquidar.
                  </span>
                </div>
              )}

              {isUnpaid && (
                <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <AlertCircleIcon className="w-4 h-4 shrink-0 text-red-600" />
                  <span>
                    <strong>Sin cobro inicial:</strong> Queda un monto pendiente de <strong>S/ {numTotal.toFixed(2)}</strong> por pagar.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notas Adicionales */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notas u Observaciones (Opcional)</Label>
            <Textarea
              placeholder="Ej: Balón prestado, reservado por teléfono, etc."
              className="h-16 text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Registrando..." : "Guardar Reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
