"use client"

import { useEffect, useState } from "react"
import { es } from "date-fns/locale"
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  MapPinIcon,
  XCircleIcon,
  MessageCircle,
  Smartphone,
  Upload,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  X,
  Banknote,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAllReservationByUser } from "@/lib/reservation"
import { confirmPayment } from "@/lib/mercadopago"
import { parseSafeDate, formatSafeDate, getBookingTotalPrice } from "@/lib/utils"
import { getWhatsAppLink, uploadPaymentReceipt, createBookingPayment } from "@/lib/payments"

const getBookingTimeRange = (startTime: string, duration: number) => {
  if (!startTime) return ""
  const [h, m] = startTime.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m + duration * 60, 0, 0)
  const endH = d.getHours().toString().padStart(2, "0")
  const endM = d.getMinutes().toString().padStart(2, "0")
  return `${startTime} a ${endH}:${endM}`
}

export function getBookingPaymentDetails(booking: any) {
  if (!booking) {
    return {
      totalPrice: 0,
      paidAmount: 0,
      isAdvance: false,
      isSaldoPaid: false,
      isSaldoPendingVerification: false,
      hasPendingSaldo: false,
      saldoRemaining: 0,
      isFullyPaid: false,
      paymentMethodName: "No especificado",
    }
  }

  const totalPrice = getBookingTotalPrice(booking)
  const payment = booking.payment
  const paidAmount = payment?.amount ? Number(payment.amount) : 0
  
  // Es adelanto si el tipo es ADELANTO o si se pagó un monto menor al total y mayor a 0
  const isAdvance = payment?.type === "ADELANTO" || (paidAmount > 0 && paidAmount < totalPrice)
  const isSaldoPaid = payment?.saldoStatus === "PAGADO"
  const isSaldoPendingVerification = payment?.saldoStatus === "PENDIENTE" && !!payment?.saldoComprobanteUrl
  
  // Saldo pendiente
  const hasPendingSaldo = (isAdvance && !isSaldoPaid) || (booking.status === "confirmed" && paidAmount < totalPrice && paidAmount > 0 && !isSaldoPaid)
  const saldoRemaining = hasPendingSaldo ? Math.max(0, Number((totalPrice - paidAmount).toFixed(2))) : 0
  const isFullyPaid = isSaldoPaid || (paidAmount >= totalPrice && paidAmount > 0 && !isAdvance)

  const paymentMethodName = payment?.method || payment?.paymentMethod || booking.paymentMethod || "Yape / Plin"

  return {
    totalPrice,
    paidAmount,
    isAdvance,
    isSaldoPaid,
    isSaldoPendingVerification,
    hasPendingSaldo,
    saldoRemaining,
    isFullyPaid,
    paymentMethodName,
  }
}

