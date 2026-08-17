"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, MapPinIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"

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

export function UserBookingsContent() {
  const [activeTab, setActiveTab] = useState("upcoming")
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [bookings, setBookings] = useState<any[]>([]);

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
  const upcomingBookings = bookings.filter((booking) => booking.status === "confirmed" && booking.date > new Date())

  const pendingBookings = bookings.filter((booking) => booking.status === "pending")

  const pastBookings = bookings.filter(
    (booking) =>
      booking.status === "completed" ||
      booking.status === "cancelled" ||
      (booking.status === "confirmed" && booking.date < new Date()),
  )

  const handleViewDetails = (booking: any) => {
    setSelectedBooking(booking)
    setIsDialogOpen(true)
  }

  const handlePayment = (booking: any) => {
    setSelectedBooking(booking)
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
              {upcomingBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={booking.court.images[0] || "/placeholder.svg"}
                      alt={booking.court.venue.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{booking.court.name}</CardTitle>
                        <CardDescription>{booking.court.venue.name}</CardDescription>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{format(booking.date, "EEEE d 'de' MMMM", { locale: es })}</span>
                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>
                          Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                        </span>
                      </div>
                      <div className="font-medium">Precio: S/{booking.pricing.totalPrice}</div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => handleViewDetails(booking)}>
                      Ver detalles
                    </Button>
                    <Button variant="destructive">Cancelar</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-xl font-medium">No tienes reservas próximas</h3>
                <p className="mt-2 text-muted-foreground">
                  Busca y reserva canchas deportivas para ver tus próximas reservas aquí.
                </p>
                <Button className="mt-4">Buscar Canchas</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          {pendingBookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pendingBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                       src={booking.court.images[0] || "/placeholder.svg"}
                       alt={booking.court.venue.name}
                       className="h-full w-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{booking.court.name}</CardTitle>
                        <CardDescription>{booking.court.venue.name}</CardDescription>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{format(booking.date, "EEEE d 'de' MMMM", { locale: es })}</span> {", "}
                        <span>{booking.startTime}</span>
                      </div>
    
                      <div className="flex items-center">
                        <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>
                          Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                        </span>
                      </div>
                      <div className="font-medium">Precio: S/{booking.pricing.totalPrice}</div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => handleViewDetails(booking)}>
                      Ver detalles
                    </Button>
                    <Button onClick={() => handlePayment(booking)}>Pagar ahora</Button>
                  </CardFooter>
                </Card>
              ))}
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
              {pastBookings.map((booking) => (
                <Card key={booking.id} className="overflow-hidden">
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={booking.court.images[0] || "/placeholder.svg"}
                      alt={booking.court.venue.name}
                      className="h-full w-full object-cover opacity-70"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{booking.court.name}</CardTitle>
                        <CardDescription>{booking.court.venue.name}</CardDescription>
                      </div>
                      {getStatusBadge(booking.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{format(booking.date, "EEEE d 'de' MMMM", { locale: es })}</span>

                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>
                          Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                        </span>
                      </div>
                      <div className="font-medium">Precio: S/{booking.pricing.totalPrice}</div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => handleViewDetails(booking)}>
                      Ver detalles
                    </Button>
                  </CardFooter>
                </Card>
              ))}
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
              <DialogDescription>Información completa de tu reserva en {selectedBooking.court.venue.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {selectedBooking.court.venue.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-medium">{selectedBooking.court.name}</h3>
                  <p className="text-muted-foreground">{selectedBooking.court.venue.name}</p>
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
                    {format(selectedBooking.date, "EEEE d 'de' MMMM, yyyy", { locale: es })} a las{" "}
                    {selectedBooking.startTime}
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
                  <p className="text-sm text-muted-foreground">S/ {selectedBooking.pricing.totalPrice}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Código de reserva</h4>
                  <p className="text-sm font-mono text-muted-foreground">
                    {`SC-${selectedBooking.id.toString().padStart(6, "0")}`}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Instrucciones</h4>
                  <p className="text-sm text-muted-foreground">
                    Preséntate 15 minutos antes de tu reserva. Lleva tu identificación y el código de reserva.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              {selectedBooking.status === "confirmed" && selectedBooking.date > new Date() && (
                <>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cerrar
                  </Button>
                  <Button variant="destructive" onClick={handleCancelBooking} disabled={isLoading}>
                    {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : "Cancelar Reserva"}
                  </Button>
                </>
              )}
              {selectedBooking.status === "pending" && (
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
              )}
              {(selectedBooking.status === "completed" ||
                selectedBooking.status === "cancelled" ||
                (selectedBooking.status === "confirmed" && selectedBooking.date < new Date())) && (
                <Button onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo de pago */}
      {selectedBooking && (
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Pagar Reserva</DialogTitle>
              <DialogDescription>
                Completa el pago para confirmar tu reserva en {selectedBooking.court.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium">{selectedBooking.court.name}</h3>
                  <span className="font-medium">S/ {selectedBooking.pricing.totalPrice}</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <MapPinIcon className="mr-2 h-4 w-4" />
                    <span>{selectedBooking.court.venue.name}</span>
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{format(selectedBooking.date, "EEEE d 'de' MMMM", { locale: es })}</span>
                    <span>{selectedBooking.startTime}</span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="mr-2 h-4 w-4" />
                    <span>
                      Duración: {selectedBooking.duration} {selectedBooking.duration === 1 ? "hora" : "horas"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
            
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Total</span>
                  <span className="font-medium">S/ {(selectedBooking.pricing.totalPrice)}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleProcessPayment} disabled={isLoading}>
                {isLoading ? <ClockIcon className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Pago"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
