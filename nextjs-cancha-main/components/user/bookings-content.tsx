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

// Datos de ejemplo
// const bookings = [
//   {
//     id: 1,
//     courtName: "Cancha de Fútbol 5",
//     venueName: "Club Deportivo Norte",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Club+Norte",
//     date: new Date(2025, 5, 15, 18, 0),
//     duration: 1,
//     status: "pending",
//     price: 35,
//   },
//   {
//     id: 2,
//     courtName: "Cancha de Tenis #3",
//     venueName: "Club Deportivo Central",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Club+Central",
//     date: new Date(2025, 5, 18, 10, 0),
//     duration: 2,
//     status: "confirmed",
//     price: 80,
//   },
//   {
//     id: 3,
//     courtName: "Cancha de Pádel #2",
//     venueName: "Club Deportivo Este",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Club+Este",
//     date: new Date(2025, 5, 20, 19, 0),
//     duration: 1,
//     status: "confirmed",
//     price: 25,
//   },
//   {
//     id: 4,
//     courtName: "Cancha de Básquet",
//     venueName: "Polideportivo Municipal",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Polideportivo",
//     date: new Date(2025, 5, 10, 17, 0),
//     duration: 1,
//     status: "cancelled",
//     price: 30,
//   },
//   {
//     id: 5,
//     courtName: "Cancha de Fútbol 7",
//     venueName: "Club Deportivo Sur",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Club+Sur",
//     date: new Date(2025, 5, 5, 19, 0),
//     duration: 2,
//     status: "completed",
//     price: 90,
//   },
//   {
//     id: 6,
//     courtName: "Cancha de Vóley",
//     venueName: "Club Deportivo Oeste",
//     venueImage: "/placeholder.svg?height=200&width=400&text=Club+Oeste",
//     date: new Date(2025, 5, 3, 16, 0),
//     duration: 1,
//     status: "completed",
//     price: 20,
//   },
// ]

const getBookingTimeRange = (startTime: string, duration: number) => {
  if (!startTime) return "";
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + duration * 60, 0, 0);
  const endH = d.getHours().toString().padStart(2, "0");
  const endM = d.getMinutes().toString().padStart(2, "0");
  return `${startTime} a ${endH}:${endM}`;
};

