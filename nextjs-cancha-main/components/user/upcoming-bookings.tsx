"use client"

import { CalendarIcon, ClockIcon, MapPinIcon } from "lucide-react"
import { es } from "date-fns/locale"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { parseSafeDate, formatSafeDate } from "@/lib/utils"
import { BookingStatusBadge } from "@/components/ui/booking-status-badge"
import { BookingExpirationTimer } from "@/components/booking/booking-expiration-timer"

interface UserUpcomingBookingsProps {
  bookings: any[]
}

export function UserUpcomingBookings({ bookings }: UserUpcomingBookingsProps) {
  // Filtrar reservas que están pendientes o confirmadas y son futuras
  const upcomingBookings = bookings
    .filter((booking) => {
      const isPendingOrConfirmed = booking.status === "confirmed" || booking.status === "pending"
      if (!isPendingOrConfirmed) return false
      
      const bookingDateTime = parseSafeDate(booking.date, booking.startTime)
      return bookingDateTime ? bookingDateTime >= new Date() : false
    })
    .slice(0, 3) // Mostrar máximo 3 en el dashboard

  if (upcomingBookings.length === 0) {
    return (
      <Card className="border-dashed border-2 py-8 flex flex-col items-center justify-center text-center">
        <CardContent className="space-y-3">
          <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">No tienes próximas reservas</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Encuentra la cancha perfecta para tu deporte favorito y reserva en segundos.
            </p>
          </div>
          <Link href="/user/search" passHref>
            <Button size="sm">Buscar Canchas</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {upcomingBookings.map((booking) => {
        const formattedDate = formatSafeDate(booking.date, "EEEE d 'de' MMMM", { locale: es })
        return (
          <Card key={booking.id} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold">{booking.court?.name || "Cancha Deportiva"}</CardTitle>
                  <CardDescription className="font-semibold text-muted-foreground">
                    {booking.court?.venue?.name || "Complejo Deportivo"}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <BookingStatusBadge status={booking.status} />
                  {booking.status === "pending" && (
                    <BookingExpirationTimer
                      compact
                      createdAt={booking.createdAt}
                      paymentMethod={booking.paymentMethod || booking.payment?.method}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="space-y-2 text-sm text-muted-foreground font-medium">
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4.5 w-4.5 text-primary shrink-0" />
                  <span className="capitalize">{formattedDate}</span>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="mr-2 h-4.5 w-4.5 text-primary shrink-0" />
                  <span>
                    {booking.startTime} - {booking.endTime} ({booking.duration} {booking.duration === 1 ? "hora" : "horas"})
                  </span>
                </div>
                {booking.court?.venue?.address && (
                  <div className="flex items-center">
                    <MapPinIcon className="mr-2 h-4.5 w-4.5 text-primary shrink-0" />
                    <span className="truncate">{booking.court.venue.address}</span>
                  </div>
                )}
                <div className="pt-2 font-bold text-foreground">
                  Total: S/ {booking.pricing?.totalPrice || (booking.court ? (booking.duration * 2 * (parseFloat(booking.court.priceDay) || 0)) : 0)}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/40">
              <Link href="/user/bookings" className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  Administrar Reserva
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
