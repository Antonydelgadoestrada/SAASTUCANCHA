"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BookingStatusBadge } from "@/components/ui/booking-status-badge"

// Datos de ejemplo
const recentBookings = [
  {
    id: 1,
    courtName: "Cancha de Fútbol 5",
    user: {
      name: "Juan Pérez",
      email: "juan@example.com",
    },
    date: new Date(2025, 5, 12, 18, 0),
    duration: 1,
    status: "confirmed",
    price: 35,
  },
  {
    id: 2,
    courtName: "Cancha de Tenis #3",
    user: {
      name: "María López",
      email: "maria@example.com",
    },
    date: new Date(2025, 5, 12, 20, 0),
    duration: 2,
    status: "pending",
    price: 80,
  },
  {
    id: 3,
    courtName: "Cancha de Pádel #2",
    user: {
      name: "Carlos Rodríguez",
      email: "carlos@example.com",
    },
    date: new Date(2025, 5, 13, 10, 0),
    duration: 1,
    status: "confirmed",
    price: 25,
  },
  {
    id: 4,
    courtName: "Cancha de Básquet",
    user: {
      name: "Ana Martínez",
      email: "ana@example.com",
    },
    date: new Date(2025, 5, 13, 16, 0),
    duration: 1,
    status: "cancelled",
    price: 30,
  },
  {
    id: 5,
    courtName: "Cancha de Fútbol 7",
    user: {
      name: "Roberto Gómez",
      email: "roberto@example.com",
    },
    date: new Date(2025, 5, 14, 19, 0),
    duration: 2,
    status: "confirmed",
    price: 90,
  },
]

export function ClubRecentBookings() {
  return (
    <div className="space-y-8">
      {recentBookings.map((booking) => (
        <div key={booking.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {booking.user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{booking.user.name}</p>
            <p className="text-sm text-muted-foreground">
              {booking.courtName} - {format(booking.date, "d MMM, HH:mm", { locale: es })}
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm font-medium">S/ {booking.price}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