export function UserBookingsContent() {
  const [activeTab, setActiveTab] = useState("upcoming")
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [bookings, setBookings] = useState<any[]>([]);

  // Estados para pago manual (Yape / Plin)
  const [payMethod, setPayMethod] = useState<"mercadopago" | "yape" | "plin">("yape")
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

      // 2. Registrar el pago manual en el backend
      const totalPrice = getBookingTotalPrice(selectedBooking)
      await createBookingPayment(selectedBooking.id, {
        metodo: payMethod === "yape" ? "YAPE" : "PLIN",
        tipo: "PAGO_COMPLETO",
        monto: totalPrice,
        comprobanteUrl,
      })

      toast.success(`¡Comprobante de ${payMethod === "yape" ? "Yape" : "Plin"} enviado! El club verificará tu pago.`)
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
        const data = await getAllReservationByUser();
        setBookings(data);
      } catch (error) {
        console.error("Error al obtener reservas", error);
      }
    };
  
    fetchBookings();
  }, []);
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
    setReceiptFile(null)
    setReceiptPreview(null)
    setIsPaymentDialogOpen(true)
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return

    setIsLoading(true)

    try {
      // Simular retraso de red
      await new Promise((resolve) => setTimeout(resolve, 1500))

      toast.success("Reserva cancelada correctamente")
      setIsDialogOpen(false)

      // En una aplicación real, aquí se actualizaría el estado de la reserva en la base de datos
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
      // Simular retraso de red
      // await new Promise((resolve) => setTimeout(resolve, 2000))
      const {init_point} = await confirmPayment(selectedBooking)
      // Redireccionar al checkout de Mercado Pago
      if (init_point) {
        window.location.href = init_point;
      } else {
        toast.error("Error al procesar el pago")
      }

      toast.success("Pago procesado correctamente")
      setIsPaymentDialogOpen(false)
      // En una aplicación real, aquí se actualizaría el estado de la reserva en la base de datos
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
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-500">
            <CheckCircleIcon className="h-3 w-3" />
            Confirmada
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-amber-500 text-amber-500">
            <ClockIcon className="h-3 w-3" />
            Pendiente de pago
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-destructive text-destructive">
            <XCircleIcon className="h-3 w-3" />
            Cancelada
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-500">
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
        <p className="text-muted-foreground">Gestiona tus reservas de canchas deportivas.</p>
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

        <TabsContent value="upcoming" className="mt-6">
          {upcomingBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const totalPrice = getBookingTotalPrice(booking)

                const clubWhatsApp = booking.court?.club?.whatsapp || booking.club?.whatsapp || booking.club?.phone

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between">
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
                            <CardTitle>{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                              {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                            </span>
                          </div>
                          <div className="font-medium">Precio: S/{totalPrice}</div>
                        </div>
                      </CardContent>
                    </div>
                    <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                      <div className="flex justify-between w-full gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewDetails(booking)}>
                          Ver detalles
                        </Button>
                        <Button variant="destructive" size="sm" className="flex-1">Cancelar</Button>
                      </div>
                      {clubWhatsApp && (
                        <a
                          href={getWhatsAppLink(
                            clubWhatsApp,
                            `¡Hola! Tengo una consulta sobre mi reserva #${booking.id} para la cancha "${courtName}" (${venueName}) el ${formatSafeDate(booking.date, "dd/MM/yyyy", { locale: es })} a las ${booking.startTime || ""}.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 text-xs font-semibold gap-1.5 h-8"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-[#25D366] text-white" />
                            Chatear con el Club por WhatsApp
                          </Button>
                        </a>
                      )}
                    </CardFooter>
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

        <TabsContent value="pending" className="mt-6">
          {pendingBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pendingBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const totalPrice = getBookingTotalPrice(booking)
                const clubWhatsApp = booking.court?.club?.whatsapp || booking.club?.whatsapp || booking.club?.phone

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between">
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
                            <CardTitle>{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                              {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                            </span>
                          </div>
        
                          <div className="flex items-center">
                            <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                            </span>
                          </div>
                          <div className="font-medium">Precio: S/{totalPrice}</div>
                        </div>
                      </CardContent>
                    </div>
                    <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                      <div className="flex justify-between w-full gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewDetails(booking)}>
                          Ver detalles
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => handlePayment(booking)}>Pagar ahora</Button>
                      </div>
                      {clubWhatsApp && (
                        <a
                          href={getWhatsAppLink(
                            clubWhatsApp,
                            `¡Hola! Tengo una consulta sobre mi reserva pendiente #${booking.id} para la cancha "${courtName}" (${venueName}).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 text-xs font-semibold gap-1.5 h-8"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-[#25D366] text-white" />
                            Consultar al WhatsApp del Club
                          </Button>
                        </a>
                      )}
                    </CardFooter>
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

        <TabsContent value="past" className="mt-6">
          {pastBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastBookings.map((booking) => {
                const courtImage = Array.isArray(booking.court?.images) && booking.court.images.length > 0 ? booking.court.images[0] : "/placeholder.svg"
                const courtName = booking.court?.name || "Cancha Deportiva"
                const venueName = booking.court?.club?.name || booking.club?.name || "Complejo Deportivo"
                const totalPrice = getBookingTotalPrice(booking)
                const clubWhatsApp = booking.court?.club?.whatsapp || booking.club?.whatsapp || booking.club?.phone

                return (
                  <Card key={booking.id} className="overflow-hidden flex flex-col justify-between">
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
                            <CardTitle>{courtName}</CardTitle>
                            <CardDescription>{venueName}</CardDescription>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              {formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })}
                              {booking.startTime ? `, ${getBookingTimeRange(booking.startTime, booking.duration)}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span>
                              Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                            </span>
                          </div>
                          <div className="font-medium">Precio: S/{totalPrice}</div>
                        </div>
                      </CardContent>
                    </div>
                    <CardFooter className="flex flex-col gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => handleViewDetails(booking)}>
                        Ver detalles
                      </Button>
                      {clubWhatsApp && (
                        <a
                          href={getWhatsAppLink(
                            clubWhatsApp,
                            `¡Hola! Quisiera volver a reservar la cancha "${courtName}" (${venueName}).`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 text-xs font-semibold gap-1.5 h-8"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-[#25D366] text-white" />
                            Volver a contactar por WhatsApp
                          </Button>
                        </a>
                      )}
                    </CardFooter>
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

      {/* Diálogo de detalles de la reserva */}
      {selectedBooking && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalles de la Reserva</DialogTitle>
              <DialogDescription>
                Información completa de tu reserva en {selectedBooking.court?.club?.name || selectedBooking.club?.name || "el Complejo Deportivo"}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {(selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-medium">{selectedBooking.court?.name || "Cancha Deportiva"}</h3>
                  <p className="text-muted-foreground">{selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo"}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Estado</h4>
                  {getStatusBadge(selectedBooking.status)}
                </div>

                <div>
                  <h4 className="text-sm font-medium">Fecha y hora</h4>
                  <p className="text-sm text-muted-foreground">
                    {formatSafeDate(selectedBooking.date, "EEEE d 'de' MMMM, yyyy", { locale: es })} de{" "}
                    {getBookingTimeRange(selectedBooking.startTime, selectedBooking.duration)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Duración</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.duration} {selectedBooking.duration === 1 ? "hora" : "horas"}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Precio</h4>
                  <p className="text-sm text-muted-foreground">
                    S/ {getBookingTotalPrice(selectedBooking)}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Código de reserva</h4>
                  <p className="text-sm font-mono text-muted-foreground">
                    {`SC-${selectedBooking.id?.toString().padStart(6, "0") || "000000"}`}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Instrucciones</h4>
                  <p className="text-sm text-muted-foreground">
                    Preséntate 15 minutos antes de tu reserva. Lleva tu identificación y el código de reserva.
                  </p>
                </div>

                {(() => {
                  const modalWhatsApp = selectedBooking.court?.club?.whatsapp || selectedBooking.club?.whatsapp || selectedBooking.club?.phone
                  if (!modalWhatsApp) return null
                  return (
                    <div className="pt-2">
                      <a
                        href={getWhatsAppLink(
                          modalWhatsApp,
                          `¡Hola! Tengo una consulta sobre mi reserva #${selectedBooking.id} para la cancha "${selectedBooking.court?.name || "Cancha"}" (${selectedBooking.court?.club?.name || selectedBooking.club?.name || ""}) el ${formatSafeDate(selectedBooking.date, "dd/MM/yyyy", { locale: es })}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 font-semibold text-xs gap-2 h-9"
                        >
                          <MessageCircle className="h-4 w-4 fill-[#25D366] text-white" />
                          Chatear al WhatsApp del Club
                        </Button>
                      </a>
                    </div>
                  )
                })()}
              </div>
            </div>
            <DialogFooter>
              {(() => {
                const bookingDateTime = parseSafeDate(selectedBooking.date, selectedBooking.startTime)
                const isFuture = bookingDateTime ? bookingDateTime >= new Date() : false
                
                if (selectedBooking.status === "confirmed" && isFuture) {
                  return (
                    <>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cerrar
                      </Button>
                      <Button variant="destructive" onClick={handleCancelBooking} disabled={isLoading}>
                        {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : "Cancelar Reserva"}
                      </Button>
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

      {/* Diálogo de pago */}
      {selectedBooking && (
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pagar o Regularizar Reserva</DialogTitle>
              <DialogDescription>
                Completa el pago para confirmar tu turno en {selectedBooking.court?.name || "la cancha"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Resumen de reserva */}
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span>{selectedBooking.court?.name || "Cancha Deportiva"}</span>
                  <span className="text-primary font-bold text-base">
                    S/ {getBookingTotalPrice(selectedBooking)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <MapPinIcon className="mr-2 h-3.5 w-3.5" />
                    <span>{selectedBooking.court?.club?.name || selectedBooking.club?.name || "Complejo Deportivo"}</span>
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

              {/* Selector de métodos de pago */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Método de pago:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod("yape")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 text-center transition-all ${
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
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 text-center transition-all ${
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
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border-2 text-center transition-all ${
                      payMethod === "mercadopago"
                        ? "border-sky-500 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <CreditCardIcon className="h-4 w-4 mb-1 text-sky-500" />
                    <span className="text-xs">Mercado Pago</span>
                  </button>
                </div>
              </div>

              {/* Detalle si es YAPE o PLIN */}
              {(payMethod === "yape" || payMethod === "plin") && (
                <div className="space-y-3 p-3.5 rounded-xl border border-dashed bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Pago con {payMethod === "yape" ? "Yape" : "Plin"}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold text-primary">
                      Total: S/ {getBookingTotalPrice(selectedBooking)}
                    </Badge>
                  </div>

                  {/* Número y QR del Club */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {/* Número */}
                    {(() => {
                      const club = selectedBooking.court?.club || selectedBooking.club
                      const phone = (payMethod === "yape" ? club?.yapeNumero : club?.plinNumero) || club?.whatsapp || club?.phone || "987 654 321"
                      return (
                        <div className="p-2.5 bg-card rounded-lg border space-y-1">
                          <span className="text-[11px] text-muted-foreground">Número de {payMethod === "yape" ? "Yape" : "Plin"}:</span>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono font-bold">{phone}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-xs"
                              onClick={() => handleCopyPhone(phone)}
                            >
                              {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              <span className="ml-1 text-[11px]">{copiedPhone ? "Listo" : "Copiar"}</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* QR */}
                    {(() => {
                      const club = selectedBooking.court?.club || selectedBooking.club
                      const qrUrl = payMethod === "yape" ? club?.yapeQrUrl : club?.plinQrUrl
                      return (
                        <div className="p-2.5 bg-card rounded-lg border flex items-center justify-between gap-2">
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
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold flex items-center gap-1">
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      Captura del Comprobante *
                    </label>

                    {receiptPreview ? (
                      <div className="relative border rounded-lg p-2 bg-card flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <img src={receiptPreview} alt="Comprobante" className="h-12 w-12 rounded object-cover border" />
                          <div className="truncate">
                            <p className="text-xs font-medium truncate">{receiptFile?.name}</p>
                            <p className="text-[10px] text-muted-foreground">
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
                      <label className="border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                        <Upload className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xs font-medium text-primary">Subir comprobante de pago</span>
                        <span className="text-[10px] text-muted-foreground">Formatos: PNG, JPG, WEBP (Máx. 10MB)</span>
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
                <div className="p-3 rounded-lg border bg-sky-50/60 dark:bg-sky-950/20 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <CreditCardIcon className="h-3.5 w-3.5" />
                    Pago Inmediato con Mercado Pago
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Serás redirigido a la pasarela segura para pagar con tarjeta de débito o crédito.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>

              {payMethod === "yape" || payMethod === "plin" ? (
                <Button
                  onClick={handleConfirmManualReceipt}
                  disabled={isLoading || !receiptFile}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Enviar Comprobante
                </Button>
              ) : (
                <Button onClick={handleProcessPayment} disabled={isLoading} className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5">
                  {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : <CreditCardIcon className="h-4 w-4" />}
                  Pagar con Mercado Pago
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
