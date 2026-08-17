"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

// Datos de ejemplo
const recentBookings = [
  {
    id: 1,
    courtName: "Cancha de Fútbol 7",
    venueName: "Club Deportivo Sur",
    date: new Date(2025, 5, 1, 16, 0),
    duration: 2,
    status: "completed",
    price: 70,
  },
  {
    id: 2,
    courtName: "Cancha de Pádel #2",
    venueName: "Club Deportivo Este",
    date: new Date(2025, 5, 5, 19, 0),
    duration: 1,
    status: "completed",
    price: 25,
  },
  {
    id: 3,
    courtName: "Cancha de Tenis #1",
    venueName: "Club Deportivo Central",
    date: new Date(2025, 5, 8, 10, 0),
    duration: 1.5,
    status: "cancelled",
    price: 45,
  },
  {
    id: 4,
    courtName: "Cancha de Básquet",
    venueName: "Polideportivo Municipal",
    date: new Date(2025, 5, 10, 17, 0),
    duration: 1,
    status: "completed",
    price: 30,
  },
]

export function UserRecentBookings() {
  return (
    <>
      {/* Vista para escritorio */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cancha</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{booking.courtName}</div>
                        <div className="text-sm text-muted-foreground">{booking.venueName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {format(booking.date, "d MMM yyyy, HH:mm", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                      </div>
                    </TableCell>
                    <TableCell>${booking.price}</TableCell>
                    <TableCell>
                      <Badge
                        variant={booking.status === "completed" ? "default" : "destructive"}
                        className="flex w-fit items-center gap-1"
                      >
                        {booking.status === "completed" ? (
                          <CheckCircleIcon className="h-3 w-3" />
                        ) : (
                          <XCircleIcon className="h-3 w-3" />
                        )}
                        {booking.status === "completed" ? "Completada" : "Cancelada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Ver detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between border-t p-4">
            <div className="text-sm text-muted-foreground">Mostrando {recentBookings.length} reservas recientes</div>
            <Button variant="outline" size="sm">
              Ver todas
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Vista para móvil */}
      <div className="grid gap-4 md:hidden">
        {recentBookings.map((booking) => (
          <Card key={booking.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-medium">{booking.courtName}</h3>
                  <p className="text-sm text-muted-foreground">{booking.venueName}</p>
                </div>
                <Badge
                  variant={booking.status === "completed" ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {booking.status === "completed" ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <XCircleIcon className="h-3 w-3" />
                  )}
                  {booking.status === "completed" ? "Completada" : "Cancelada"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{format(booking.date, "d MMM yyyy, HH:mm", { locale: es })}</span>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>
                    {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                  </span>
                </div>
                <div className="font-medium">Precio: ${booking.price}</div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                Ver detalles
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  )
}
