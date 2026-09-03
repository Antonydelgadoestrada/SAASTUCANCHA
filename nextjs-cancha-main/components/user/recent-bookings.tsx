"use client"

import { es } from "date-fns/locale"
import { CalendarIcon, CheckCircleIcon, ClockIcon, XCircleIcon, HistoryIcon, MapPinIcon, CreditCardIcon } from "lucide-react"
import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { parseSafeDate, formatSafeDate } from "@/lib/utils"
import { BookingStatusBadge } from "@/components/ui/booking-status-badge"

interface UserRecentBookingsProps {
  bookings: any[]
}

export function UserRecentBookings({ bookings }: UserRecentBookingsProps) {
  // Filtrar reservas que ya pasaron o están finalizadas/canceladas
  const recentBookings = bookings
    .filter((booking) => {
      const isPastStatus = booking.status === "completed" || booking.status === "cancelled"
      if (isPastStatus) return true
      
      const bookingDateTime = parseSafeDate(booking.date, booking.startTime)
      return bookingDateTime ? bookingDateTime < new Date() : false
    })
    .slice(0, 5) // Mostrar máximo 5

  if (recentBookings.length === 0) {
    return (
      <Card className="border-dashed border-2 py-8 flex flex-col items-center justify-center text-center">
        <CardContent className="space-y-3">
          <HistoryIcon className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Sin historial reciente</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Aquí aparecerán tus reservas finalizadas o canceladas una vez que empieces a jugar.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = (status: string) => {
    return <BookingStatusBadge status={status} />
  }

  return (
    <>
      {/* Vista para escritorio */}
      <div className="hidden md:block">
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cancha</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBookings.map((booking) => {
                  const formattedDate = formatSafeDate(booking.date, "d MMM yyyy", { locale: es })
                  const price = booking.pricing?.totalPrice || (booking.court ? (booking.duration * 2 * (parseFloat(booking.court.priceDay) || 0)) : 0)
                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <div className="font-semibold text-foreground">{booking.court?.name || "Cancha Deportiva"}</div>
                          <div className="text-xs text-muted-foreground font-medium">{booking.court?.venue?.name || "Complejo Deportivo"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground font-medium">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                          <span className="capitalize">{formattedDate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground font-medium">
                          <ClockIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                          <span>
                            {booking.startTime} - {booking.endTime} ({booking.duration} {booking.duration === 1 ? "hora" : "horas"})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-foreground">S/ {price}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell className="text-right">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Ver detalles
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="overflow-y-auto">
                            <SheetHeader className="mb-6">
                              <SheetTitle>Detalles de la Reserva</SheetTitle>
                              <SheetDescription>
                                ID: {booking.id?.split('-')[0].toUpperCase()}
                              </SheetDescription>
                            </SheetHeader>
                            
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <MapPinIcon className="h-4 w-4 text-primary" /> 
                                  Lugar
                                </h3>
                                <p className="text-sm font-medium">{booking.court?.name || "Cancha"}</p>
                                <p className="text-sm text-muted-foreground">{booking.court?.venue?.name || "Complejo Deportivo"}</p>
                              </div>

                              <div className="space-y-2">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <ClockIcon className="h-4 w-4 text-primary" /> 
                                  Fecha y Hora
                                </h3>
                                <p className="text-sm capitalize">{formattedDate}</p>
                                <p className="text-sm text-muted-foreground">
                                  {booking.startTime} - {booking.endTime} ({booking.duration} {booking.duration === 1 ? "hora" : "horas"})
                                </p>
                              </div>

                              <div className="space-y-2">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                  <CreditCardIcon className="h-4 w-4 text-primary" /> 
                                  Pago y Estado
                                </h3>
                                <p className="text-sm font-bold">Precio total: S/ {price}</p>
                                <div className="pt-1">
                                  Estado de reserva: <span className="ml-2">{getStatusBadge(booking.status)}</span>
                                </div>
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-4">
            <div className="text-sm text-muted-foreground font-semibold">
              Mostrando {recentBookings.length} reservas recientes
            </div>
            <Link href="/user/bookings">
              <Button variant="outline" size="sm">
                Ver todas
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Vista para móvil */}
      <div className="grid gap-4 md:hidden">
        {recentBookings.map((booking) => {
          const formattedDate = formatSafeDate(booking.date, "d MMM yyyy", { locale: es })
          const price = booking.pricing?.totalPrice || (booking.court ? (booking.duration * 2 * (parseFloat(booking.court.priceDay) || 0)) : 0)
          return (
            <Card key={booking.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-foreground">{booking.court?.name || "Cancha Deportiva"}</h3>
                    <p className="text-xs text-muted-foreground font-medium">{booking.court?.venue?.name || "Complejo"}</p>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>
              </CardHeader>
              <CardContent className="pb-2 text-sm text-muted-foreground font-medium space-y-2">
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span className="capitalize">{formattedDate}</span>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                  <span>
                    {booking.startTime} - {booking.endTime} ({booking.duration} {booking.duration === 1 ? "hora" : "horas"})
                  </span>
                </div>
                <div className="font-bold text-foreground">Precio: S/ {price}</div>
              </CardContent>
              <CardFooter className="pt-3 border-t border-border/40">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Ver detalles
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh] overflow-y-auto rounded-t-2xl">
                    <SheetHeader className="mb-6">
                      <SheetTitle>Detalles de la Reserva</SheetTitle>
                      <SheetDescription>
                        ID: {booking.id?.split('-')[0].toUpperCase()}
                      </SheetDescription>
                    </SheetHeader>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4 text-primary" /> 
                          Lugar
                        </h3>
                        <p className="text-sm font-medium">{booking.court?.name || "Cancha"}</p>
                        <p className="text-sm text-muted-foreground">{booking.court?.venue?.name || "Complejo Deportivo"}</p>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-primary" /> 
                          Fecha y Hora
                        </h3>
                        <p className="text-sm capitalize">{formattedDate}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.startTime} - {booking.endTime} ({booking.duration} {booking.duration === 1 ? "hora" : "horas"})
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <CreditCardIcon className="h-4 w-4 text-primary" /> 
                          Pago y Estado
                        </h3>
                        <p className="text-sm font-bold">Precio total: S/ {price}</p>
                        <div className="pt-1">
                          Estado de reserva: <span className="ml-2">{getStatusBadge(booking.status)}</span>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </>
  )
}
