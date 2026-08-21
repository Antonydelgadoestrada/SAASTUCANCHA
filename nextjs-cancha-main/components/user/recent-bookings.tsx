"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, CheckCircleIcon, ClockIcon, XCircleIcon, HistoryIcon } from "lucide-react"
import Link from "next/link"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

interface UserRecentBookingsProps {
  bookings: any[]
}

export function UserRecentBookings({ bookings }: UserRecentBookingsProps) {
  // Filtrar reservas que ya pasaron o están finalizadas/canceladas
  const recentBookings = bookings
    .filter((booking) => {
      const isPastStatus = booking.status === "completed" || booking.status === "cancelled"
      if (isPastStatus) return true
      
      if (!booking.date || !booking.startTime) return false;
      const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`)
      return bookingDateTime < new Date()
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
    switch (status) {
      case "completed":
      case "confirmed":
        return (
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 flex w-fit items-center gap-1">
            <CheckCircleIcon className="h-3 w-3" />
            <span>Completada</span>
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="destructive" className="flex w-fit items-center gap-1">
            <XCircleIcon className="h-3 w-3" />
            <span>Cancelada</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="flex w-fit items-center gap-1">
            <span>Finalizada</span>
          </Badge>
        )
    }
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
                  const safeDate = booking.date ? new Date(booking.date + "T00:00:00") : new Date()
                  const formattedDate = booking.date ? format(safeDate, "d MMM yyyy", { locale: es }) : "Fecha no disponible"
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
                        <Link href="/user/bookings">
                          <Button variant="ghost" size="sm">
                            Ver detalles
                          </Button>
                        </Link>
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
          const safeDate = booking.date ? new Date(booking.date + "T00:00:00") : new Date()
          const formattedDate = booking.date ? format(safeDate, "d MMM yyyy", { locale: es }) : "Fecha no disponible"
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
                <Link href="/user/bookings" className="w-full">
                  <Button variant="outline" size="sm" className="w-full">
                    Ver detalles
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </>
  )
}
