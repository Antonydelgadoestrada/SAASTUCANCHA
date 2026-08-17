"use client"

import { CalendarIcon, ClockIcon, MapPinIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRecentBookings } from "@/components/user/recent-bookings"
import { UserUpcomingBookings } from "@/components/user/upcoming-bookings"

export function UserDashboardContent() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Bienvenido de vuelta</h2>
          <p className="text-muted-foreground">Aquí puedes ver tus próximas reservas y buscar canchas disponibles.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservas Activas</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Tienes 3 reservas pendientes</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                Ver todas
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Canchas Favoritas</CardTitle>
              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">Tienes 5 canchas favoritas</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                Ver favoritas
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Reservadas</CardTitle>
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Este mes has reservado 12 horas</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                Ver historial
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Próximas Reservas</h2>
          <p className="text-sm text-muted-foreground">Tus próximas reservas programadas.</p>
        </div>
        <UserUpcomingBookings />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Reservas Recientes</h2>
          <p className="text-sm text-muted-foreground">Historial de tus últimas reservas.</p>
        </div>
        <UserRecentBookings />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Canchas Recomendadas</h2>
          <p className="text-sm text-muted-foreground">Basado en tus reservas anteriores.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                <img
                  src={`/placeholder.svg?height=200&width=400&text=Cancha ${i}`}
                  alt={`Cancha ${i}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle>Cancha de Fútbol {i}</CardTitle>
                <CardDescription>Club Deportivo Example</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPinIcon className="mr-1 h-4 w-4" />
                  <span>Av. Ejemplo 123, Ciudad</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium">$30/hora</span>
                  <div className="flex items-center space-x-1">
                    {Array(5)
                      .fill(null)
                      .map((_, i) => (
                        <svg
                          key={i}
                          className="h-4 w-4 fill-primary"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Reservar</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
