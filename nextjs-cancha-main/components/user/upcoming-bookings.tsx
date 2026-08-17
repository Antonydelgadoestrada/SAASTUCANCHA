"use client"

import { CalendarIcon, MapPinIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Datos de ejemplo
const upcomingBookings = [
  {
    id: 1,
    courtName: "Cancha de Fútbol 5",
    venueName: "Club Deportivo Norte",
    date: new Date(2025, 5, 15, 18, 0),
    duration: 1,
    status: "confirmed",
    price: 35,
  },
  {
    id: 2,
    courtName: "Cancha de Tenis #3",
    venueName: "Club Deportivo Central",
    date: new Date(2025, 5, 18, 10, 0),
    duration: 2,
    status: "pending",
    price: 40,
  },
  {
    id: 3,
    courtName: "Cancha de Básquet",
    venueName: "Polideportivo Municipal",
    date: new Date(2025, 5, 20, 19, 0),
    duration: 1,
    status: "confirmed",
    price: 30,
  },
]

export function UserUpcomingBookings() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {upcomingBookings.map((booking) => (
        <Card key={booking.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between">
              <CardTitle className="text-lg">{booking.courtName}</CardTitle>
              <Badge variant={booking.status === "confirmed" ? "default" : "outline"}>
                {booking.status === "confirmed" ? "Confirmada" : "Pendiente"}
              </Badge>
            </div>
            <CardDescription>{booking.venueName}</CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{format(booking.date, "EEEE d 'de' MMMM, h:mm a", { locale: es })}</span>
              </div>
              <div className="flex items-center">
                <MapPinIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>
                  Duración: {booking.duration} {booking.duration === 1 ? "hora" : "horas"}
                </span>
              </div>
              <div className="font-medium">Precio: ${booking.price}</div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">
              Ver detalles
            </Button>
            <Button size="sm">Cancelar</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
