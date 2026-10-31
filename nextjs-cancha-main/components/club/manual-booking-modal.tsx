"use client"
import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { CalendarIcon, TicketIcon, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

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
import { getAllCourtsByQuery } from "@/lib/courts"
import { previewClubCoupon, PreviewCouponResult } from "@/lib/loyalty"

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
  const [posCommission, setPosCommission] = useState<string>("2.5")
  const [amountPaid, setAmountPaid] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isManualPriceEdited, setIsManualPriceEdited] = useState<boolean>(false)
  const [remoteAvailabilities, setRemoteAvailabilities] = useState<string[] | null>(null)

  // Estados para cupón de fidelidad
  const [couponCodeInput, setCouponCodeInput] = useState<string>("")
  const [appliedCoupon, setAppliedCoupon] = useState<PreviewCouponResult | null>(null)
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<boolean>(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !selectedCourtId || !dateStr) {
      setRemoteAvailabilities(null)
      return
    }
    
    let isMounted = true
    const fetchAvailability = async () => {
      try {
        const courtsData = await getAllCourtsByQuery(`date=${dateStr}`)
        if (!isMounted) return
        const targetCourt = courtsData.find((c: any) => String(c.id) === String(selectedCourtId))
        if (targetCourt && targetCourt.availability) {
          setRemoteAvailabilities(targetCourt.availability)
        } else {
          setRemoteAvailabilities([])
        }
      } catch (err) {
        console.error("Error fetching availability", err)
        if (isMounted) setRemoteAvailabilities(null)
      }
    }
    
    fetchAvailability()
    return () => { isMounted = false }
  }, [open, selectedCourtId, dateStr])

  // Filtrar slots para no permitir horas pasadas si la fecha es hoy
  const availableTimeSlots = useMemo(() => {
    let baseSlots = ALL_TIME_SLOTS
    
    if (remoteAvailabilities !== null) {
      baseSlots = baseSlots.filter((t) => remoteAvailabilities.includes(t))
    }

    if (!dateStr || dateStr > todayStr) {
      return baseSlots
    }

    if (dateStr === todayStr) {
      const now = new Date()
      const currentH = now.getHours()
      const currentM = now.getMinutes()

      return baseSlots.filter((t) => {
        const [h, m] = t.split(":").map(Number)
        return h > currentH || (h === currentH && m > currentM)
      })
    }

    // Fecha en el pasado: ningun slot disponible
    return []
  }, [dateStr, todayStr, remoteAvailabilities])

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
      setCouponCodeInput("")
      setAppliedCoupon(null)
      setIsValidatingCoupon(false)
      setCouponError(null)
    }
  }, [open, initialCourtId, initialDate, initialTime, courts, todayStr])

  // Ajustar hora si la fecha cambia a hoy y la hora seleccionada quedó en el pasado
  useEffect(() => {
    if (availableTimeSlots.length > 0 && (!startTime || !availableTimeSlots.includes(startTime))) {
      setStartTime(availableTimeSlots[0])
    }
  }, [availableTimeSlots, startTime])

  // Limpiar cupón si cambian detalles de la reserva (cancha, fecha, hora, duración)
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponError("Los detalles de la reserva cambiaron. Por favor vuelve a validar el cupón.")
    }
  }, [selectedCourtId, dateStr, startTime, duration])

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
      if (appliedCoupon) {
        setTotalPrice(String(appliedCoupon.netPrice))
        setAmountPaid(String(appliedCoupon.netPrice))
      } else {
        setTotalPrice(String(calculatedPricing.totalPrice))
        setAmountPaid(String(calculatedPricing.totalPrice))
      }
    }
  }, [calculatedPricing, isManualPriceEdited, appliedCoupon])

  // Validación de cupón en API
  const handleValidateCoupon = async () => {
    const code = couponCodeInput.trim().toUpperCase()
    if (!code) {
      toast.error("Por favor ingresa un código de cupón")
      return
    }
    if (!selectedCourtId) {
      toast.error("Por favor selecciona una cancha primero")
      return
    }

    setIsValidatingCoupon(true)
    setCouponError(null)

    try {
      const res: any = await previewClubCoupon({
        code,
        courtId: selectedCourtId,
        basePrice: calculatedPricing.totalPrice,
        date: dateStr,
        startTime,
        duration: Number(duration),
        userEmail: userEmail.trim() || undefined,
      })

      if (!res.valid) {
        throw new Error(res.reason || res.message || "El cupón no es válido para esta reserva")
      }

      const discountAmount = Number(res.discountAmount ?? res.calculatedDiscount ?? 0)
      const netPrice = Number(res.netPrice ?? res.newTotalPrice ?? Math.max(0, calculatedPricing.totalPrice - discountAmount))
      const rewardName = res.rewardName || "Cupón de Descuento"
      const couponCode = res.code || code

      const normalizedCoupon = {
        ...res,
        code: couponCode,
        rewardName,
        discountAmount,
        netPrice,
        calculatedDiscount: discountAmount,
        newTotalPrice: netPrice,
      }

      setAppliedCoupon(normalizedCoupon)
      setTotalPrice(String(netPrice))
      setAmountPaid(String(netPrice))

      if (res.user?.email && !userEmail.trim()) {
        setUserEmail(res.user.email)
      }
      if (res.user?.name && !customerName.trim()) {
        setCustomerName(res.user.name)
      }

      toast.success(
        netPrice === 0
          ? `¡Cupón aplicado! Reserva 100% bonificada (${rewardName})`
          : `¡Cupón aplicado! Descuento de S/ ${discountAmount.toFixed(2)} (${rewardName})`
      )
    } catch (err: any) {
      console.error("Error al validar cupón:", err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo validar el cupón. Verifica que el código sea correcto y pertenezca a este club."
      setCouponError(msg)
      setAppliedCoupon(null)
      toast.error(msg)
    } finally {
      setIsValidatingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCodeInput("")
    setCouponError(null)
    setTotalPrice(String(calculatedPricing.totalPrice))
    setAmountPaid(String(calculatedPricing.totalPrice))
    toast.info("Cupón removido")
  }

  // Cálculos de saldo
  const numTotal = Number(totalPrice || (appliedCoupon ? appliedCoupon.netPrice : calculatedPricing.totalPrice) || 0)
  const isBonified = appliedCoupon !== null && numTotal === 0
  const numPaid = isBonified ? 0 : Number(amountPaid !== "" ? amountPaid : numTotal)
  const saldoFaltante = isBonified ? 0 : Math.max(0, Number((numTotal - numPaid).toFixed(2)))
  const isFullPaid = isBonified || (numTotal > 0 && numPaid >= numTotal - 0.05)
  const isPartial = !isBonified && !isFullPaid && numPaid > 0
  const isUnpaid = !isBonified && numPaid === 0

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
        paymentMethod: isBonified ? 'coupon' : paymentMethod.toLowerCase(),
        posCommission: paymentMethod === 'pos' && !isBonified ? Number(posCommission) : undefined,
        amountPaid: numPaid,
        customerInfo: {
          name: customerName.trim() || undefined,
          email: userEmail.trim(),
          phone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        pricing: {
          basePrice: calculatedPricing.totalPrice / Number(duration),
          discounts:
            (calculatedPricing.hasPromo
              ? (calculatedPricing.regularSlotPrice - calculatedPricing.unitSlotPrice) * calculatedPricing.slotCount
              : 0) + (appliedCoupon ? appliedCoupon.discountAmount : 0),
          taxes: 0,
          totalPrice: numTotal,
        },
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      }

      await createReservationManual(payload)

      toast.success(
        isBonified
          ? "¡Reserva 100% bonificada registrada con éxito!"
          : isFullPaid
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

          {/* Cupón de Fidelidad */}
          <div className="space-y-2 p-2.5 bg-muted/20 border rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <TicketIcon className="w-3.5 h-3.5 text-primary" />
                <span>Cupón de Fidelidad (opcional)</span>
              </div>
              {appliedCoupon && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                  Cupón Aplicado
                </Badge>
              )}
            </div>

            {!appliedCoupon ? (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Código de canje (ej: TC-ABC123)"
                    value={couponCodeInput}
                    onChange={(e) => {
                      setCouponCodeInput(e.target.value.toUpperCase())
                      setCouponError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleValidateCoupon()
                      }
                    }}
                    className="h-8 text-xs font-mono uppercase tracking-wide"
                    disabled={isValidatingCoupon}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs shrink-0 font-medium"
                    onClick={handleValidateCoupon}
                    disabled={isValidatingCoupon || !couponCodeInput.trim() || !selectedCourtId}
                  >
                    {isValidatingCoupon ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        Validando...
                      </>
                    ) : (
                      "Validar"
                    )}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="w-3 h-3 shrink-0" />
                    {couponError}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Aplica un cupón de puntos para descontar o bonificar la hora de la reserva.
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-emerald-800 dark:text-emerald-300">
                        {appliedCoupon.code}
                      </span>
                      <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                        • {appliedCoupon.rewardName}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {appliedCoupon.netPrice === 0
                        ? "¡100% Bonificado! Descuento total de S/ " + appliedCoupon.discountAmount.toFixed(2)
                        : `Descuento aplicado: S/ ${appliedCoupon.discountAmount.toFixed(2)}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                    onClick={handleRemoveCoupon}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sección de Pago */}
          <div className="space-y-2 p-2.5 bg-muted/30 border rounded-md">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs text-foreground">
                Detalle del Pago
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  isBonified
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    : isFullPaid
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : isPartial
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {isBonified ? "Bonificado (S/ 0.00)" : isFullPaid ? "Pago Completo" : isPartial ? "Adelanto" : "Pendiente"}
              </span>
            </div>

            {/* Resumen de Desglose si hay cupón */}
            {appliedCoupon && (
              <div className="p-2 rounded bg-muted/40 border text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Tarifa base calculada:</span>
                  <span>S/ {calculatedPricing.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                  <span>Descuento cupón ({appliedCoupon.rewardName}):</span>
                  <span>-S/ {appliedCoupon.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total a pagar:</span>
                  <span className={isBonified ? "text-purple-600 dark:text-purple-400 font-bold" : "text-foreground"}>
                    {isBonified ? "S/ 0.00 (100% Bonificado)" : `S/ ${appliedCoupon.netPrice.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            {isBonified ? (
              <div className="p-2.5 rounded bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-xs text-purple-800 dark:text-purple-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Reserva bonificada al 100%
                </p>
                <p className="text-[11px] mt-0.5 text-purple-700 dark:text-purple-400">
                  No requiere cobro en caja. La reserva se confirmará automáticamente como bonificada por el cupón de fidelidad.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {appliedCoupon ? "Total con Descuento (S/)" : "Precio Total (S/)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.50"
                    className="h-8 text-xs font-medium"
                    value={totalPrice}
                    disabled={appliedCoupon !== null}
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
                      <SelectItem value="pos">POS (Tarjeta)</SelectItem>
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

                {paymentMethod === 'pos' && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Comisión POS (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-xs font-medium"
                      value={posCommission}
                      onChange={(e) => setPosCommission(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mensaje de saldo */}
            {!isBonified && (
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
            )}
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
            className={
              isBonified
                ? "bg-purple-600 hover:bg-purple-700 text-white font-medium"
                : "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            }
            disabled={isSaving || availableTimeSlots.length === 0}
            onClick={handleSave}
          >
            {isSaving
              ? "Guardando..."
              : isBonified
              ? "Confirmar Reserva Bonificada"
              : "Guardar Reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