export function UserBookingsContent() {
  const [activeTab, setActiveTab] = useState("upcoming")
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<"INITIAL" | "SALDO">("INITIAL")
  const [isLoading, setIsLoading] = useState(false)
  const [bookings, setBookings] = useState<any[]>([])

  // Estados para métodos de pago (Yape / Plin / Mercado Pago / Efectivo)
  const [payMethod, setPayMethod] = useState<"yape" | "plin" | "mercadopago" | "efectivo">("yape")
  const [payOption, setPayOption] = useState<"advance" | "full">("advance")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [copiedPhone, setCopiedPhone] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida (PNG, JPG, WEBP)")
      return
    }
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setReceiptPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCopyPhone = (phoneText?: string) => {
    if (!phoneText) return
    navigator.clipboard.writeText(phoneText)
    setCopiedPhone(true)
    toast.success(`Número ${phoneText} copiado al portapapeles`)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const handleConfirmManualReceipt = async () => {
    if (!selectedBooking) return
    if (!receiptFile) {
      toast.error(`Por favor adjunta la captura de tu comprobante de ${payMethod === "yape" ? "Yape" : "Plin"}`)
      return
    }

    setIsLoading(true)
    try {
      // 1. Subir comprobante a S3
      const uploadRes = await uploadPaymentReceipt(receiptFile)
      const comprobanteUrl = uploadRes?.url

      const fin = getBookingPaymentDetails(selectedBooking)

      if (paymentMode === "SALDO") {
        // Cancelación de saldo restante
        const payAmount = fin.saldoRemaining
        await createBookingPayment(selectedBooking.id, {
          method: payMethod === "yape" ? "YAPE" : "PLIN",
          metodo: payMethod === "yape" ? "YAPE" : "PLIN",
          type: "SALDO",
          tipo: "SALDO",
          amount: payAmount,
          monto: payAmount,
          comprobanteUrl,
        })
        toast.success(`¡Comprobante de saldo enviado por S/ ${payAmount.toFixed(2)}! El club validará tu liquidación.`)
      } else {
        // Calcular montos y tipo de pago inicial (Adelanto vs Completo)
        const totalPrice = fin.totalPrice
        const club = selectedBooking.court?.club || selectedBooking.club
        const advancePercent = Number(club?.porcentajeAdelantoDefault ?? 50)
        const advanceAmount = Math.max(1, Number(((totalPrice * advancePercent) / 100).toFixed(2)))
        const payAmount = payOption === "advance" ? advanceAmount : totalPrice
        const payType = payOption === "advance" ? "ADELANTO" : "PAGO_COMPLETO"

        // Registrar el pago inicial en el backend
        await createBookingPayment(selectedBooking.id, {
          method: payMethod === "yape" ? "YAPE" : "PLIN",
          metodo: payMethod === "yape" ? "YAPE" : "PLIN",
          type: payType,
          tipo: payType,
          amount: payAmount,
          monto: payAmount,
          comprobanteUrl,
        })

        const remainingText = payOption === "advance" ? ` (Saldo pendiente en club: S/ ${(totalPrice - advanceAmount).toFixed(2)})` : ""
        toast.success(`¡Comprobante de ${payMethod === "yape" ? "Yape" : "Plin"} enviado por S/ ${payAmount.toFixed(2)}!${remainingText}`)
      }

      setIsPaymentDialogOpen(false)
      setReceiptFile(null)
      setReceiptPreview(null)

      // Refrescar lista de reservas
      const updated = await getAllReservationByUser()
      setBookings(updated)
    } catch (error: any) {
      console.error("Error al enviar comprobante:", error)
      toast.error(error?.response?.data?.message || "No se pudo registrar el comprobante. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar reservas según la pestaña activa
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await getAllReservationByUser()
        setBookings(data)
      } catch (error) {
        console.error("Error al obtener reservas", error)
      }
    }
  
    fetchBookings()
  }, [])

  const upcomingBookings = bookings.filter((booking) => {
    if (booking.status !== "confirmed") return false
    const d = parseSafeDate(booking.date, booking.startTime)
    return d ? d >= new Date() : false
  })

  const pendingBookings = bookings.filter((booking) => booking.status === "pending")

  const pastBookings = bookings.filter((booking) => {
    if (booking.status === "completed" || booking.status === "cancelled") return true
    if (booking.status === "confirmed") {
      const d = parseSafeDate(booking.date, booking.startTime)
      return d ? d < new Date() : false
    }
    return false
  })

  const handleViewDetails = (booking: any) => {
    setSelectedBooking(booking)
    setIsDialogOpen(true)
  }

  const handlePayment = (booking: any) => {
    setSelectedBooking(booking)
    setPaymentMode("INITIAL")
    setPayMethod("yape")
    setReceiptFile(null)
    setReceiptPreview(null)
    setIsPaymentDialogOpen(true)
  }

  const handlePaySaldo = (booking: any) => {
    setSelectedBooking(booking)
    setPaymentMode("SALDO")
    setPayMethod("yape")
    setReceiptFile(null)
    setReceiptPreview(null)
    setIsPaymentDialogOpen(true)
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return

    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      toast.success("Reserva cancelada correctamente")
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al cancelar la reserva")
    } finally {
      setIsLoading(false)
    }
  }

  const handleProcessPayment = async () => {
    if (!selectedBooking) return
    setIsLoading(true)

    try {
      const fin = getBookingPaymentDetails(selectedBooking)
      const amount = paymentMode === "SALDO" ? fin.saldoRemaining : undefined
      const { init_point } = await confirmPayment({ id: selectedBooking.id, amount })
      if (init_point) {
        window.location.href = init_point
      } else {
        toast.error("Error al procesar el pago con Mercado Pago")
      }
    } catch (error) {
      toast.error("Error al procesar el pago")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-600 bg-green-500/10">
            <CheckCircleIcon className="h-3 w-3" />
            Confirmada
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-amber-500 text-amber-600 bg-amber-500/10">
            <ClockIcon className="h-3 w-3" />
            Pendiente de pago
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive bg-destructive/10">
            <XCircleIcon className="h-3 w-3" />
            Cancelada
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-600 bg-blue-500/10">
            <CheckCircleIcon className="h-3 w-3" />
            Completada
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Mis Reservas</h2>
        <p className="text-muted-foreground">Gestiona tus reservas, consulta estados y cancela tus saldos pendientes.</p>
      </div>

      <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Próximas
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {upcomingBookings.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4" />
            Pendientes
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {pendingBookings.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="past" className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA: PRÓXIMAS RESERVAS */}
        <TabsContent value="upcoming" className="mt-6">
          {upcomingBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.venue?.name || booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const club = booking.court?.venue?.club || booking.court?.club || booking.club
                const clubPhone = club?.whatsapp || club?.phone || booking.court?.venue?.phone
                const fin = getBookingPaymentDetails(booking)

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between border shadow-sm">
                    <div>
                      <div className="aspect-video w-full overflow-hidden relative">
                        <img
                          src={courtImage}
                          alt={venueName}
                          className="h-full w-full object-cover"
                        />
                        {fin.hasPendingSaldo ? (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold shadow">
                              Saldo Pendiente: S/ {fin.saldoRemaining.toFixed(2)}
                            </Badge>
                          </div>
                        ) : fin.isFullyPaid ? (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow">
                              ✓ 100% Pagado
                            </Badge>
                          </div>
                        ) : null}
                      </div>

                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3 text-sm">
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-foreground/70" />
                            <span className="font-medium text-foreground">
                              {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                              {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <ClockIcon className="mr-2 h-4 w-4 text-foreground/70" />
                            <span>
                              Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                            </span>
                          </div>
                        </div>

                        {/* Bloque Financiero y Estado de Saldo */}
                        {fin.hasPendingSaldo ? (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                <AlertCircle className="h-3.5 w-3.5" /> Saldo Pendiente:
                              </span>
                              <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                                S/ {fin.saldoRemaining.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-amber-500/20">
                              <span>Abonado: S/ {fin.paidAmount.toFixed(2)}</span>
                              <span>Total Cancha: S/ {fin.totalPrice.toFixed(2)}</span>
                            </div>
                            {fin.isSaldoPendingVerification && (
                              <div className="pt-1 text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                                <ClockIcon className="h-3 w-3 animate-spin" />
                                Comprobante del saldo en revisión por el club
                              </div>
                            )}
                          </div>
                        ) : fin.isFullyPaid ? (
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between font-medium">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Totalmente cancelado
                            </span>
                            <span className="font-bold">S/ {fin.totalPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div className="font-medium text-xs">Precio Total: S/ {fin.totalPrice.toFixed(2)}</div>
                        )}
                      </CardContent>
                    </div>

                    <div className="space-y-2 pt-2">
                      {clubPhone && (
                        <div className="px-6">
                          <a
                            href={getWhatsAppLink(
                              clubPhone,
                              `¡Hola ${club?.name || ""}! Tengo una consulta sobre mi reserva para la cancha "${courtName}" (${formatSafeDate(booking.date, "dd/MM/yyyy")}).`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                            Consultar al WhatsApp del Club
                          </a>
                        </div>
                      )}

                      <CardFooter className="flex items-center gap-2">
                        <Button variant="outline" className="flex-1 text-xs" onClick={() => handleViewDetails(booking)}>
                          Ver detalles
                        </Button>
                        {fin.hasPendingSaldo ? (
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1 shadow-sm"
                            onClick={() => handlePaySaldo(booking)}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Pagar Saldo (S/ {fin.saldoRemaining})
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            className="text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => { setSelectedBooking(booking); handleCancelBooking() }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </CardFooter>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-medium">No tienes reservas próximas</h3>
                <p className="mt-2 text-muted-foreground">
                  Busca y reserva canchas deportivas para ver tus próximas reservas aquí.
                </p>
                <Link href="/user/search" passHref>
                  <Button className="mt-4">Buscar Canchas</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PESTAÑA: RESERVAS PENDIENTES */}
        <TabsContent value="pending" className="mt-6">
          {pendingBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pendingBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.venue?.name || booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const totalPrice = getBookingTotalPrice(booking)
                const club = booking.court?.venue?.club || booking.court?.club || booking.club
                const clubPhone = club?.whatsapp || club?.phone || booking.court?.venue?.phone

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between border shadow-sm">
                    <div>
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={courtImage}
                          alt={venueName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center text-xs">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                            {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                          </span>
                        </div>
      
                        <div className="flex items-center text-xs">
                          <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>
                            Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                          </span>
                        </div>
                        <div className="font-semibold text-sm">Precio Total: S/ {totalPrice}</div>

                        {booking.paymentMethod?.toLowerCase() === "whatsapp" || booking.payment?.metodo?.toLowerCase() === "whatsapp" || booking.payment?.method?.toLowerCase() === "whatsapp" ? (
                          <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                            💬 <strong>Coordinación WhatsApp:</strong> Horario bloqueado por <strong>2 horas</strong>. El administrador confirmará tu reserva manualmente desde su panel.
                          </div>
                        ) : (
                          <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
                            ⏱️ <strong>Tolerancia:</strong> Sube tu comprobante dentro de los <strong>15 min</strong> de reservar para asegurar tu horario.
                          </div>
                        )}
                      </CardContent>
                    </div>

                    <div className="space-y-2 pt-2">
                      {clubPhone && (
                        <div className="px-6">
                          <a
                            href={getWhatsAppLink(
                              clubPhone,
                              `¡Hola ${club?.name || ""}! Tengo una consulta sobre mi reserva para la cancha "${courtName}" (${formatSafeDate(booking.date, "dd/MM/yyyy")}).`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                            Consultar al WhatsApp del Club
                          </a>
                        </div>
                      )}
                      <CardFooter className="flex justify-between gap-2">
                        <Button variant="outline" className="flex-1 text-xs" onClick={() => handleViewDetails(booking)}>
                          Ver detalles
                        </Button>
                        <Button className="flex-1 text-xs bg-primary" onClick={() => handlePayment(booking)}>
                          Pagar ahora
                        </Button>
                      </CardFooter>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCardIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-medium">No tienes pagos pendientes</h3>
                <p className="mt-2 text-muted-foreground">Todas tus reservas están confirmadas y pagadas.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PESTAÑA: HISTORIAL */}
        <TabsContent value="past" className="mt-6">
          {pastBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.venue?.name || booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const totalPrice = getBookingTotalPrice(booking)
                const club = booking.court?.venue?.club || booking.court?.club || booking.club
                const clubPhone = club?.whatsapp || club?.phone || booking.court?.venue?.phone

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between border shadow-sm">
                    <div>
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={courtImage}
                          alt={venueName}
                          className="h-full w-full object-cover opacity-70"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center text-xs">
                          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                            {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center text-xs">
                          <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>
                            Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                          </span>
                        </div>
                        <div className="font-medium text-xs">Precio: S/{totalPrice}</div>
                      </CardContent>
                    </div>

                    <div className="space-y-2 pt-2">
                      {clubPhone && (
                        <div className="px-6">
                          <a
                            href={getWhatsAppLink(
                              clubPhone,
                              `¡Hola ${club?.name || ""}! Tengo una consulta sobre mi reserva pasada para la cancha "${courtName}".`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                            Consultar al WhatsApp del Club
                          </a>
                        </div>
                      )}
                      <CardFooter>
                        <Button variant="outline" className="w-full text-xs" onClick={() => handleViewDetails(booking)}>
                          Ver detalles
                        </Button>
                      </CardFooter>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClockIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-medium">No tienes reservas pasadas</h3>
                <p className="mt-2 text-muted-foreground">Tu historial de reservas aparecerá aquí.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE DETALLES DE LA RESERVA */}
      {selectedBooking && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles de la Reserva</DialogTitle>
              <DialogDescription>
                Información completa de tu reserva en {selectedBooking.court?.venue?.name || selectedBooking.court?.club?.name || selectedBooking.club?.name || "el Complejo Deportivo"}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {(selectedBooking.court?.venue?.name || selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-medium">{selectedBooking.court?.name || "Cancha Deportiva"}</h3>
                  <p className="text-muted-foreground">{selectedBooking.court?.venue?.name || selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo"}</p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Estado</h4>
                  {getStatusBadge(selectedBooking.status)}
                </div>

                <div>
                  <h4 className="font-medium">Fecha y hora</h4>
                  <p className="text-muted-foreground">
                    {formatSafeDate(selectedBooking.date, "EEEE d 'de' MMMM, yyyy", { locale: es })} de{" "}
                    {getBookingTimeRange(selectedBooking.startTime, selectedBooking.duration)}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Duración</h4>
                  <p className="text-muted-foreground">
                    {selectedBooking.duration} {selectedBooking.duration === 1 ? "hora" : "horas"}
                  </p>
                </div>

                {/* Desglose Financiero */}
                {(() => {
                  const fin = getBookingPaymentDetails(selectedBooking)
                  return (
                    <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
                      <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Desglose de Pagos</h4>
                      <div className="flex items-center justify-between text-xs">
                        <span>Precio Total de la Cancha:</span>
                        <span className="font-semibold">S/ {fin.totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <span>Monto Abonado:</span>
                        <span className="font-semibold">S/ {fin.paidAmount.toFixed(2)} ({fin.paymentMethodName})</span>
                      </div>
                      {fin.hasPendingSaldo ? (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                          <span>Saldo Restante Pendiente:</span>
                          <span className="text-sm">S/ {fin.saldoRemaining.toFixed(2)}</span>
                        </div>
                      ) : fin.isFullyPaid ? (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t text-emerald-600 font-bold">
                          <span>Estado del Saldo:</span>
                          <span>✓ 100% Liquidado</span>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}

                <div>
                  <h4 className="font-medium">Código de reserva</h4>
                  <p className="font-mono text-muted-foreground">
                    {`SC-${selectedBooking.id?.toString().padStart(6, "0") || "000000"}`}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Instrucciones</h4>
                  <p className="text-muted-foreground">
                    Preséntate 15 minutos antes de tu reserva. Lleva tu identificación y el código de reserva.
                  </p>
                </div>

                {(() => {
                  const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                  const venue = selectedBooking.court?.venue
                  const phone = club?.whatsapp || club?.phone || venue?.phone
                  if (!phone) return null
                  return (
                    <div className="mt-1 pt-3 border-t">
                      <a
                        href={getWhatsAppLink(
                          phone,
                          `¡Hola ${club?.name || ""}! Tengo una consulta sobre mi reserva para la cancha "${selectedBooking.court?.name || ""}" (${formatSafeDate(selectedBooking.date, "dd/MM/yyyy")}).`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        <MessageCircle className="h-4 w-4 fill-white text-emerald-600" />
                        Chatear al WhatsApp del Club
                      </a>
                    </div>
                  )
                })()}
              </div>
            </div>
            <DialogFooter className="gap-2">
              {(() => {
                const bookingDateTime = parseSafeDate(selectedBooking.date, selectedBooking.startTime)
                const isFuture = bookingDateTime ? bookingDateTime >= new Date() : false
                const fin = getBookingPaymentDetails(selectedBooking)
                
                if (selectedBooking.status === "confirmed" && isFuture) {
                  return (
                    <>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cerrar
                      </Button>
                      {fin.hasPendingSaldo && (
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                          onClick={() => {
                            setIsDialogOpen(false)
                            handlePaySaldo(selectedBooking)
                          }}
                        >
                          <Banknote className="h-4 w-4" />
                          Pagar Saldo (S/ {fin.saldoRemaining})
                        </Button>
                      )}
                    </>
                  )
                }

                if (selectedBooking.status === "pending") {
                  return (
                    <>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cerrar
                      </Button>
                      <Button
                        onClick={() => {
                          setIsDialogOpen(false)
                          handlePayment(selectedBooking)
                        }}
                      >
                        Pagar Ahora
                      </Button>
                    </>
                  )
                }

                return <Button onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
              })()}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIÁLOGO DE PAGO O CANCELACIÓN DE SALDO RESTANTE */}
      {selectedBooking && (
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {paymentMode === "SALDO" ? (
                  <>
                    <Banknote className="h-5 w-5 text-emerald-600" />
                    Cancelar Saldo Restante
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="h-5 w-5 text-primary" />
                    Pagar Reserva
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {paymentMode === "SALDO"
                  ? `Elige el método de pago para liquidar el saldo pendiente de tu reserva en ${selectedBooking.court?.name || "la cancha"}.`
                  : `Completa el pago para asegurar tu turno en ${selectedBooking.court?.name || "la cancha"}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Resumen Financiero */}
              {(() => {
                const fin = getBookingPaymentDetails(selectedBooking)
                return (
                  <div className="rounded-xl bg-muted/60 border p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-base">{selectedBooking.court?.name || "Cancha Deportiva"}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
                        Total: S/ {fin.totalPrice.toFixed(2)}
                      </span>
                    </div>

                    {paymentMode === "SALDO" && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-muted-foreground">Ya abonado: S/ {fin.paidAmount.toFixed(2)}</p>
                          <p className="text-amber-800 dark:text-amber-300 font-bold text-sm">
                            Saldo a Cancelar: S/ {fin.saldoRemaining.toFixed(2)}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                          Pendiente
                        </Badge>
                      </div>
                    )}

                    <div className="space-y-1 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center">
                        <MapPinIcon className="mr-2 h-3.5 w-3.5" />
                        <span>{selectedBooking.court?.venue?.name || selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo"}</span>
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        <span>{formatSafeDate(selectedBooking.date, "EEEE d 'de' MMMM", { locale: es })}</span>
                        <span className="ml-1.5 font-medium">{selectedBooking.startTime}</span>
                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="mr-2 h-3.5 w-3.5" />
                        <span>
                          Duración: {selectedBooking.duration} {selectedBooking.duration === 1 ? "hora" : "horas"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Política de Adelanto (solo si es pago inicial) */}
              {paymentMode === "INITIAL" && (() => {
                const totalPrice = getBookingTotalPrice(selectedBooking)
                const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                const advancePercent = Number(club?.porcentajeAdelantoDefault ?? 50)
                const advanceAmount = Math.max(1, Number(((totalPrice * advancePercent) / 100).toFixed(2)))
                const remainingAmount = Math.max(0, Number((totalPrice - advanceAmount).toFixed(2)))

                return (
                  <div className="space-y-2 p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <span>📋</span> Política de Reserva del Club
                      </span>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                        Adelanto {advancePercent}%
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      El club requiere como mínimo el <strong>{advancePercent}% (S/ {advanceAmount})</strong> para separar tu cancha. Puedes abonar el adelanto ahora y cancelar el saldo restante antes de jugar, o pagar el total.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPayOption("advance")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          payOption === "advance"
                            ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500 font-semibold"
                            : "border-border bg-card/60 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Pagar Adelanto ({advancePercent}%)</span>
                          {payOption === "advance" && <Check className="h-3 w-3 text-amber-600" />}
                        </div>
                        <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                          S/ {advanceAmount}
                        </p>
                        <span className="text-[10px] text-muted-foreground">Falta en club: S/ {remainingAmount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPayOption("full")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          payOption === "full"
                            ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500 font-semibold"
                            : "border-border bg-card/60 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Pagar Total (100%)</span>
                          {payOption === "full" && <Check className="h-3 w-3 text-emerald-600" />}
                        </div>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                          S/ {totalPrice}
                        </p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">100% Cancelado</span>
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Selector de métodos de pago */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  MÉTODO DE PAGO:
                </label>
                <div className={`grid ${paymentMode === "SALDO" ? "grid-cols-4" : "grid-cols-3"} gap-2`}>
                  <button
                    type="button"
                    onClick={() => setPayMethod("yape")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all ${
                      payMethod === "yape"
                        ? "border-[#720e9e] bg-[#720e9e]/10 font-bold text-[#720e9e] dark:text-purple-300 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1 text-[#720e9e] dark:text-purple-400" />
                    <span className="text-xs">Yape</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("plin")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all ${
                      payMethod === "plin"
                        ? "border-[#00bcd4] bg-[#00bcd4]/10 font-bold text-[#008ba3] dark:text-cyan-300 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1 text-[#00bcd4]" />
                    <span className="text-xs">Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("mercadopago")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all ${
                      payMethod === "mercadopago"
                        ? "border-sky-500 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <CreditCardIcon className="h-4 w-4 mb-1 text-sky-500" />
                    <span className="text-xs">Mercado Pago</span>
                  </button>

                  {paymentMode === "SALDO" && (
                    <button
                      type="button"
                      onClick={() => setPayMethod("efectivo")}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all ${
                        payMethod === "efectivo"
                          ? "border-emerald-600 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300 shadow-sm"
                          : "border-border hover:border-muted-foreground/40 bg-card"
                      }`}
                    >
                      <Banknote className="h-4 w-4 mb-1 text-emerald-600" />
                      <span className="text-xs">En Club</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Detalle si es YAPE o PLIN */}
              {(payMethod === "yape" || payMethod === "plin") && (
                <div className="space-y-3 p-4 rounded-xl border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Pago con {payMethod === "yape" ? "Yape" : "Plin"}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold text-emerald-600 border-emerald-500/40 bg-emerald-500/10">
                      Monto a transferir: S/ {
                        (() => {
                          const fin = getBookingPaymentDetails(selectedBooking)
                          if (paymentMode === "SALDO") {
                            return fin.saldoRemaining.toFixed(2)
                          }
                          const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                          const advancePercent = Number(club?.porcentajeAdelantoDefault ?? 50)
                          const advanceAmount = Math.max(1, Number(((fin.totalPrice * advancePercent) / 100).toFixed(2)))
                          return payOption === "advance" ? advanceAmount.toFixed(2) : fin.totalPrice.toFixed(2)
                        })()
                      }
                    </Badge>
                  </div>

                  {/* Número y QR del Club */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Número */}
                    {(() => {
                      const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                      const venue = selectedBooking.court?.venue
                      const phone = (payMethod === "yape" ? club?.yapeNumero : club?.plinNumero) || club?.whatsapp || venue?.phone || club?.phone || "987654321"
                      return (
                        <div className="p-3 bg-muted/40 rounded-xl border space-y-1.5 flex flex-col justify-between">
                          <span className="text-[11px] text-muted-foreground">Número de {payMethod === "yape" ? "Yape" : "Plin"}:</span>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-bold">{phone}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyPhone(phone)}
                            >
                              {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              <span className="ml-1 text-xs">{copiedPhone ? "Listo" : "Copiar"}</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* QR */}
                    {(() => {
                      const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                      const qrUrl = payMethod === "yape" ? club?.yapeQrUrl : club?.plinQrUrl
                      return (
                        <div className="p-3 bg-muted/40 rounded-xl border flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">Código QR Oficial</span>
                          {qrUrl ? (
                            <img src={qrUrl} alt="QR" className="h-10 w-10 object-contain rounded border bg-white p-0.5" />
                          ) : (
                            <QrCode className="h-6 w-6 text-muted-foreground opacity-40" />
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Subida de Comprobante */}
                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-semibold flex items-center gap-1">
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      Captura del Comprobante {paymentMode === "SALDO" ? "del Saldo" : ""} *
                    </label>

                    {receiptPreview ? (
                      <div className="relative border rounded-xl p-2.5 bg-muted/30 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img src={receiptPreview} alt="Comprobante" className="h-12 w-12 rounded-lg object-cover border" />
                          <div className="truncate">
                            <p className="text-xs font-medium truncate">{receiptFile?.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {receiptFile ? `${(receiptFile.size / 1024).toFixed(1)} KB` : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setReceiptFile(null)
                            setReceiptPreview(null)
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/5 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                        <Upload className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xs font-medium text-primary">Subir comprobante de pago</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">Formatos: PNG, JPG, WEBP (Máx. 10MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Detalle si es Mercado Pago */}
              {payMethod === "mercadopago" && (
                <div className="p-3.5 rounded-xl border bg-sky-50/60 dark:bg-sky-950/20 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5 text-sm">
                    <CreditCardIcon className="h-4 w-4 text-sky-600" />
                    {paymentMode === "SALDO" ? "Pago del Saldo con Mercado Pago" : "Pago Inmediato con Mercado Pago"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Serás redirigido a la pasarela segura para abonar {paymentMode === "SALDO" ? `el saldo de S/ ${getBookingPaymentDetails(selectedBooking).saldoRemaining.toFixed(2)}` : "tu reserva"} mediante tarjeta de crédito o débito.
                  </p>
                </div>
              )}

              {/* Detalle si es Efectivo / En Club */}
              {payMethod === "efectivo" && paymentMode === "SALDO" && (
                <div className="p-4 rounded-xl border bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-sm">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    Pago en Recepción / Efectivo
                  </p>
                  <p className="text-[12px] leading-relaxed">
                    Puedes cancelar el saldo de <strong>S/ {getBookingPaymentDetails(selectedBooking).saldoRemaining.toFixed(2)}</strong> directamente en la recepción del club en efectivo o POS al momento de llegar a jugar. ¡Tu turno ya está asegurado!
                  </p>
                  {(() => {
                    const club = selectedBooking.court?.venue?.club || selectedBooking.court?.club || selectedBooking.club
                    const venue = selectedBooking.court?.venue
                    const phone = club?.whatsapp || club?.phone || venue?.phone
                    if (!phone) return null
                    return (
                      <a
                        href={getWhatsAppLink(
                          phone,
                          `¡Hola ${club?.name || ""}! Te confirmo que pagaré el saldo restante de S/ ${getBookingPaymentDetails(selectedBooking).saldoRemaining.toFixed(2)} en recepción al llegar para mi reserva en "${selectedBooking.court?.name || "la cancha"}".`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5 fill-white text-emerald-600" />
                        Avisar por WhatsApp al Club
                      </a>
                    )
                  })()}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isLoading}>
                {payMethod === "efectivo" && paymentMode === "SALDO" ? "Entendido / Cerrar" : "Cancelar"}
              </Button>

              {payMethod === "yape" || payMethod === "plin" ? (
                <Button
                  onClick={handleConfirmManualReceipt}
                  disabled={isLoading || !receiptFile}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {paymentMode === "SALDO" ? "Enviar Comprobante del Saldo" : "Enviar Comprobante"}
                </Button>
              ) : payMethod === "mercadopago" ? (
                <Button onClick={handleProcessPayment} disabled={isLoading} className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5">
                  {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : <CreditCardIcon className="h-4 w-4" />}
                  {paymentMode === "SALDO" ? `Pagar Saldo (S/ ${getBookingPaymentDetails(selectedBooking).saldoRemaining.toFixed(2)})` : "Pagar con Mercado Pago"}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
