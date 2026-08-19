"use client"

import { useEffect, useState } from "react"
import { CalendarIcon, ClockIcon, MapPinIcon, RefreshCw, Star } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRecentBookings } from "@/components/user/recent-bookings"
import { UserUpcomingBookings } from "@/components/user/upcoming-bookings"
import { getAllReservationByUser } from "@/lib/reservation"
import { getLimit10 } from "@/lib/courts"
import { useUserStore } from "@/stores/userStore"

export function UserDashboardContent() {
  const user = useUserStore((state) => state.user)
  const [bookings, setBookings] = useState<any[]>([])
  const [recommendedCourts, setRecommendedCourts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      // 1. Obtener todas las reservas reales del usuario
      const bookingsData = await getAllReservationByUser()
      setBookings(bookingsData || [])

      // 2. Obtener canchas recomendadas reales (canchas destacadas del backend)
      const featured = await getLimit10()
      setRecommendedCourts((featured || []).slice(0, 3))
    } catch (error) {
      console.error("Error al cargar datos del dashboard de usuario", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Cálculos dinámicos con datos reales
  const activeBookingsCount = bookings.filter((booking) => {
    const isPendingOrConfirmed = booking.status === "confirmed" || booking.status === "pending"
    if (!isPendingOrConfirmed) return false
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}:00`)
    return bookingDateTime >= new Date()
  }).length

  const favoriteCourtsCount = new Set(
    bookings.map((booking) => booking.court?.id).filter(Boolean)
  ).size

  const totalHoursReserved = bookings
    .filter((booking) => booking.status === "completed" || booking.status === "confirmed")
    .reduce((acc, booking) => acc + (parseFloat(booking.duration) || 0), 0)

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-2">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-semibold">Cargando tu panel de control...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Bienvenido de vuelta, {user?.name || "Deportista"}</h2>
            <p className="text-muted-foreground">Aquí puedes ver tus próximas reservas y buscar canchas disponibles.</p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2 self-start sm:self-center font-semibold">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {/* Tarjetas de Métricas Reales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Reservas Activas</CardTitle>
              <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{activeBookingsCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {activeBookingsCount === 1 ? "Tienes 1 reserva activa programada" : `Tienes ${activeBookingsCount} reservas activas programadas`}
              </p>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/40">
              <Link href="/user/bookings" className="w-full">
                <Button variant="ghost" size="sm" className="w-full font-semibold">
                  Ver todas
                </Button>
              </Link>
            </CardFooter>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Canchas Jugadas</CardTitle>
              <MapPinIcon className="h-5 w-5 text-primary shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{favoriteCourtsCount}</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Has visitado {favoriteCourtsCount} canchas diferentes
              </p>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/40">
              <Link href="/user/search" className="w-full">
                <Button variant="ghost" size="sm" className="w-full font-semibold">
                  Buscar canchas
                </Button>
              </Link>
            </CardFooter>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Horas Reservadas</CardTitle>
              <ClockIcon className="h-5 w-5 text-primary shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalHoursReserved} hrs</div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Total de tiempo acumulado en canchas
              </p>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border/40">
              <Link href="/user/bookings" className="w-full">
                <Button variant="ghost" size="sm" className="w-full font-semibold">
                  Ver historial
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Próximas Reservas Reales */}
      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Próximas Reservas</h2>
          <p className="text-sm text-muted-foreground font-semibold">Tus reservas programadas vigentes.</p>
        </div>
        <UserUpcomingBookings bookings={bookings} />
      </section>

      {/* Reservas Recientes Reales */}
      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Historial Reciente</h2>
          <p className="text-sm text-muted-foreground font-semibold">Tus últimas actividades en canchas.</p>
        </div>
        <UserRecentBookings bookings={bookings} />
      </section>

      {/* Canchas Recomendadas Reales */}
      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Canchas Recomendadas</h2>
          <p className="text-sm text-muted-foreground font-semibold">Canchas destacadas y activas disponibles en la plataforma.</p>
        </div>
        
        {recommendedCourts.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium">No hay canchas recomendadas en este momento.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendedCourts.map((court) => {
              const courtImage = Array.isArray(court.images) && court.images.length > 0 ? court.images[0] : "/placeholder.svg"
              return (
                <Card key={court.id} className="shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted relative">
                      <img
                        src={courtImage}
                        alt={court.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">{court.name}</CardTitle>
                      <CardDescription className="font-semibold text-muted-foreground">{court.venue?.name || "Complejo Deportivo"}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {court.venue?.address && (
                        <div className="flex items-center text-sm text-muted-foreground font-medium">
                          <MapPinIcon className="mr-1 h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{court.venue.address}</span>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-bold text-foreground">S/ {court.priceDay || 0}/hora</span>
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold text-foreground">4.8</span>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  <CardFooter className="pt-4 border-t border-border/40">
                    <Link href={`/user/search?court=${court.id}`} className="w-full">
                      <Button className="w-full font-semibold">Reservar Ahora</Button>
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
